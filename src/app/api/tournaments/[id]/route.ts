import { NextRequest, NextResponse } from 'next/server'
import { getTournament, saveTournament, getTournamentGolfers, getEntries } from '@/lib/db'

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

    const golfers = getTournamentGolfers(params.id)
    const entries = getEntries(params.id)

    // Group golfers by group
    const golfersGrouped = {
      A: golfers.filter((g) => g.group === 'A').length,
      B: golfers.filter((g) => g.group === 'B').length,
      C: golfers.filter((g) => g.group === 'C').length,
      D: golfers.filter((g) => g.group === 'D').length,
      field: golfers.filter((g) => g.group === 'field').length,
    }

    return NextResponse.json({
      ...tournament,
      golferCounts: golfersGrouped,
      entryCount: entries.length,
    })
  } catch (error) {
    console.error('Error fetching tournament:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tournament' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const { status, winningScore } = body

    // Validate status if provided
    if (status) {
      const validStatuses = ['setup', 'entries_open', 'entries_closed', 'in_progress', 'completed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }
      tournament.status = status
    }

    if (winningScore !== undefined) {
      tournament.winningScore = winningScore
    }

    saveTournament(tournament)

    return NextResponse.json(tournament)
  } catch (error) {
    console.error('Error updating tournament:', error)
    return NextResponse.json(
      { error: 'Failed to update tournament' },
      { status: 500 }
    )
  }
}
