import { NextRequest, NextResponse } from 'next/server'
import {
  getTournament,
  getEntries,
  saveEntry,
  getTournamentGolfers,
  getEntry,
} from '@/lib/db'
import { Entry } from '@/types'
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

    const entries = getEntries(params.id)

    // Hide picks if tournament is in setup/entries_open
    if (tournament.status === 'setup' || tournament.status === 'entries_open') {
      return NextResponse.json({
        count: entries.length,
        picksCloaked: true,
        message: 'Entry details hidden until entries close',
      })
    }

    // Return full entries if tournament is in_progress or completed
    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching entries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
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

    // Validate tournament status
    if (tournament.status !== 'entries_open') {
      return NextResponse.json(
        { error: 'Tournament entries are not open' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      entrantName,
      entrantEmail,
      pickGroupA,
      pickGroupB,
      pickGroupC,
      pickGroupD,
      wildCard1,
      wildCard2,
      tiebreaker,
    } = body

    // Validation
    if (
      !entrantName ||
      !entrantEmail ||
      !pickGroupA ||
      !pickGroupB ||
      !pickGroupC ||
      !pickGroupD ||
      !wildCard1 ||
      !wildCard2 ||
      tiebreaker === undefined
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: entrantName, entrantEmail, pickGroupA, pickGroupB, pickGroupC, pickGroupD, wildCard1, wildCard2, tiebreaker',
        },
        { status: 400 }
      )
    }

    if (typeof tiebreaker !== 'number') {
      return NextResponse.json(
        { error: 'tiebreaker must be a number' },
        { status: 400 }
      )
    }

    const tournamentGolfers = getTournamentGolfers(params.id)

    // Validate picks are in correct groups
    const validatePick = (golferId: string, expectedGroup: string): boolean => {
      const golfer = tournamentGolfers.find((g) => g.golferId === golferId)
      return golfer?.group === expectedGroup
    }

    const validateWildCard = (golferId: string): boolean => {
      const golfer = tournamentGolfers.find((g) => g.golferId === golferId)
      return golfer?.group === 'field'
    }

    if (!validatePick(pickGroupA, 'A')) {
      return NextResponse.json(
        { error: 'pickGroupA must be a valid golfer from group A' },
        { status: 400 }
      )
    }

    if (!validatePick(pickGroupB, 'B')) {
      return NextResponse.json(
        { error: 'pickGroupB must be a valid golfer from group B' },
        { status: 400 }
      )
    }

    if (!validatePick(pickGroupC, 'C')) {
      return NextResponse.json(
        { error: 'pickGroupC must be a valid golfer from group C' },
        { status: 400 }
      )
    }

    if (!validatePick(pickGroupD, 'D')) {
      return NextResponse.json(
        { error: 'pickGroupD must be a valid golfer from group D' },
        { status: 400 }
      )
    }

    if (!validateWildCard(wildCard1)) {
      return NextResponse.json(
        { error: 'wildCard1 must be a valid golfer from field group' },
        { status: 400 }
      )
    }

    if (!validateWildCard(wildCard2)) {
      return NextResponse.json(
        { error: 'wildCard2 must be a valid golfer from field group' },
        { status: 400 }
      )
    }

    const entry: Entry = {
      id: crypto.randomUUID(),
      tournamentId: params.id,
      entrantName,
      entrantEmail,
      pickGroupA,
      pickGroupB,
      pickGroupC,
      pickGroupD,
      wildCard1,
      wildCard2,
      tiebreaker,
      isPaid: false,
      stripePaymentId: null,
      submittedAt: new Date().toISOString(),
    }

    saveEntry(entry)

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error creating entry:', error)
    return NextResponse.json(
      { error: 'Failed to create entry' },
      { status: 500 }
    )
  }
}
