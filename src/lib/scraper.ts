import { GolferScore } from '@/types'
import { calculateProjectedEarnings } from './prizes'

/**
 * Interface for ESPN leaderboard response structure
 */
interface ESPNLeaderboardResponse {
  events?: Array<{
    id: string
    name: string
    competitions?: Array<{
      id: string
      status: {
        type: string
      }
      competitors?: Array<{
        id: string
        displayName: string
        order: number
        status: {
          description: string
        }
        statistics?: Array<{
          name: string
          displayValue: string | number
        }>
      }>
    }>
  }>
}

/**
 * Position result from ESPN
 */
interface ESPNCompetitor {
  displayName: string
  position: string | null
  thru: string | null
  score: number | null
  status: string
}

/**
 * Scrape ESPN leaderboard and extract golfer scores
 * Handles ESPN's public API endpoints for golf leaderboards
 */
export async function scrapeESPNLeaderboard(
  espnEventId: string
): Promise<GolferScore[]> {
  try {
    const results: GolferScore[] = []

    // Try the main scoreboard endpoint first
    const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'
    const leaderboardUrl = `https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard?event=${espnEventId}`

    let data: ESPNLeaderboardResponse | null = null

    try {
      const response = await fetch(scoreboardUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (response.ok) {
        data = (await response.json()) as ESPNLeaderboardResponse
      }
    } catch (error) {
      console.error('Failed to fetch scoreboard:', error)
    }

    // If scoreboard failed, try the leaderboard endpoint
    if (!data || !data.events || data.events.length === 0) {
      try {
        const response = await fetch(leaderboardUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })

        if (response.ok) {
          data = (await response.json()) as ESPNLeaderboardResponse
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      }
    }

    if (!data || !data.events || data.events.length === 0) {
      console.warn('No events found in ESPN response')
      return []
    }

    // Extract competitor data from first event
    const event = data.events[0]
    if (!event.competitions || event.competitions.length === 0) {
      console.warn('No competitions found in event')
      return []
    }

    const competition = event.competitions[0]
    if (!competition.competitors || competition.competitors.length === 0) {
      console.warn('No competitors found in competition')
      return []
    }

    // Process each competitor
    for (const competitor of competition.competitors) {
      const golferScore = parseESPNCompetitor(competitor, 72000) // Default purse
      if (golferScore) {
        results.push(golferScore)
      }
    }

    return results
  } catch (error) {
    console.error('Error scraping ESPN leaderboard:', error)
    throw new Error(`Failed to scrape ESPN leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse individual competitor data from ESPN response
 */
function parseESPNCompetitor(
  competitor: any,
  totalPurse: number
): GolferScore | null {
  try {
    const name = competitor.displayName || 'Unknown'

    // Extract status
    const statusDescription = competitor.status?.description || ''
    const isWithdrawn =
      statusDescription.toUpperCase() === 'WD' ||
      statusDescription.toUpperCase() === 'WITHDREW'
    const isCut = statusDescription.toUpperCase().includes('CUT')

    // Extract score, position, and thru from statistics
    let score: number | null = null
    let position: string | null = null
    let thru: string | null = null

    if (competitor.statistics && Array.isArray(competitor.statistics)) {
      for (const stat of competitor.statistics) {
        const statName = (stat.name || '').toLowerCase()
        const displayValue = stat.displayValue

        if (statName.includes('score') || statName.includes('total')) {
          const parsed = parseFloat(String(displayValue))
          if (!isNaN(parsed)) {
            score = parsed
          }
        }

        if (statName.includes('position') || statName.includes('place')) {
          position = String(displayValue).toUpperCase()
        }

        if (statName.includes('thru') || statName.includes('through')) {
          thru = String(displayValue).toUpperCase()
        }
      }
    }

    // Calculate projected earnings
    const projectedEarnings = calculateProjectedEarnings(position, totalPurse)

    return {
      golferName: name,
      score,
      position,
      thru,
      projectedEarnings,
      isWithdrawn,
      isCut,
    }
  } catch (error) {
    console.error('Error parsing competitor:', error)
    return null
  }
}

/**
 * Map ESPN scores to prize money based on their current position
 * This function takes raw ESPN scores and calculates projected earnings
 */
export function mapScoresToPrizeMoney(
  scores: GolferScore[],
  totalPurse: number
): GolferScore[] {
  return scores.map((score) => ({
    ...score,
    projectedEarnings: calculateProjectedEarnings(score.position, totalPurse),
  }))
}

/**
 * Fetch and parse leaderboard for a specific tournament
 * Automatically handles retries and error cases
 */
export async function fetchTournamentLeaderboard(
  espnEventId: string,
  totalPurse: number,
  maxRetries: number = 3
): Promise<GolferScore[]> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const scores = await scrapeESPNLeaderboard(espnEventId)
      return mapScoresToPrizeMoney(scores, totalPurse)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
      console.warn(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        lastError.message
      )

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Failed to fetch tournament leaderboard after all retries')
}

/**
 * Parse position string and return numeric position value
 */
export function parsePositionToNumber(position: string | null): number | null {
  if (!position) return null

  // Handle special positions
  if (
    position === 'CUT' ||
    position === 'WD' ||
    position === 'DQ' ||
    position === 'E'
  ) {
    return null
  }

  // Remove "T" prefix and parse number
  const match = position.match(/T?(\d+)/)
  if (match) {
    return parseInt(match[1], 10)
  }

  return null
}

/**
 * Format position for display (add "T" for ties if needed)
 */
export function formatPosition(position: number, isTie: boolean = false): string {
  return isTie ? `T${position}` : `${position}`
}

/**
 * Validate if ESPN event ID is in correct format
 */
export function isValidESPNEventId(eventId: string): boolean {
  // ESPN event IDs are typically numeric strings
  return /^\d+$/.test(eventId)
}
