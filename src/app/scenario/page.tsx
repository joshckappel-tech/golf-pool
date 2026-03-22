'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import ScenarioAdjuster from '@/components/ScenarioAdjuster'
import LeaderboardTable from '@/components/LeaderboardTable'
import { Golfer, TournamentGolfer, LeaderboardEntry } from '@/types'

export default function ScenarioPage() {
  const [adjustments, setAdjustments] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)

  // Mock golfers data
  const mockGolfers: (Golfer & { tournamentGolfer: TournamentGolfer })[] = [
    {
      id: '1',
      name: 'Scottie Scheffler',
      worldRanking: 1,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-1',
        tournamentId: 'masters-2026',
        golferId: '1',
        group: 'A',
        odds: '5/1',
        currentScore: -15,
        currentPosition: '1',
        thru: 'F',
        projectedEarnings: 4500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '2',
      name: 'Rory McIlroy',
      worldRanking: 2,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-2',
        tournamentId: 'masters-2026',
        golferId: '2',
        group: 'A',
        odds: '8/1',
        currentScore: -12,
        currentPosition: '2',
        thru: 'F',
        projectedEarnings: 2500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '3',
      name: 'Xander Schauffele',
      worldRanking: 3,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-3',
        tournamentId: 'masters-2026',
        golferId: '3',
        group: 'B',
        odds: '10/1',
        currentScore: -13,
        currentPosition: '2',
        thru: 'F',
        projectedEarnings: 2500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '4',
      name: 'Jon Rahm',
      worldRanking: 4,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-4',
        tournamentId: 'masters-2026',
        golferId: '4',
        group: 'B',
        odds: '12/1',
        currentScore: -8,
        currentPosition: 'T5',
        thru: 'F',
        projectedEarnings: 500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '5',
      name: 'Collin Morikawa',
      worldRanking: 5,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-5',
        tournamentId: 'masters-2026',
        golferId: '5',
        group: 'C',
        odds: '15/1',
        currentScore: -10,
        currentPosition: '3',
        thru: 'F',
        projectedEarnings: 1500000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
    {
      id: '6',
      name: 'Justin Thomas',
      worldRanking: 6,
      imageUrl: null,
      tournamentGolfer: {
        id: 'tg-6',
        tournamentId: 'masters-2026',
        golferId: '6',
        group: 'C',
        odds: '18/1',
        currentScore: -11,
        currentPosition: 'T4',
        thru: 'F',
        projectedEarnings: 750000,
        finalEarnings: 0,
        isWithdrawn: false,
        isCut: false,
      },
    },
  ]

  const originalLeaderboard: LeaderboardEntry[] = [
    {
      rank: 1,
      entrantName: 'John Smith',
      entrantEmail: 'john@example.com',
      entryId: '1',
      pickGroupA: {
        name: 'Rory McIlroy',
        score: -12,
        position: '2',
        earnings: 2500000,
      },
      pickGroupB: {
        name: 'Jon Rahm',
        score: -8,
        position: 'T5',
        earnings: 500000,
      },
      pickGroupC: {
        name: 'Collin Morikawa',
        score: -10,
        position: '3',
        earnings: 1500000,
      },
      pickGroupD: {
        name: 'Scottie Scheffler',
        score: -15,
        position: '1',
        earnings: 4500000,
      },
      wildCard1: {
        name: 'Jordan Spieth',
        score: -5,
        position: 'T12',
        earnings: 150000,
        doubled: 300000,
      },
      wildCard2: {
        name: 'Patrick Cantlay',
        score: -9,
        position: 'T8',
        earnings: 300000,
        doubled: 600000,
      },
      totalProjectedEarnings: 9900000,
      tiebreaker: -15,
      payout: 5000,
    },
    {
      rank: 2,
      entrantName: 'Jane Doe',
      entrantEmail: 'jane@example.com',
      entryId: '2',
      pickGroupA: {
        name: 'Tiger Woods',
        score: -6,
        position: 'T18',
        earnings: 100000,
      },
      pickGroupB: {
        name: 'Brooks Koepka',
        score: -3,
        position: 'T20',
        earnings: 80000,
      },
      pickGroupC: {
        name: 'Justin Thomas',
        score: -11,
        position: 'T4',
        earnings: 750000,
      },
      pickGroupD: {
        name: 'Sam Burns',
        score: -9,
        position: 'T8',
        earnings: 300000,
      },
      wildCard1: {
        name: 'Viktor Hovland',
        score: -7,
        position: 'T15',
        earnings: 200000,
        doubled: 400000,
      },
      wildCard2: {
        name: 'Hideki Matsuyama',
        score: -4,
        position: 'T25',
        earnings: 50000,
        doubled: 100000,
      },
      totalProjectedEarnings: 1580000,
      tiebreaker: -14,
      payout: 3000,
    },
  ]

  const adjustedLeaderboard: LeaderboardEntry[] = adjustments
    ? [
        {
          ...originalLeaderboard[1],
          rank: 1,
          payout: 5000,
        },
        {
          ...originalLeaderboard[0],
          rank: 2,
          payout: 3000,
        },
      ]
    : originalLeaderboard

  const handleCalculate = async (newAdjustments: Record<string, number>) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setAdjustments(newAdjustments)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-gradient-to-b from-gray-50 to-white">
        <div className="px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="max-w-7xl mx-auto mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Scenario Generator
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Experiment with different tournament outcomes to see how it affects the
              golf pool leaderboard. Adjust golfer positions and see real-time
              leaderboard changes.
            </p>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto">
            {adjustments ? (
              // Two-column layout when adjustments exist
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Original Leaderboard */}
                <div>
                  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Current Results
                    </h2>
                    <p className="text-sm text-gray-600">
                      Actual leaderboard based on current tournament positions
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md">
                    <LeaderboardTable entries={originalLeaderboard} />
                  </div>
                </div>

                {/* Adjusted Leaderboard */}
                <div>
                  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Adjusted Scenario
                    </h2>
                    <p className="text-sm text-gray-600">
                      Leaderboard with your position adjustments applied
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md">
                    <LeaderboardTable entries={adjustedLeaderboard} />
                  </div>
                </div>
              </div>
            ) : (
              // Single column with adjuster
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Adjuster */}
                <div>
                  <div className="sticky top-4">
                    <ScenarioAdjuster
                      golfers={mockGolfers}
                      onCalculate={handleCalculate}
                      loading={loading}
                    />
                  </div>
                </div>

                {/* Current Leaderboard */}
                <div>
                  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Current Leaderboard
                    </h2>
                    <p className="text-sm text-gray-600">
                      Latest results based on current tournament positions
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md">
                    <LeaderboardTable entries={originalLeaderboard} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* How to Use Section */}
          {!adjustments && (
            <div className="max-w-7xl mx-auto mt-12">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-4">How to Use</h3>
                <ol className="space-y-3 text-blue-900 text-sm">
                  <li className="flex space-x-3">
                    <span className="font-bold flex-shrink-0">1.</span>
                    <span>
                      Adjust golfer positions in the left panel. Use the +/- buttons or
                      type a new position directly.
                    </span>
                  </li>
                  <li className="flex space-x-3">
                    <span className="font-bold flex-shrink-0">2.</span>
                    <span>
                      Click "Calculate Scenario" to see how the leaderboard would change
                      with those adjustments.
                    </span>
                  </li>
                  <li className="flex space-x-3">
                    <span className="font-bold flex-shrink-0">3.</span>
                    <span>
                      Compare the current leaderboard with your scenario on the right. See
                      which entries benefit or lose earnings.
                    </span>
                  </li>
                  <li className="flex space-x-3">
                    <span className="font-bold flex-shrink-0">4.</span>
                    <span>
                      Try different scenarios to understand various tournament outcomes and
                      their impact on the pool.
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
