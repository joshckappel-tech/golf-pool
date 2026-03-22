import { NextRequest, NextResponse } from 'next/server'
import {
  getTournament,
  getTournamentGolfers,
  saveTournamentGolfers,
  getGolfers,
  saveGolfers,
} from '@/lib/db'
import { TournamentGolfer, Golfer } from '@/types'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tournamentId, data } = body

    if (!tournamentId || !data) {
      return NextResponse.json(
        { error: 'Missing tournamentId or data' },
        { status: 400 }
      )
    }

    const tournament = getTournament(tournamentId)

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Parse CSV data
    // Expected format: name,group,odds
    const lines = data.trim().split('\n')
    const newTournamentGolfers: TournamentGolfer[] = []
    const newGolfers: Golfer[] = []
    const existingGolfers = getGolfers()

    const errors: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip empty lines and comment lines
      if (!line || line.startsWith('#')) {
        continue
      }

      const parts = line.split(',').map((p: string) => p.trim())

      if (parts.length < 2) {
        errors.push(`Line ${i + 1}: Invalid format. Expected: name,group[,odds]`)
        continue
      }

      const name = parts[0]
      const group = parts[1]
      const odds = parts[2] || null

      // Validate group
      const validGroups = ['A', 'B', 'C', 'D', 'field']
      if (!validGroups.includes(group)) {
        errors.push(
          `Line ${i + 1}: Invalid group "${group}". Must be A, B, C, D, or field`
        )
        continue
      }

      // Find or create golfer
      let golfer = existingGolfers.find(
        (g) => g.name.toLowerCase() === name.toLowerCase()
      )

      if (!golfer) {
        golfer = {
          id: crypto.randomUUID(),
          name,
          worldRanking: null,
          imageUrl: null,
        }
        newGolfers.push(golfer)
        existingGolfers.push(golfer)
      }

      // Create tournament golfer
      const tournamentGolfer: TournamentGolfer = {
        id: crypto.randomUUID(),
        tournamentId,
        golferId: golfer.id,
        group: group as 'A' | 'B' | 'C' | 'D' | 'field',
        odds,
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

    // Save new golfers and tournament golfers
    if (newGolfers.length > 0) {
      saveGolfers(newGolfers)
    }

    if (newTournamentGolfers.length > 0) {
      saveTournamentGolfers(newTournamentGolfers)
    }

    return NextResponse.json({
      message: 'Import completed',
      imported: newTournamentGolfers.length,
      newGolfers: newGolfers.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error importing golfers:', error)
    return NextResponse.json(
      { error: 'Failed to import golfers' },
      { status: 500 }
    )
  }
}
