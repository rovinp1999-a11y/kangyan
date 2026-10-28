// Optional email alerts through Resend (https://resend.com). Does nothing until
// RESEND_API_KEY and NOTIFY_EMAIL are set in the Vercel project.
export async function notify(subject, text) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.NOTIFY_EMAIL
  if (!key || !to) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Kangyan <onboarding@resend.dev>', to: [to], subject, text }),
    })
    if (!res.ok) console.error('[notify]', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (err) {
    console.error('[notify]', err)
    return false
  }
}
