import { useEffect, useMemo, useState } from 'react'
import Availability from './Availability.jsx'
import Enquire from './Enquire.jsx'

// Owns the timetable data and the student's slot selection, shared between the
// Availability grid and the Enquire form.
export default function BookingFlow() {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => {
    let alive = true
    fetch('/api/slots')
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setSlots(d.slots) ; else if (alive) setError(true) })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const remove = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const selectedSlots = useMemo(() => slots.filter((s) => selected.has(s.id)), [slots, selected])

  return (
    <>
      <Availability slots={slots} selected={selected} onToggle={toggle} loading={loading} error={error} />
      <Enquire selectedSlots={selectedSlots} onRemoveSlot={remove} onSubmitted={() => setSelected(new Set())} />
    </>
  )
}
