import { format, parseISO } from 'date-fns'

function fmtHoursFromMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
  const h = ms / 3_600_000
  return `${h.toFixed(1)} h`
}

function SectionError({ detail }) {
  return <p className="sectionHint">{detail || 'Could not load this section.'}</p>
}

function StatLoadError({ section }) {
  if (!section || section.ok) return null
  return (
    <p className="statErr" title={section.detail}>
      {section.status === 403 ? 'Missing WHOOP scope — reconnect WHOOP' : 'Could not load'}
    </p>
  )
}

/** WHOOP-style zones: green ≥67%, yellow 34–66%, red under 34%. */
function scoreBand(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'neutral'
  if (score >= 67) return 'good'
  if (score >= 34) return 'mid'
  return 'bad'
}

/**
 * Day strain is on WHOOP’s ~0–21 scale (higher = more cardiovascular load).
 * Color = load / recovery cost: green lighter day, yellow harder, red very taxing.
 */
function strainBand(strain) {
  if (typeof strain !== 'number' || !Number.isFinite(strain)) return 'neutral'
  if (strain >= 17) return 'bad'
  if (strain >= 11) return 'mid'
  return 'good'
}

const STRAIN_HINT = {
  good: 'Lighter load — easier on recovery',
  mid: 'Elevated load',
  bad: 'Very high load — prioritize recovery',
  neutral: '',
}

/** Rough sport → emoji for workout rows (WHOOP sport_name strings vary). */
function workoutSportEmoji(sportName) {
  const s = (sportName || '').toLowerCase()
  if (/cycl|bike|spin/i.test(s)) return '🚴'
  if (/run|jog/i.test(s)) return '🏃'
  if (/swim/i.test(s)) return '🏊'
  if (/walk|hik/i.test(s)) return '🥾'
  if (/weight|strength|lift|gym/i.test(s)) return '🏋️'
  if (/yoga|pilates|stretch/i.test(s)) return '🧘'
  if (/rowing|kayak|ergometer|indoor row/i.test(s)) return '🚣'
  if (/hiit|circuit|functional/i.test(s)) return '⚡'
  if (/sport|basket|soccer|football|tennis|golf/i.test(s)) return '🏅'
  return '🏃'
}

function WorkoutRow({ w }) {
  const strain = w.score?.strain
  const band = typeof strain === 'number' && Number.isFinite(strain) ? strainBand(strain) : 'neutral'
  const barW =
    typeof strain === 'number' && Number.isFinite(strain)
      ? Math.min(100, Math.max(0, (strain / 21) * 100))
      : 0

  return (
    <li className={`workoutRow workoutRow--${band}`}>
      <div className="workoutRowIcon" aria-hidden>
        {workoutSportEmoji(w.sport_name)}
      </div>
      <div className="workoutRowBody">
        <div className="workoutRowHead">
          <div className="workoutRowHeadText">
            <div className="workoutRowTitle">{w.sport_name ?? 'Workout'}</div>
            <div className="workoutRowDate">{w.start ? format(parseISO(w.start), 'EEE, MMM d · p') : '—'}</div>
          </div>
          <div className={`workoutRowStrain workoutRowStrain--${band}`}>
            {strain != null ? strain.toFixed(1) : '—'}
          </div>
        </div>
        <div className="sleepBarTrack workoutStrainTrack" role="presentation">
          <div
            className={`sleepBarFill sleepBarFill--${band}`}
            style={{ width: strain != null ? `${barW}%` : '0%' }}
          />
        </div>
        <div className="workoutRowSub">Strain (0–21 scale)</div>
      </div>
    </li>
  )
}

function BodyMetricRow({ kind, label, value, hint }) {
  return (
    <li className={`bodyMetricRow bodyMetricRow--${kind}`}>
      <div className="bodyMetricIcon" aria-hidden>
        {kind === 'height' ? '📏' : kind === 'weight' ? '⚖️' : '❤️'}
      </div>
      <div className="bodyMetricMain">
        <span className="bodyMetricLabel">{label}</span>
        <span className="bodyMetricValue">{value}</span>
        {hint ? <span className="bodyMetricHint">{hint}</span> : null}
      </div>
    </li>
  )
}

