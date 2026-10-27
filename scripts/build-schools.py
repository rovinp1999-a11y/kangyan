#!/usr/bin/env python3
"""Builds public/schools.json, the school list behind the enquiry form's school search.

Sources (downloaded fresh each run):
  - KPM secondary school list (2022), archive.data.gov.my: every government secondary school
  - zh.wikipedia "马来西亚华文独立中学列表" template: 独中 with Chinese and Malay names
  - en.wikipedia "National-type Chinese secondary school": SMJK with Chinese names
  - ms.wikipedia "Maktab Rendah Sains MARA": MRSM colleges
  - en.wikipedia categories of international / Cambridge / private schools in Malaysia
  - a short hand-checked list of well-known international schools missing from the above

Run:  python3 scripts/build-schools.py      (pip install opencc-python-reimplemented for 繁→简)

Output: a JSON array of {n: name, z?: Chinese name, a?: traditional Chinese alias, t: type, p: place}
type: dz 独中 · smjk 国民型中学 · gov government school · mrsm · intl international/private
"""
import csv
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import opencc
    T2S = opencc.OpenCC('t2s').convert
    S2T = opencc.OpenCC('s2t').convert
except ImportError:  # still works, just without simplified forms of 繁体 names
    T2S = S2T = lambda s: s

UA = {'User-Agent': 'kangyan-school-list/1.0 (tuition enquiry form)'}
OUT = Path(__file__).resolve().parent.parent / 'public' / 'schools.json'


def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read().decode('utf-8-sig')
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            time.sleep(5 * (i + 1))  # Wikipedia rate limit


def wiki_raw(host, title):
    return get(f'https://{host}/w/index.php?title={urllib.parse.quote(title)}&action=raw')


def unlink(s):
    """[[a|b]] → b, [[a]] → a, drop templates, refs and html tags."""
    s = re.sub(r'<ref[^>]*/>|<ref.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\[\[(?:[^]|]*\|)?([^]]*)\]\]', r'\1', s)
    while re.search(r'\{\{[^{}]*\}\}', s):  # innermost first, so nested footnotes go too
        s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def norm(s):
    s = re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()
    return re.sub(r'\bii\b', '2', re.sub(r'\biii\b', '3', s))


STATE = {
    'JOHOR': 'Johor', 'KEDAH': 'Kedah', 'KELANTAN': 'Kelantan', 'MELAKA': 'Melaka', 'NEGERI SEMBILAN': 'Negeri Sembilan',
    'PAHANG': 'Pahang', 'PERAK': 'Perak', 'PERLIS': 'Perlis', 'PULAU PINANG': 'Penang', 'SABAH': 'Sabah', 'SARAWAK': 'Sarawak',
    'SELANGOR': 'Selangor', 'TERENGGANU': 'Terengganu', 'WILAYAH PERSEKUTUAN KUALA LUMPUR': 'Kuala Lumpur',
    'WILAYAH PERSEKUTUAN LABUAN': 'Labuan', 'WILAYAH PERSEKUTUAN PUTRAJAYA': 'Putrajaya',
}
FLAG_STATE = {'Johor': 'Johor', 'Kedah': 'Kedah', 'Kelantan': 'Kelantan', 'Malacca': 'Melaka', 'Melaka': 'Melaka',
              'Negeri Sembilan': 'Negeri Sembilan', 'Pahang': 'Pahang', 'Perak': 'Perak', 'Penang': 'Penang', 'Perlis': 'Perlis',
              'Sabah': 'Sabah', 'Sarawak': 'Sarawak', 'Selangor': 'Selangor', 'Terengganu': 'Terengganu',
              'Kuala Lumpur': 'Kuala Lumpur', 'Labuan': 'Labuan', 'Putrajaya': 'Putrajaya'}

KEEP_UPPER = {'USJ', 'TTDI', 'FELDA', 'FELCRA', 'RISDA', 'LKTP', 'KLIA', 'PJ', 'KL', 'SS', 'UPM', 'UKM', 'UTM', 'USM', 'UIA',
              'MRSM', 'SMK', 'SMKA', 'SMJK', 'SM', 'SMA', 'SMT', 'SBP', 'SABK', 'KV', 'KT6', 'ATM', 'PDRM', 'TLDM', 'TUDM', 'II',
              'III', 'IV', 'KGV', 'RTB', 'BBB', 'PKNS', 'MCKK'}
LOWER = {'DAN', 'DI', 'BIN', 'BINTI', 'AL', 'OF', 'THE'}


def title(s):
    out = []
    for i, w in enumerate(s.split()):
        core = w.strip('(),.')
        if core.upper() in KEEP_UPPER or re.search(r'\d', core) or (w.startswith('(') and len(core) <= 2):
            out.append(w.upper())
        elif i and core.upper() in LOWER:
            out.append(w.lower())
        else:
            out.append('-'.join(p[:1].upper() + p[1:].lower() for p in w.split('-')))
    return ' '.join(out).replace("'S ", "'s ")


