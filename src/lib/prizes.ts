import {
  PayoutStructure,
  PrizeMoneySplit,
  Entry,
  TournamentGolfer,
  LeaderboardEntry,
} from '@/types'

// Standard PGA Tour prize money distribution
// Represents percentages of total purse for each finishing position
const PGA_TOUR_DISTRIBUTION: Record<number, number> = {
  1: 18.0,
  2: 10.9,
  3: 6.9,
  4: 4.5,
  5: 3.6,
  6: 3.1,
  7: 2.8,
  8: 2.5,
  9: 2.25,
  10: 2.0,
  11: 1.9,
  12: 1.8,
  13: 1.7,
  14: 1.6,
  15: 1.5,
  16: 1.475,
  17: 1.45,
  18: 1.425,
  19: 1.4,
  20: 1.375,
  21: 1.35,
  22: 1.325,
  23: 1.3,
  24: 1.275,
  25: 1.25,
  26: 1.25,
  27: 1.25,
  28: 1.25,
  29: 1.25,
  30: 1.25,
}

/**
 * Parse position string like "1", "T2", "CUT", "WD" to numerical rank
 * Returns null for CUT, WD, DQ
 */
function parsePosition(position: string | null): number | null {
  if (!position) return null

  // Handle cut, withdrawn, disqualified
  if (position === 'CUT' || position === 'WD' || position === 'DQ') {
    return null
  }

  // Remove "T" prefix for ties and convert to number
  const match = position.match(/T?(\d+)/)
  if (match) {
    return parseInt(match[1], 10)
  }

  return null
}

/**
 * Calculate projected earnings based on current position and total purse
 */
export function calculateProjectedEarnings(
  position: string | null,
  totalPurse: number
): number {
  if (!position) return 0

  const rank = parsePosition(position)
  if (rank === null) return 0

  // Get percentage from PGA Tour distribution, default to 0.5% for positions beyond 30
  const percentage = PGA_TOUR_DISTRIBUTION[rank] ?? 0.5
  return Math.round((percentage / 100) * totalPurse)
}

/**
 * Get payout structure for the pool based on entry count
 */
export function getPayoutStructure(entryCount: number): PayoutStructure[] {
  if (entryCount < 500) {
    // Pay top 8 for smaller pools
    return [
      { place: 1, percentage: 35 },
      { place: 2, percentage: 20 },
      { place: 3, percentage: 12 },
      { place: 4, percentage: 8 },
      { place: 5, percentage: 6 },
      { place: 6, percentage: 5 },
      { place: 7, percentage: 4 },
      { place: 8, percentage: 3 },
      // Remaining ~7% reserved for admin/house
    ]
  } else {
    // Pay top 9 for larger pools
    return [
      { place: 1, percentage: 30 },
      { place: 2, percentage: 18 },
      { place: 3, percentage: 12 },
      { place: 4, percentage: 9 },
      { place: 5, percentage: 7 },
      { place: 6, percentage: 6 },
      { place: 7, percentage: 5 },
      { place: 8, percentage: 4 },
      { place: 9, percentage: 3 },
      // Remaining ~6% reserved for admin/house
    ]
  }
}

/**
 * Calculate the total score for an entry
 * Sum of projected earnings for all 6 picks, with wild card picks earning doubled
 */
export function calculatePoolScore(
  entry: Entry,
  tournamentGolfers: TournamentGolfer[]
): number {
  let totalEarnings = 0

  // Helper to get earnings for a pick
  const getEarnings = (golferId: string, isWildCard: boolean = false) => {
    const tg = tournamentGolfers.find((t) => t.golferId === golferId)
    if (!tg) return 0

    const earnings = tg.projectedEarnings
    return isWildCard ? earnings * 2 : earnings
  }

  // Regular group picks (standard scoring)
  totalEarnings += getEarnings(entry.pickGroupA)
  totalEarnings += getEarnings(entry.pickGroupB)
  totalEarnings += getEarnings(entry.pickGroupC)
  totalEarnings += getEarnings(entry.pickGroupD)

  // Wild card picks (doubled scoring)
  totalEarnings += getEarnings(entry.wildCard1, true)
  totalEarnings += getEarnings(entry.wildCard2, true)

  return totalEarnings
}

/**
 * Resolve ties using tiebreaker rule
 * Closest to actual winning score WITHOUT going over wins
 * If all tied entries went over, closest to winning score wins
 */
export function resolveTiebreaker(
  entries: LeaderboardEntry[],
  actualWinningScore: number
): LeaderboardEntry[] {
  // Find the maximum score in the tied group
  const maxScore = Math.max(...entries.map((e) => e.totalProjectedEarnings))

  // Filter entries that have the max score
  const tiedEntries = entries.filter((e) => e.totalProjectedEarnings === maxScore)

  if (tiedEntries.length === 1) {
    return entries
  }

  // Sort by tiebreaker score
  const tiereakerDifference = (tiebreaker: number): number => {
    // Entries closer to winning score (but not over) are better (lower difference)
    if (tiebreaker <= actualWinningScore) {
      return actualWinningScore - tiebreaker
    } else {
      // Entries over the winning score: closer is better (lower difference)
      return tiebreaker - actualWinningScore + 1000 // Add 1000 to penalize going over
    }
  }

  // Separate tied entries and non-tied entries
  const nonTied = entries.filter((e) => e.totalProjectedEarnings !== maxScore)
  const sortedTied = tiedEntries.sort(
    (a, b) =>
      tiereakerDifference(a.tiebreaker) - tiereakerDifference(b.tiebreaker)
  )

  // Recombine: non-tied entries first (by rank), then sorted tied entries
  return [...nonTied, ...sortedTied]
}

/**
 * Calculate PGA Tour-style prize money splits
 */
export function calculatePrizeMoneySplits(
  totalPurse: number
): PrizeMoneySplit[] {
  const splits: PrizeMoneySplit[] = []

  Object.entries(PGA_TOUR_DISTRIBUTION).forEach(([position, percentage]) => {
    const pos = parseInt(position, 10)
    const amount = Math.round((percentage / 100) * totalPurse)

    let positionLabel = pos.toString()
    if (pos === 2 || pos === 3) {
      positionLabel = `T${pos}`
    }

    splits.push({
      position: pos,
      positionLabel,
      percentage,
      amount,
    })
  })

  return splits
}

/**
 * Calculate total pool prize distribution
 */
export function calculatePoolPrizes(
  totalPoolFund: number,
  entryCount: number
): { place: number; amount: number }[] {
  const payoutStructure = getPayoutStructure(entryCount)
  const payoutSum = payoutStructure.reduce((sum, p) => sum + p.percentage, 0)

  return payoutStructure.map((p) => ({
    place: p.place,
    amount: Math.round((p.percentage / payoutSum) * totalPoolFund),
  }))
}
