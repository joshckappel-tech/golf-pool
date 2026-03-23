import { NextRequest, NextResponse } from 'next/server'

// Fetch the field (competitors) for a specific ESPN event
// Usage: GET /api/espn/field?eventId=401580329

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId parameter' }, { status: 400 })
    }

    // Try both ESPN endpoints for competitor/field data
    let competitors: any[] = []
    let purse: number | null = null
    let tournamentName = ''
    let tournamentState = 'pre'

    // Approach 1: Scoreboard (works for current/recent events)
    try {
      const res = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard',
        { headers: { 'Accept': 'application/json' }, cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        const event = data.events?.find((e: any) => String(e.id) === String(eventId))
        if (event) {
          const comp = event.competitions?.[0]
          competitors = comp?.competitors || []
          purse = comp?.purse || null
          tournamentName = event.name || ''
          tournamentState = comp?.status?.type?.state || 'pre'
        }
      }
    } catch (e) {
      console.error('Scoreboard fetch for field failed:', e)
    }

    // Approach 2: Leaderboard endpoint (works for specific events)
    if (competitors.length === 0) {
      try {
        const res = await fetch(
          `https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${eventId}`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            cache: 'no-store',
          }
        )
        if (res.ok) {
          const data = await res.json()
          const event = data.events?.[0]
          if (event) {
            const comp = event.competitions?.[0]
            competitors = comp?.competitors || []
            purse = comp?.purse || null
            tournamentName = event.name || ''
            tournamentState = comp?.status?.type?.state || 'pre'
          }
        }
      } catch (e) {
        console.error('Leaderboard fetch for field failed:', e)
      }
    }

    // Parse competitors into field data
    const field = competitors.map((c: any) => {
      const athlete = c.athlete || {}
      return {
        name: athlete.displayName || athlete.shortName || 'Unknown',
        espnId: athlete.id || c.id,
        country: athlete.flag?.alt || null,
        // World ranking from statistics if available
        worldRanking: extractStat(c, 'world ranking') || extractStat(c, 'OWGR') || null,
      }
    })

    return NextResponse.json({
      eventId,
      tournamentName,
      tournamentState,
      purse,
      field,
      fieldSize: field.length,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('GET /api/espn/field error:', error)
    return NextResponse.json({ error: 'Failed to fetch field data' }, { status: 500 })
  }
}

function extractStat(competitor: any, statName: string): number | null {
  if (!Array.isArray(competitor.statistics)) return null
  for (const stat of competitor.statistics) {
    if ((stat.name || '').toLowerCase().includes(statName.toLowerCase()) ||
        (stat.abbreviation || '').toLowerCase().includes(statName.toLowerCase())) {
      const val = parseFloat(String(stat.value || stat.displayValue || ''))
      return isNaN(val) ? null : val
    }
  }
  return null
}