PREFIX = [
    ('SEKOLAH MENENGAH KEBANGSAAN AGAMA ', 'SMKA '),
    ('SEKOLAH MENENGAH KEBANGSAAN ', 'SMK '),
    ('SEKOLAH MENENGAH AGAMA ', 'SMA '),
    ('SEKOLAH MENENGAH SAINS ', 'SM Sains '),
    ('SEKOLAH MENENGAH TEKNIK ', 'SMT '),
    ('SEKOLAH MENENGAH ', 'SM '),
]


def short_moe(name):
    name = re.sub(r'\s+', ' ', name.strip().upper())
    for long, short in PREFIX:
        if name.startswith(long):
            return short + title(name[len(long):])
    return title(name)


def town_of(r):
    t = r['BANDARSURAT'].strip()
    return '' if not t or t.isdigit() else title(t)


def build():
    schools = []

    # 1. government secondary schools
    moe_csv = get('https://archive.data.gov.my/data/dataset/45d7c978-746c-4874-96ef-8275477fb938/resource/'
                  '817b9cf4-d4fc-4e33-997f-97e1151c5f16/download/m-20220908104828_202209081048280_2022-senarai-sekolah-menengah.csv.csv')
    moe = []
    for r in csv.DictReader(io.StringIO(moe_csv)):
        state = STATE.get(r['NEGERI'].strip().upper(), title(r['NEGERI']))
        moe.append({'n': short_moe(r['NAMASEKOLAH']), 't': 'gov', 'town': town_of(r), 'state': state,
                    'core': norm(re.sub(r'^SEKOLAH MENENGAH (KEBANGSAAN )?', '', r['NAMASEKOLAH'].upper()))})
    print('government schools', len(moe), file=sys.stderr)

    # 2. SMJK: give the matching government school its SMJK name and Chinese name
    smjk_src = wiki_raw('en.wikipedia.org', 'National-type Chinese secondary school')
    table = smjk_src[smjk_src.index('{| class="wikitable sortable"'):]
    table = table[:table.index('\n|}')]
    matched = 0
    unmatched = []
    for row in table.split('\n|-')[1:]:
        cells = [unlink(c) for c in row.strip().split('\n|')]
        cells = [c.lstrip('|').strip() for c in cells]
        if len(cells) < 4:
            continue
        _, st, malay, zh = cells[:4]
        state = FLAG_STATE.get(st.strip(), st.strip())
        core = norm(re.sub(r'^Sekolah Menengah Jenis Kebangsaan\s*', '', malay, flags=re.I))
        free = [m for m in moe if m['t'] == 'gov']
        hit = [m for m in free if m['core'] == core and m['state'] == state] or [m for m in free if m['core'] == core]
        if not hit:
            # KPM drops the town ("Chung Hua Kuala Pilah" → "Chung Hua", town Kuala Pilah) or numbers a
            # second campus ("Keat Hwa 2"), so compare word by word within the same state.
            def fits(m):
                a, b = core.split(), m['core'].split()
                n = min(len(a), len(b))
                if a[:n] != b[:n]:
                    return False
                rest = ' '.join(a[n:])
                return not rest or rest in norm(m['town']) or rest in ('1', 'satu')
            hit = [m for m in free if m['state'] == state and fits(m)]
            if len(hit) > 1:
                hit = [m for m in hit if m['core'] == core or norm(m['town']) in core] or hit
            if len(hit) > 1 and len(core.split()) < max(len(m['core'].split()) for m in hit):
                hit = [m for m in hit if m['core'].endswith(' 1')] or hit
        zh_s = T2S(zh)
        if len(hit) == 1:
            m = hit[0]
            m['n'] = 'SMJK ' + title(re.sub(r'^Sekolah Menengah Jenis Kebangsaan\s*', '', malay, flags=re.I).upper())
            m['t'] = 'smjk'
            m['z'] = zh_s
            if zh_s != zh:
                m['a'] = zh
            matched += 1
        else:
            unmatched.append((malay, zh, state, len(hit)))
            entry = {'n': 'SMJK ' + title(re.sub(r'^Sekolah Menengah Jenis Kebangsaan\s*', '', malay, flags=re.I).upper()),
                     't': 'smjk', 'z': zh_s, 'town': '', 'state': state}
            if zh_s != zh:
                entry['a'] = zh
            schools.append(entry)
    print('smjk matched', matched, 'unmatched', len(unmatched), file=sys.stderr)
    for u in unmatched:
        print('   smjk not matched:', u, file=sys.stderr)
    schools += moe

    # 3. 独中
    dz_src = wiki_raw('zh.wikipedia.org', 'Template:马来西亚华文独立中学列表')
    dz_count = 0
    for row in dz_src.split('\n|-')[1:]:
        lines = [l for l in row.strip().split('\n') if l.strip() and not l.startswith('|}')]
        if len(lines) < 6:
            continue
        flag = re.search(r'flagu\|([^}|]+)', lines[2])
        state = FLAG_STATE.get(flag.group(1).strip(), flag.group(1).strip()) if flag else ''
        zh = re.sub(r'（[^）]*）|\([^)]*\)', '', unlink(lines[4].lstrip('|!'))).strip()  # drop notes like （有争议）
        malay = unlink(lines[5].lstrip('|!'))
        if not zh or not malay:
            continue
        zh_s = T2S(zh)
        name = re.sub(r'^Sekolah Menengah\s+', 'SM ', malay)
        name = re.sub(r'^Sekolah Tinggi\s+', 'Sekolah Tinggi ', name)
        e = {'n': name, 't': 'dz', 'z': zh_s, 'town': '', 'state': state}
        if zh_s != zh:
            e['a'] = zh
        schools.append(e)
        dz_count += 1
    print('独中', dz_count, file=sys.stderr)

    # 4. MRSM
    ms = wiki_raw('ms.wikipedia.org', 'Maktab Rendah Sains MARA')
    i = ms.index('{| class="wikitable sortable"')
    t = ms[i:ms.index('\n|}', i)]
    mrsm = 0
    for row in t.split('\n|-')[1:]:
        cells = [unlink(c) for c in row.strip().split('\n|')]
        cells = [c.lstrip('|').strip() for c in cells]
        if len(cells) < 5 or not cells[1].upper().startswith('MRSM'):
            continue
        name = re.sub(r'\s*\(.*?\)\s*', ' ', cells[1]).strip()
        schools.append({'n': name, 't': 'mrsm', 'town': '', 'state': FLAG_STATE.get(cells[4], cells[4])})
        mrsm += 1
    print('MRSM', mrsm, file=sys.stderr)

    # 5. international and private schools
    def members(cat):
        out, cont = [], ''
        while True:
            q = {'action': 'query', 'list': 'categorymembers', 'cmtitle': cat, 'cmlimit': 500, 'format': 'json'}
            if cont:
                q['cmcontinue'] = cont
            d = json.loads(get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(q)))
            out += d['query']['categorymembers']
            cont = d.get('continue', {}).get('cmcontinue')
            if not cont:
                return out

    skip = re.compile(r'University|Universiti|UOW|INTI|INTEC|KDU College|Taylor\'s College|Sunway College|Aseana College|'
                      r'Methodist College|Kirkby|Federation of|Chinese independent|Kolej Islam Malaya|Maktab Nasional|'
                      r'MARA Junior Science College|Cempaka Schools|Primary School|Chung Ling|Kolej MARA|Kolej Yayasan UEM|'
                      r'Institut Sinaran|^MRSM', re.I)
    intl, seen_cat, queue = [], set(), ['Category:International schools in Malaysia', 'Category:Private schools in Malaysia']
    while queue:
        c = queue.pop()
        if c in seen_cat:
            continue
        seen_cat.add(c)
        for m in members(c):
            if m['ns'] == 14 and len(seen_cat) < 60:
                queue.append(m['title'])
            elif m['ns'] == 0 and not skip.search(m['title']):
                intl.append(re.sub(r'\s*\((Malaysia|school)\)$', '', m['title']))
    intl += [
        'Tenby International School, Miri', 'Tenby Schools Setia Eco Park', 'Sunway International School',
        'IGB International School', "Mont'Kiara International School", 'Australian International School Malaysia',
        'Fairview International School, Penang', 'Fairview International School, Johor', 'Stonyhurst International School Penang',
        'Raffles American School', 'Seri Botani International School', "Taylor's International School Puchong",
        "Taylor's International School Kuala Lumpur", 'UCSI International School Subang Jaya', 'Brighton International School Penang',
        'St. Joseph\'s Institution International School Malaysia', 'Kolej Tuanku Ja\'afar', 'Sri KDU School',
    ]
    for name in dict.fromkeys(intl):
        schools.append({'n': name, 't': 'intl', 'town': '', 'state': ''})
    print('international/private', len(dict.fromkeys(intl)), file=sys.stderr)

    # tidy, dedupe, emit
    out, seen = [], set()
    for s in schools:
        key = (norm(s['n']), s.get('town', ''), s.get('state', ''))
        if key in seen:
            continue
        seen.add(key)
        p = s['town'] if s['town'] == s['state'] else ', '.join(x for x in (s['town'], s['state']) if x)
        e = {'n': s['n'], 't': s['t']}
        if s.get('z'):
            # OpenCC writes 锺 but the schools themselves use 钟 (钟灵); keep the other form searchable
            z = s['z'].replace('锺', '钟')
            e['z'] = z
            alias = s.get('a') or (s['z'] if z != s['z'] else '') or S2T(z)  # 繁体 so 寬柔 finds 宽柔
            if alias and alias != z:
                e['a'] = alias
        if p:
            e['p'] = p
        out.append(e)
    order = {'dz': 0, 'smjk': 1, 'gov': 2, 'mrsm': 3, 'intl': 4}
    out.sort(key=lambda e: (order[e['t']], e['n']))
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('wrote', len(out), 'schools to', OUT, f'({OUT.stat().st_size // 1024} KB)', file=sys.stderr)


if __name__ == '__main__':
    build()
