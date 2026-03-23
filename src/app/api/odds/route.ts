import { NextRequest, NextResponse } from 'next/server'

// Fetch live odds from The Odds API for a PGA Tour event
// Usage: GET /api/odds?tournament=valspar+championship
// Requires ODDS_API_KEY environment variable

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports'
const SPORT_KEY = 'golf_pga_tour'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ODDS_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'ODDS_API_KEY not configured',
        source: 'none',
        golfers: [],
      }, { status: 200 }) // Return 200 so frontend can handle gracefully
    }

    const tournamentQuery = request.nextUrl.searchParams.get('tournament') || ''

    // Step 1: Get available events for PGA Tour
    const eventsUrl = `${ODDS_API_BASE}/${SPORT_KEY}/events?apiKey=${apiKey}`
    const eventsRes = await fetch(eventsUrl, { cache: 'no-store' })

    if (!eventsRes.ok) {
      console.error('Odds API events fetch failed:', eventsRes.status)
      return NextResponse.json({
        error: 'Failed to fetch events from Odds API',
        source: 'error',
        golfers: [],
      }, { status: 200 })
    }

    const events = await eventsRes.json()

    // Find matching event
    let targetEvent = events[0] // Default to first available
    if (tournamentQuery) {
      const query = tournamentQuery.toLowerCase()
      const match = events.find((e: any) =>
        (e.description || '').toLowerCase().includes(query) ||
        (e.home_team || '').toLowerCase().includes(query)
      )
      if (match) targetEvent = match
    }

    if (!targetEvent) {
      return NextResponse.json({
        golfers: [],
        source: 'no_events',
        message: 'No PGA Tour events currently available on Odds API',
      })
    }

    // Step 2: Get odds for the event (outrights/futures market)
    const oddsUrl = `${ODDS_API_BASE}/${SPORT_KEY}/events/${targetEvent.id}/odds?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`
    const oddsRes = await fetch(oddsUrl, { cache: 'no-store' })

    if (!oddsRes.ok) {
      console.error('Odds API odds fetch failed:', oddsRes.status)
      return NextResponse.json({
        golfers: [],
        source: 'error',
        error: 'Failed to fetch odds',
      }, { status: 200 })
    }

    const oddsData = await oddsRes.json()

    // Parse odds from bookmakers - aggregate across all bookmakers for best consensus
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
      .sort((a, b) => a.oddsNumeric - b.oddsNumeric) // Best odds first

    return NextResponse.json({
      event: {
        id: targetEvent.id,
        name: targetEvent.description || targetEvent.home_team || 'Unknown',
        commence_time: targetEvent.commence_time,
      },
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
      source: 'error',
    }, { status: 500 })
  }
}
