import { NextRequest, NextResponse } from 'next/server'
import { getTournament, getTournamentGolfers, saveTournamentGolfers } from '@/lib/db'
import { calculateProjectedEarnings } from '@/lib/prizes'

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

    // TODO: Integrate with ESPN scraper
    // This endpoint would fetch latest scores from ESPN and update the database
    // For now, return a message indicating this is where scraper integration would happen

    return NextResponse.json({
      message: 'Scores endpoint - ESPN scraper integration pending',
      tournamentId: params.id,
    })
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scores' },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const body = await request.json()
    const { scores } = body

    if (!Array.isArray(scores)) {
      return NextResponse.json(
        { error: 'scores must be an array' },
        { status: 400 }
      )
    }

    const tournamentGolfers = getTournamentGolfers(params.id)
    const updated: typeof tournamentGolfers = []

    for (const scoreUpdate of scores) {
      const { golferId, currentScore, currentPosition, thru, projectedEarnings } =
        scoreUpdate

      if (!golferId) {
        return NextResponse.json(
          { error: 'Each score update must have golferId' },
          { status: 400 }
        )
      }

      const golfer = tournamentGolfers.find((g) => g.golferId === golferId)

      if (!golfer) {
        return NextResponse.json(
          { error: `Golfer ${golferId} not found in tournament` },
          { status: 404 }
        )
      }

      // Update score fields
      if (currentScore !== undefined) {
        golfer.currentScore = currentScore
      }

      if (currentPosition !== undefined) {
        golfer.currentPosition = currentPosition
      }

      if (thru !== undefined) {
        golfer.thru = thru
      }

      // Calculate projected earnings based on position if not provided
      if (projectedEarnings !== undefined) {
        golfer.projectedEarnings = projectedEarnings
      } else if (currentPosition) {
        golfer.projectedEarnings = calculateProjectedEarnings(
          currentPosition,
          tournament.totalPurse
        )
      }

      updated.push(golfer)
    }

    saveTournamentGolfers(updated)

    return NextResponse.json({
      message: 'Scores updated successfully',
      count: updated.length,
    })
  } catch (error) {
    console.error('Error updating scores:', error)
    return NextResponse.json(
      { error: 'Failed to update scores' },
      { status: 500 }
    )
  }
}
