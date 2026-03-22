import { NextRequest, NextResponse } from 'next/server'
import {
  getTournament,
  getTournamentGolfers,
  saveTournamentGolfers,
  getGolfer,
  saveGolfer,
} from '@/lib/db'
import { TournamentGolfer, Golfer } from '@/types'
import crypto from 'crypto'

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

    const tournamentGolfers = getTournamentGolfers(params.id)

    // Group golfers by group
    const grouped = {
      A: tournamentGolfers.filter((g) => g.group === 'A'),
      B: tournamentGolfers.filter((g) => g.group === 'B'),
      C: tournamentGolfers.filter((g) => g.group === 'C'),
      D: tournamentGolfers.filter((g) => g.group === 'D'),
      field: tournamentGolfers.filter((g) => g.group === 'field'),
    }

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching golfers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch golfers' },
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
    const { golfers } = body

    if (!Array.isArray(golfers) || golfers.length === 0) {
      return NextResponse.json(
        { error: 'golfers must be a non-empty array' },
        { status: 400 }
      )
    }

    const validGroups = ['A', 'B', 'C', 'D', 'field']
    const newTournamentGolfers: TournamentGolfer[] = []

    for (const golferData of golfers) {
      const { name, group, odds } = golferData

      if (!name || !group) {
        return NextResponse.json(
          { error: 'Each golfer must have name and group' },
          { status: 400 }
        )
      }

      if (!validGroups.includes(group)) {
        return NextResponse.json(
          { error: 'Invalid group. Must be A, B, C, D, or field' },
          { status: 400 }
        )
      }

      // Create or find golfer
      const golferId = crypto.randomUUID()
      const golfer: Golfer = {
        id: golferId,
        name,
        worldRanking: null,
        imageUrl: null,
      }
      saveGolfer(golfer)

      // Create tournament golfer
      const tournamentGolfer: TournamentGolfer = {
        id: crypto.randomUUID(),
        tournamentId: params.id,
        golferId,
        group,
        odds: odds || null,
        currentScore: null,
        currentPosition: null,
        thru: null,
        projectedEarnings: 0,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      }

      newTournamentGolfers.push(tournamentGolfer)
    }

    saveTournamentGolfers(newTournamentGolfers)

    return NextResponse.json(
      { message: 'Golfers added successfully', count: newTournamentGolfers.length },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding golfers:', error)
    return NextResponse.json(
      { error: 'Failed to add golfers' },
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
    const { golferId, group, odds } = body

    if (!golferId) {
      return NextResponse.json(
        { error: 'golferId is required' },
        { status: 400 }
      )
    }

    const tournamentGolfers = getTournamentGolfers(params.id)
    const golfer = tournamentGolfers.find((g) => g.golferId === golferId)

    if (!golfer) {
      return NextResponse.json(
        { error: 'Golfer not found in tournament' },
        { status: 404 }
      )
    }

    // Update allowed fields
    if (group) {
      const validGroups = ['A', 'B', 'C', 'D', 'field']
      if (!validGroups.includes(group)) {
        return NextResponse.json(
          { error: 'Invalid group' },
          { status: 400 }
        )
      }
      golfer.group = group
    }

    if (odds) {
      golfer.odds = odds
    }

    saveTournamentGolfers([golfer])

    return NextResponse.json(golfer)
  } catch (error) {
    console.error('Error updating golfer:', error)
    return NextResponse.json(
      { error: 'Failed to update golfer' },
      { status: 500 }
    )
  }
}
