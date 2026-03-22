import { NextRequest, NextResponse } from 'next/server'
import {
  getTournament,
  getEntries,
  getTournamentGolfers,
  getGolfer,
} from '@/lib/db'
import {
  calculatePoolScore,
  getPayoutStructure,
  resolveTiebreaker,
} from '@/lib/prizes'
import { LeaderboardEntry } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournament = getTournament(params.id)

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    const entries = getEntries(params.id)
    const tournamentGolfers = getTournamentGolfers(params.id)

    // Calculate scores for all entries
    const leaderboardEntries: LeaderboardEntry[] = entries.map((entry) => {
      const getPickDetails = (golferId: string) => {
        const tg = tournamentGolfers.find((t) => t.golferId === golferId)
        const golfer = getGolfer(tg?.golferId || '')

        return {
          name: golfer?.name || 'Unknown',
          score: tg?.currentScore || null,
          position: tg?.currentPosition || null,
          earnings: tg?.projectedEarnings || 0,
        }
      }

      const getWildCardDetails = (golferId: string) => {
        const tg = tournamentGolfers.find((t) => t.golferId === golferId)
        const golfer = getGolfer(tg?.golferId || '')
        const baseEarnings = tg?.projectedEarnings || 0

        return {
          name: golfer?.name || 'Unknown',
          score: tg?.currentScore || null,
          position: tg?.currentPosition || null,
          earnings: baseEarnings,
          doubled: baseEarnings * 2,
        }
      }

      const pickA = getPickDetails(entry.pickGroupA)
      const pickB = getPickDetails(entry.pickGroupB)
      const pickC = getPickDetails(entry.pickGroupC)
      const pickD = getPickDetails(entry.pickGroupD)
      const wc1 = getWildCardDetails(entry.wildCard1)
      const wc2 = getWildCardDetails(entry.wildCard2)

      const totalProjectedEarnings =
        pickA.earnings +
        pickB.earnings +
        pickC.earnings +
        pickD.earnings +
        wc1.doubled +
        wc2.doubled

      return {
        rank: 0, // Will be assigned after sorting
        entrantName: entry.entrantName,
        entrantEmail: entry.entrantEmail,
        entryId: entry.id,
        pickGroupA: pickA,
        pickGroupB: pickB,
        pickGroupC: pickC,
        pickGroupD: pickD,
        wildCard1: wc1,
        wildCard2: wc2,
        totalProjectedEarnings,
        tiebreaker: entry.tiebreaker,
        payout: null,
      }
    })

    // Sort by total projected earnings (highest first)
    let sorted = leaderboardEntries.sort(
      (a, b) => b.totalProjectedEarnings - a.totalProjectedEarnings
    )

    // Apply tiebreaker if tournament is completed
    if (tournament.status === 'completed' && tournament.winningScore !== null) {
      sorted = resolveTiebreaker(sorted, tournament.winningScore)
    }

    // Apply ranks and payouts
    const payoutStructure = getPayoutStructure(entries.length)
    const totalPoolFund = entries.length * tournament.entryFee

    sorted = sorted.map((entry, index) => {
      entry.rank = index + 1

      // Find payout for this rank
      const payout = payoutStructure.find((p) => p.place === entry.rank)
      if (payout) {
        entry.payout = Math.round((payout.percentage / 100) * totalPoolFund)
      }

      return entry
    })

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Error calculating leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to calculate leaderboard' },
      { status: 500 }
    )
  }
}
