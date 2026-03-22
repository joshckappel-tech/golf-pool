import { NextRequest, NextResponse } from 'next/server'
import { getTournaments, saveTournament } from '@/lib/db'
import { Tournament } from '@/types'
import crypto from 'crypto'

export async function GET() {
  try {
    const tournaments = getTournaments()
    return NextResponse.json(tournaments)
  } catch (error) {
    console.error('Error fetching tournaments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tournaments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, major, year, entryFee, totalPurse } = body

    // Validation
    if (!name || !major || !year || entryFee === undefined || !totalPurse) {
      return NextResponse.json(
        { error: 'Missing required fields: name, major, year, entryFee, totalPurse' },
        { status: 400 }
      )
    }

    const validMajors = ['masters', 'pga', 'us_open', 'open_championship']
    if (!validMajors.includes(major)) {
      return NextResponse.json(
        { error: 'Invalid major. Must be one of: masters, pga, us_open, open_championship' },
        { status: 400 }
      )
    }

    const tournament: Tournament = {
      id: crypto.randomUUID(),
      name,
      major,
      year,
      status: 'setup',
      entryFee,
      totalPurse,
      winningScore: null,
      createdAt: new Date().toISOString(),
    }

    saveTournament(tournament)

    return NextResponse.json(tournament, { status: 201 })
  } catch (error) {
    console.error('Error creating tournament:', error)
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    )
  }
}