function SleepRow({ sl }) {
  const pct = sl.score?.sleep_performance_percentage
  const band = typeof pct === 'number' && Number.isFinite(pct) ? scoreBand(pct) : 'neutral'
  const barW = typeof pct === 'number' && Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0

  return (
    <li className={`sleepRow sleepRow--${band}`}>
      <div className="sleepRowIcon" aria-hidden>
        {sl.nap ? '💤' : '🌙'}
      </div>
      <div className="sleepRowBody">
        <div className="sleepRowHead">
          <div className="sleepRowHeadText">
            <div className="sleepRowTop">
              <span className="sleepRowKind">{sl.nap ? 'Nap' : 'Night sleep'}</span>
            </div>
            <div className="sleepRowDate">
              {sl.start ? format(parseISO(sl.start), 'EEE, MMM d · p') : '—'}
            </div>
          </div>
          <div className={`sleepRowPct sleepRowPct--${band}`}>
            {pct != null ? `${Math.round(pct)}%` : '—'}
          </div>
        </div>
        <div className="sleepBarTrack" role="presentation">
          <div
            className={`sleepBarFill sleepBarFill--${band}`}
            style={{ width: pct != null ? `${barW}%` : '0%' }}
          />
        </div>
        <div className="sleepRowBed">In bed {fmtHoursFromMs(sl.score?.stage_summary?.total_in_bed_time_milli)}</div>
      </div>
    </li>
  )
}

