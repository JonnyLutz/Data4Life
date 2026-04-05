/**
 * Sleep calendar + day detail (react-day-picker).
 * Not used by default in App.jsx — kept so you can import it again later.
 *
 * Usage:
 *   import SleepCalendarView from './views/SleepCalendarView'
 *   <SleepCalendarView sleeps={sleeps} loading={loading} error={error} onRetry={load} />
 */
import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import 'react-day-picker/style.css'

export default function SleepCalendarView({ sleeps = [], loading, error, onRetry }) {
  const [selectedDay, setSelectedDay] = useState(new Date())

  const sleepsByDayKey = useMemo(() => {
    const map = new Map()
    for (const r of sleeps) {
      const start = r?.start ?? r?.start_time ?? r?.startTime
      if (!start) continue
      const date = typeof start === 'string' ? parseISO(start) : new Date(start)
      const key = format(date, 'yyyy-MM-dd')
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    return map
  }, [sleeps])

  const selectedKey = useMemo(
    () => format(selectedDay ?? new Date(), 'yyyy-MM-dd'),
    [selectedDay],
  )
  const selectedSleeps = sleepsByDayKey.get(selectedKey) ?? []

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitle">Sleep calendar</div>
          <div className="panelMeta">Last 7 sleeps</div>
        </div>
        <div className="panelBody">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={(d) => d && setSelectedDay(d)}
            showOutsideDays
            components={{
              DayContent: (props) => {
                const key = format(props.date, 'yyyy-MM-dd')
                const has = sleepsByDayKey.has(key)
                return (
                  <div style={{ display: 'grid', placeItems: 'center' }}>
                    <div>{props.date.getDate()}</div>
                    <div style={{ height: 10, marginTop: 2 }}>
                      {has ? <span className="dot" /> : null}
                    </div>
                  </div>
                )
              },
            }}
          />
          {error ? (
            <div className="errorBox" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Couldn’t load sleeps</div>
              <div style={{ color: 'rgba(255,255,255,0.85)' }}>{error}</div>
              {onRetry ? (
                <button type="button" className="primaryBtn" style={{ marginTop: 10 }} onClick={onRetry}>
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitle">{format(selectedDay, 'EEE, MMM d')}</div>
          <div className="panelMeta">
            {selectedSleeps.length
              ? `${selectedSleeps.length} sleep${selectedSleeps.length === 1 ? '' : 's'}`
              : 'No sleep recorded'}
          </div>
        </div>
        <div className="panelBody">
          {loading ? (
            <div className="pill">Loading sleep data…</div>
          ) : selectedSleeps.length ? (
            <div className="list">
              {selectedSleeps.map((r) => {
                const start = r?.start ?? r?.start_time ?? r?.startTime
                const end = r?.end ?? r?.end_time ?? r?.endTime
                const score =
                  r?.score?.sleep_performance_percentage ??
                  r?.score?.sleep_performance ??
                  r?.score ??
                  null
                const startDate =
                  typeof start === 'string' ? parseISO(start) : start ? new Date(start) : null
                const endDate = typeof end === 'string' ? parseISO(end) : end ? new Date(end) : null
                return (
                  <div className="sleepCard" key={r?.id ?? `${start}-${end}`}>
                    <div>
                      <div className="sleepCardTitle">Sleep</div>
                      <div className="sleepCardMeta">
                        {startDate ? format(startDate, 'p') : '—'} →{' '}
                        {endDate ? format(endDate, 'p') : '—'}
                      </div>
                    </div>
                    <div className="sleepBadge">
                      {typeof score === 'number' ? `${score}%` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="pill">No sleeps for this day.</div>
          )}
        </div>
      </section>
    </>
  )
}
