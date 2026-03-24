import { NextRequest, NextResponse } from 'next/server'

// Fetch live odds from The Odds API for golf events
// The Odds API uses separate sport keys per major championship:
//   golf_masters_tournament_winner, golf_pga_championship_winner,
//   golf_us_open_winner, golf_the_open_championship_winner
// It does NOT cover regular PGA Tour weekly events.
//
// Usage:
//   GET /api/odds?apiKey=xxx                     → try all golf keys, return first with events
//   GET /api/odds?apiKey=xxx&tournament=masters   → match event by name
//   GET /api/odds?mode=events&apiKey=xxx          → list available events only

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports'

// All known golf sport keys on The Odds API
const GOLF_SPORT_KEYS = [
  'golf_masters_tournament_winner',
  'golf_pga_championship_winner',
  'golf_us_open_winner',
  'golf_the_open_championship_winner',
]

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

    const mode = request.nextUrl.searchParams.get('mode') || ''
    const tournamentQuery = request.nextUrl.searchParams.get('tournament') || ''

    // Try each golf sport key to find events with odds
    let allEvents: any[] = []
    let targetSportKey = ''
    let targetEvent: any = null

    for (const sportKey of GOLF_SPORT_KEYS) {
      try {
        const eventsUrl = `${ODDS_API_BASE}/${sportKey}/events?apiKey=${apiKey}`
        const eventsRes = await fetch(eventsUrl, { cache: 'no-store' })

        if (eventsRes.ok) {
          const events = await eventsRes.json()
          if (Array.isArray(events) && events.length > 0) {
            for (const evt of events) {
              allEvents.push({ ...evt, _sportKey: sportKey })
            }

            // Check if any event matches the tournament query
            if (tournamentQuery) {
              const query = tournamentQuery.toLowerCase()
              const match = events.find((e: any) =>
                (e.description || '').toLowerCase().includes(query) ||
                (e.home_team || '').toLowerCase().includes(query) ||
                sportKey.toLowerCase().includes(query.replace(/\s+/g, '_'))
              )
              if (match && !targetEvent) {
                targetEvent = match
                targetSportKey = sportKey
              }
            }
          }
        }
      } catch (e) {
        console.error(`Odds API fetch failed for ${sportKey}:`, e)
      }
    }

    // Parse all events
    const parsedEvents = allEvents.map((e: any) => ({
      id: e.id,
      name: e.description || e.home_team || 'Unknown',
      commence_time: e.commence_time,
      sportKey: e._sportKey,
    }))

    // If mode=events, just return the event list
    if (mode === 'events') {
      return NextResponse.json({
        events: parsedEvents,
        eventCount: parsedEvents.length,
        source: 'the_odds_api',
        note: 'The Odds API only covers major championships (Masters, PGA Championship, US Open, The Open). For regular PGA Tour events, use the manual paste option.',
        fetchedAt: new Date().toISOString(),
      })
    }

    // Pick best event if no match found
    if (!targetEvent && allEvents.length > 0) {
      targetEvent = allEvents[0]
      targetSportKey = allEvents[0]._sportKey
    }

    if (!targetEvent) {
      return NextResponse.json({
        golfers: [],
        events: parsedEvents,
        source: 'no_events',
        message: 'No golf events currently available on The Odds API. Note: only major championships are covered (Masters, PGA Championship, US Open, The Open). For regular PGA Tour events like the Valspar, use the "Paste Odds" option on the admin page.',
      })
    }

    // Fetch odds for the target event
    const oddsUrl = `${ODDS_API_BASE}/${targetSportKey}/events/${targetEvent.id}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`
    const oddsRes = await fetch(oddsUrl, { cache: 'no-store' })

    if (!oddsRes.ok) {
      console.error('Odds API odds fetch failed:', oddsRes.status)
      return NextResponse.json({
        golfers: [],
        events: parsedEvents,
        event: {
          id: targetEvent.id,
          name: targetEvent.description || targetEvent.home_team || 'Unknown',
          sportKey: targetSportKey,
        },
        source: 'error',
        error: 'Failed to fetch odds for event',
      }, { status: 200 })
    }

    const oddsData = await oddsRes.json()

    // Parse odds from bookmakers
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

    // Calculate consensus odds
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
        sportKey: targetSportKey,
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
