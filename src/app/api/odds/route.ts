import { NextRequest, NextResponse } from 'next/server'

// Fetch live odds from The Odds API for a PGA Tour event
// Usage:
//   GET /api/odds?apiKey=xxx                          → list available events
//   GET /api/odds?apiKey=xxx&eventId=abc123           → get odds for specific event
//   GET /api/odds?apiKey=xxx&tournament=valspar        → match event by name
// Also checks ODDS_API_KEY env var as fallback

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports'
const SPORT_KEY = 'golf_pga_tour'

async function getDb() {
  if (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) {
    return await import('@/lib/db-kv')
  }
  return await import('@/lib/db')
}

export async function GET(request: NextRequest) {
  try {
    // Get API key: query param > settings > env var
    let apiKey = request.nextUrl.searchParams.get('apiKey') || ''

    if (!apiKey) {
      try {
        const db = await getDb()
        const settings = await db.getSettings()
        apiKey = (settings as any).oddsApiKey || ''
      } catch (e) { /* ignore */ }
    }

    if (!apiKey) {
      apiKey = process.env.ODDS_API_KEY || ''
    }

    if (!apiKey) {
      return NextResponse.json({
        error: 'No Odds API key configured. Add your key in Admin Settings or set ODDS_API_KEY env var.',
        source: 'none',
        golfers: [],
        events: [],
      }, { status: 200 })
    }

    const mode = request.nextUrl.searchParams.get('mode') || '' // 'events' = list only
    const tournamentQuery = request.nextUrl.searchParams.get('tournament') || ''
    const eventIdParam = request.nextUrl.searchParams.get('eventId') || ''

    // Step 1: Get available PGA Tour events
    const eventsUrl = `${ODDS_API_BASE}/${SPORT_KEY}/events?apiKey=${apiKey}`
    const eventsRes = await fetch(eventsUrl, { cache: 'no-store' })

    if (!eventsRes.ok) {
      const errText = await eventsRes.text().catch(() => '')
      console.error('Odds API events fetch failed:', eventsRes.status, errText)
      return NextResponse.json({
        error: 'Failed to fetch events from Odds API (status ' + eventsRes.status + ')',
        source: 'error',
        golfers: [],
        events: [],
      }, { status: 200 })
    }

    const events = await eventsRes.json()

    // Parse events into clean format
    const parsedEvents = (Array.isArray(events) ? events : []).map((e: any) => ({
      id: e.id,
      name: e.description || e.home_team || 'Unknown',
      commence_time: e.commence_time,
      home_team: e.home_team || '',
    }))

    // If mode=events, just return the event list (no odds fetch needed)
    if (mode === 'events') {
      return NextResponse.json({
        events: parsedEvents,
        eventCount: parsedEvents.length,
        source: 'the_odds_api',
        fetchedAt: new Date().toISOString(),
      })
    }

    // Step 2: Find the target event
    let targetEvent: any = null

    if (eventIdParam) {
      targetEvent = events.find((e: any) => e.id === eventIdParam)
    }

    if (!targetEvent && tournamentQuery) {
      const query = tournamentQuery.toLowerCase()
      targetEvent = events.find((e: any) =>
        (e.description || '').toLowerCase().includes(query) ||
        (e.home_team || '').toLowerCase().includes(query)
      )
    }

    if (!targetEvent && events.length > 0) {
      targetEvent = events[0] // Default to first available event
    }

    if (!targetEvent) {
      return NextResponse.json({
        golfers: [],
        events: parsedEvents,
        source: 'no_events',
        message: 'No PGA Tour events currently available on Odds API',
      })
    }

    // Step 3: Get odds for the event (outrights/futures market)
    const oddsUrl = `${ODDS_API_BASE}/${SPORT_KEY}/events/${targetEvent.id}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`
    const oddsRes = await fetch(oddsUrl, { cache: 'no-store' })

    if (!oddsRes.ok) {
      console.error('Odds API odds fetch failed:', oddsRes.status)
      return NextResponse.json({
        golfers: [],
        events: parsedEvents,
        event: {
          id: targetEvent.id,
          name: targetEvent.description || targetEvent.home_team || 'Unknown',
          commence_time: targetEvent.commence_time,
        },
        source: 'error',
        error: 'Failed to fetch odds for event',
      }, { status: 200 })
    }

    const oddsData = await oddsRes.json()

    // Parse odds from bookmakers — aggregate across all bookmakers for consensus
    const golferOddsMap: { [name: string]: number[] } = {}

    const bookmakers = oddsData.bookmakers || []
    for (const bookmaker of bookmakers) {
      for (const market of bookmaker.markets || []) {
        if (market.key === 'outrights') {
          for (const outcome of market.outcomes || []) {
            const name = outcome.name || outcome.description
            if (!name) continue
            if (!golferOddsMap[name]) golferOddsMap[name] = []
            golferOddsMap[name].push(outcome.price)
          }
        }
      }
    }

    // Calculate consensus odds (average across bookmakers)
    const golfers = Object.entries(golferOddsMap)
      .map(([name, odds]) => {
        const avgOdds = Math.round(odds.reduce((a, b) => a + b, 0) / odds.length)
        return {
          name,
          odds: avgOdds > 0 ? `+${avgOdds}` : `${avgOdds}`,
          oddsNumeric: avgOdds,
          bookmakerCount: odds.length,
        }
      })
      .sort((a, b) => a.oddsNumeric - b.oddsNumeric)

    return NextResponse.json({
      event: {
        id: targetEvent.id,
        name: targetEvent.description || targetEvent.home_team || 'Unknown',
        commence_time: targetEvent.commence_time,
      },
      events: parsedEvents,
      golfers,
      golferCount: golfers.length,
      bookmakerCount: bookmakers.length,
      source: 'the_odds_api',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('GET /api/odds error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      golfers: [],
      events: [],
      source: 'error',
    }, { status: 500 })
  }
}
