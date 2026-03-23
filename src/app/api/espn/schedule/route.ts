import { NextResponse } from 'next/server'

const ESPN_SCHEDULE_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

interface ESPNEvent {
  id: string
  name: string
  shortName: string
  date: string
  endDate?: string
  competitions?: Array<{
    purse?: number
    status?: {
      type?: {
        state?: string
        description?: string
      }
    }
  }>
  season?: {
    year: number
  }
}

// Cache schedule for 1 hour
let scheduleCache: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function GET() {
  try {
    // Return cached data if fresh
    if (scheduleCache && Date.now() - scheduleCache.timestamp < CACHE_DURATION) {
      return NextResponse.json(scheduleCache.data, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      })
    }

    // Fetch PGA Tour schedule from ESPN
    // The scoreboard endpoint returns the current event, but we can also try the calendar endpoint
    const calendarUrl = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=2026'

    let events: any[] = []

    // Try calendar/schedule endpoint first
    try {
      const res = await fetch(calendarUrl, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.events && data.events.length > 0) {
          events = data.events
        }
      }
    } catch (e) {
      console.error('ESPN calendar fetch failed:', e)
    }

    // Fallback: try the base scoreboard (gets current event)
    if (events.length === 0) {
      try {
        const res = await fetch(ESPN_SCHEDULE_URL, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.events) events = data.events
          // Also check for league calendar
          if (data.leagues?.[0]?.calendar) {
            const calendar = data.leagues[0].calendar
            // Calendar may contain event references with dates
            if (Array.isArray(calendar)) {
              // Sometimes ESPN returns calendar as array of event stubs
              events = [...events]
            }
          }
        }
      } catch (e) {
        console.error('ESPN scoreboard fetch failed:', e)
      }
    }

    // Parse events into a clean format
    const tournaments = events.map((evt: ESPNEvent) => {
      const comp = evt.competitions?.[0]
      const status = comp?.status?.type
      return {
        espnId: evt.id,
        name: evt.name || evt.shortName,
        shortName: evt.shortName || evt.name,
        startDate: evt.date,
        endDate: evt.endDate || evt.date,
        purse: comp?.purse || null,
        state: status?.state || 'pre', // pre, in, post
        statusDescription: status?.description || '',
        season: evt.season?.year || 2026,
      }
    })

    const result = {
      tournaments,
      fetchedAt: new Date().toISOString(),
      source: events.length > 0 ? 'espn_live' : 'none',
    }

    scheduleCache = { data: result, timestamp: Date.now() }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (error) {
    console.error('GET /api/espn/schedule error:', error)
    return NextResponse.json(
      { tournaments: [], fetchedAt: new Date().toISOString(), source: 'error' },
      { status: 500 }
    )
  }
}