export default function Dashboard({ payload }) {
  const s = payload?.sections ?? {}

  const profile = s.profile?.ok ? s.profile.data : null
  const body = s.body?.ok ? s.body.data : null
  const recoveryRecords = s.recovery?.ok ? s.recovery.data?.records ?? [] : []
  const cycleRecords = s.cycles?.ok ? s.cycles.data?.records ?? [] : []
  const workoutRecords = s.workouts?.ok ? s.workouts.data?.records ?? [] : []
  const sleepRecords = s.sleep?.ok ? s.sleep.data?.records ?? [] : []

  const latestRecovery = recoveryRecords[0]
  const latestCycle = cycleRecords[0]
  const latestSleep = sleepRecords[0]

  const recoveryScore = latestRecovery?.score?.recovery_score
  const sleepPerf = latestSleep?.score?.sleep_performance_percentage
  const recoveryBand = s.recovery?.ok ? scoreBand(recoveryScore) : 'neutral'
  const sleepBand = s.sleep?.ok ? scoreBand(sleepPerf) : 'neutral'

  const cycleStrain = latestCycle?.score?.strain
  const strainZone = s.cycles?.ok ? strainBand(cycleStrain) : 'neutral'

  return (
    <div className="dashboard">
      <div className="dashboardHero">
        <div>
          <div className="heroGreeting">
            {profile?.first_name ? `Hi, ${profile.first_name}` : 'Your WHOOP snapshot'}
          </div>
          {profile?.email ? <div className="heroEmail">{profile.email}</div> : null}
        </div>
        {payload?.fetchedAt ? (
          <div className="pill">Updated {format(parseISO(payload.fetchedAt), 'PPp')}</div>
        ) : null}
      </div>

      <div className="statGrid">
        <div className={`statCard statCard--${recoveryBand}`}>
          <div className="statLabel">Recovery</div>
          <StatLoadError section={s.recovery} />
          {s.recovery?.ok ? (
            <>
              <div className="statValue">
                {latestRecovery?.score?.recovery_score != null
                  ? `${latestRecovery.score.recovery_score}%`
                  : '—'}
              </div>
              <div className="statSub">
                HRV{' '}
                {latestRecovery?.score?.hrv_rmssd_milli != null
                  ? `${latestRecovery.score.hrv_rmssd_milli.toFixed(0)} ms`
                  : '—'}{' '}
                · RHR {latestRecovery?.score?.resting_heart_rate ?? '—'} bpm
              </div>
            </>
          ) : (
            <div className="statValue">—</div>
          )}
        </div>

        <div className={`statCard statCard--${strainZone}`}>
          <div className="statLabel">Day strain</div>
          <StatLoadError section={s.cycles} />
          {s.cycles?.ok ? (
            <>
              <div className="statValue">
                {cycleStrain != null ? cycleStrain.toFixed(1) : '—'}
              </div>
              <div className="statSub">
                {latestCycle?.start
                  ? `Cycle ${format(parseISO(latestCycle.start), 'EEE MMM d')}`
                  : 'Latest cycle'}
                {STRAIN_HINT[strainZone] ? (
                  <>
                    <br />
                    <span className="statSubHint">{STRAIN_HINT[strainZone]}</span>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="statValue">—</div>
          )}
        </div>

        <div className={`statCard statCard--${sleepBand}`}>
          <div className="statLabel">Sleep performance</div>
          <StatLoadError section={s.sleep} />
          {s.sleep?.ok ? (
            <>
              <div className="statValue">
                {latestSleep?.score?.sleep_performance_percentage != null
                  ? `${latestSleep.score.sleep_performance_percentage}%`
                  : '—'}
              </div>
              <div className="statSub">
                In bed{' '}
                {fmtHoursFromMs(latestSleep?.score?.stage_summary?.total_in_bed_time_milli)}
                {latestSleep?.nap ? ' · Nap' : ''}
              </div>
            </>
          ) : (
            <div className="statValue">—</div>
          )}
        </div>
      </div>

      <div className="dashboardRow">
        <div className="panel dashboardPanel dashboardPanel--body">
          <div className="panelHeader">
            <div className="panelTitle">Body</div>
            <div className="panelMeta">Profile measurements</div>
          </div>
          <div className="panelBody">
            {!s.body?.ok ? (
              <SectionError detail={s.body?.detail ?? `HTTP ${s.body?.status}`} />
            ) : (
              <ul className="bodyMetricList">
                <BodyMetricRow
                  kind="height"
                  label="Height"
                  value={body?.height_meter != null ? `${(body.height_meter * 100).toFixed(0)} cm` : '—'}
                  hint="Stature"
                />
                <BodyMetricRow
                  kind="weight"
                  label="Weight"
                  value={body?.weight_kilogram != null ? `${body.weight_kilogram.toFixed(1)} kg` : '—'}
                  hint="Body mass"
                />
                <BodyMetricRow
                  kind="hr"
                  label="Max heart rate"
                  value={body?.max_heart_rate != null ? `${body.max_heart_rate} bpm` : '—'}
                  hint="Training zones"
                />
              </ul>
            )}
          </div>
        </div>

        <div className="panel dashboardPanel">
          <div className="panelHeader">
            <div className="panelTitle">Recent workouts</div>
            <div className="panelMeta">Last {Math.min(5, workoutRecords.length)}</div>
          </div>
          <div className="panelBody">
            {!s.workouts?.ok ? (
              <SectionError detail={s.workouts?.detail ?? `HTTP ${s.workouts?.status}`} />
            ) : workoutRecords.length === 0 ? (
              <div className="pill">No workouts in this window.</div>
            ) : (
              <ul className="workoutList">
                {workoutRecords.slice(0, 5).map((w) => (
                  <WorkoutRow key={w.id ?? w.start} w={w} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panelHeader">
          <div className="panelTitle">Recent sleeps</div>
          <div className="panelMeta">Performance & time in bed</div>
        </div>
        <div className="panelBody">
          {!s.sleep?.ok ? (
            <SectionError detail={s.sleep?.detail ?? `HTTP ${s.sleep?.status}`} />
          ) : sleepRecords.length === 0 ? (
            <div className="pill">No sleep records.</div>
          ) : (
            <ul className="sleepList">
              {sleepRecords.slice(0, 5).map((sl) => (
                <SleepRow key={sl.id ?? sl.start} sl={sl} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
