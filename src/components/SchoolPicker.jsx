import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { loadSchools, searchSchools, schoolLabel } from '../schoolSearch.js'

// Type-to-search school field. Picking a suggestion fills in the full name;
// anything typed that isn't on the list is kept as it is.
export default function SchoolPicker({ value, onChange, t, typeLabels, lang, label }) {
  const [list, setList] = useState(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [picked, setPicked] = useState(value)
  const inputRef = useRef(null)
  const id = useId()

  useEffect(() => {
    let live = true
    loadSchools().then((l) => live && setList(l)).catch(() => live && setFailed(true))
    return () => { live = false }
  }, [])

  const results = useMemo(() => (value === picked ? [] : searchSchools(list, value)), [list, value, picked])
  const showList = open && results.length > 0
  const typed = value.trim().length >= 2 && value !== picked
  const noMatch = typed && list && results.length === 0

  useEffect(() => { setActive(-1) }, [value])

  const pick = (s) => {
    const text = schoolLabel(s)
    setPicked(text)
    onChange(text)
    setOpen(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (!showList) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  return (
    <div className="school">
      <input
        ref={inputRef}
        className="wz__input"
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-activedescendant={showList && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        placeholder={t.ph}
        value={value}
        maxLength={160}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        autoFocus
      />
      {showList && (
        <ul className="school__list" id={`${id}-list`} role="listbox" aria-label={label}>
          {results.map((s, i) => {
            const zhFirst = s.z && (lang === 'zh' || s.t === 'dz')
            return (
              <li
                key={`${s.n}|${s.p || ''}`}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`school__opt ${i === active ? 'is-on' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                <span className="school__main">
                  <strong>{zhFirst ? s.z : s.n}</strong>
                  <span>{[zhFirst ? s.n : s.z, s.p].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`school__tag school__tag--${s.t}`}>{typeLabels[s.t]}</span>
              </li>
            )
          })}
        </ul>
      )}
      {noMatch && <p className="wz__hint school__none">{t.noMatch}</p>}
      {failed && typed && <p className="wz__hint school__none">{t.noMatch}</p>}
    </div>
  )
}
