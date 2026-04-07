function iso(d: Date) {
  return d.toISOString()
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export function buildMockDashboardPayload() {
  const fetchedAt = iso(new Date())

  const sleepRecords = Array.from({ length: 14 }).map((_, i) => {
    const start = new Date(daysAgo(i + 1))
    start.setHours(22, 30, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 7 + (i % 3) * 0.5)
    const perf = 72 + ((i * 7) % 22) // 72–93
    return {
      id: `sleep_${i}`,
      nap: false,
      start: iso(start),
      end: iso(end),
      score: {
        sleep_performance_percentage: perf,
        stage_summary: {
          total_in_bed_time_milli: (end.getTime() - start.getTime()) * 1.05,
        },
      },
    }
  })

  const recoveryRecords = Array.from({ length: 7 }).map((_, i) => {
    const score = 58 + ((i * 9) % 35) // 58–92
    return {
      id: `recovery_${i}`,
      score: {
        recovery_score: score,
        hrv_rmssd_milli: 42 + ((i * 5) % 18),
        resting_heart_rate: 52 + ((i * 2) % 7),
      },
    }
  })

  const cycleRecords = Array.from({ length: 7 }).map((_, i) => {
    const start = daysAgo(i + 1)
    start.setHours(0, 0, 0, 0)
    return {
      id: `cycle_${i}`,
      start: iso(start),
      score: { strain: 8.2 + ((i * 2.1) % 10.5) }, // ~8–18
    }
  })

  const workoutRecords = Array.from({ length: 5 }).map((_, i) => {
    const start = new Date(daysAgo(i + 1))
    start.setHours(17 - i, 10, 0, 0)
    return {
      id: `workout_${i}`,
      sport_name: i % 2 === 0 ? 'Run' : 'Strength training',
      start: iso(start),
      score: { strain: 9.5 + i * 1.8 },
    }
  })

  return {
    fetchedAt,
    sections: {
      profile: {
        ok: true,
        data: { first_name: 'Guest', email: '' },
      },
      body: {
        ok: true,
        data: {
          height_meter: 1.78,
          weight_kilogram: 78.4,
          max_heart_rate: 188,
        },
      },
      recovery: { ok: true, data: { records: recoveryRecords } },
      cycles: { ok: true, data: { records: cycleRecords } },
      sleep: { ok: true, data: { records: sleepRecords } },
      workouts: { ok: true, data: { records: workoutRecords } },
    },
  }
}

export function mockInsightsSummary() {
  return {
    summary:
      "Demo mode: you’re viewing mock WHOOP-style data. Recovery trends look solid, strain is moderate, and sleep consistency is improving. Try syncing with a real account to see your actual recovery, strain, sleep, and workouts.",
    source: 'demo',
  }
}

