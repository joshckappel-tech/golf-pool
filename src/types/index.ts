export interface Tournament {
  id: string
  name: string // e.g. "2026 Masters"
  major: 'masters' | 'pga' | 'us_open' | 'open_championship'
  year: number
  status: 'setup' | 'entries_open' | 'entries_closed' | 'in_progress' | 'completed'
  entryFee: number // default 30
  totalPurse: number // total tournament purse
  winningScore: number | null // actual winning score to par (for tiebreaker)
  createdAt: string
}

export interface Golfer {
  id: string
  name: string
  worldRanking: number | null
  imageUrl: string | null
}

export interface TournamentGolfer {
  id: string
  tournamentId: string
  golferId: string
  group: 'A' | 'B' | 'C' | 'D' | 'field' // field = available as wild card
  odds: string | null // pre-tournament odds
  currentScore: number | null // current score to par
  currentPosition: string | null // e.g. "T3", "1", "CUT"
  thru: string | null // e.g. "F", "12", "8"
  projectedEarnings: number // projected prize money based on current position
  finalEarnings: number // actual prize money after tournament
  isWithdrawn: boolean
  isCut: boolean
}

export interface Entry {
  id: string
  tournamentId: string
  entrantName: string
  entrantEmail: string
  pickGroupA: string // golferId
  pickGroupB: string
  pickGroupC: string
  pickGroupD: string
  wildCard1: string // golferId
  wildCard2: string // golferId
  tiebreaker: number // predicted winning score to par
  isPaid: boolean
  stripePaymentId: string | null
  submittedAt: string
}

export interface LeaderboardEntry {
  rank: number
  entrantName: string
  entrantEmail: string
  entryId: string
  pickGroupA: {
    name: string
    score: number | null
    position: string | null
    earnings: number
  }
  pickGroupB: {
    name: string
    score: number | null
    position: string | null
    earnings: number
  }
  pickGroupC: {
    name: string
    score: number | null
    position: string | null
    earnings: number
  }
  pickGroupD: {
    name: string
    score: number | null
    position: string | null
    earnings: number
  }
  wildCard1: {
    name: string
    score: number | null
    position: string | null
    earnings: number
    doubled: number
  }
  wildCard2: {
    name: string
    score: number | null
    position: string | null
    earnings: number
    doubled: number
  }
  totalProjectedEarnings: number
  tiebreaker: number
  payout: number | null
}

export interface PayoutStructure {
  place: number
  percentage: number
}

// Prize money distribution based on PGA Tour standard splits
export interface PrizeMoneySplit {
  position: number // 1-based position
  positionLabel: string // "1", "T2", "CUT" etc
  percentage: number // of total purse
  amount: number // calculated amount
}

// For scraper results
export interface GolferScore {
  golferName: string
  score: number | null
  position: string | null
  thru: string | null
  projectedEarnings: number
  isWithdrawn: boolean
  isCut: boolean
}
