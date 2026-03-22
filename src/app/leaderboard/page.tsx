'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import LeaderboardTable from '@/components/LeaderboardTable'
import { LeaderboardEntry, Tournament } from '@/types'
import { RefreshCw } from 'lucide-react'

export default function LeaderboardPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Mock data
  const mockTournament: Tournament = {
    id: 'masters-2026',
    name: '2026 Masters Tournament',
    major: 'masters',
    year: 2026,
    status: 'in_progress',
    entryFee: 50,
    totalPurse: 15000000,
    winningScore: null,
    createdAt: new Date().toISOString(),
  }

  const mockEntries: LeaderboardEntry[] = [
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
    {
      rank: 3,
      entrantName: 'Mike Johnson',
      entrantEmail: 'mike@example.com',
      entryId: '3',
      pickGroupA: {
        name: 'Dustin Johnson',
        score: -4,
        position: 'T25',
        earnings: 50000,
      },
      pickGroupB: {
        name: 'Bryson DeChambeau',
        score: -7,
        position: 'T15',
        earnings: 200000,
      },
      pickGroupC: {
        name: 'Xander Schauffele',
        score: -13,
        position: '2',
        earnings: 2500000,
      },
      pickGroupD: {
        name: 'Cameron Smith',
        score: -5,
        position: 'T12',
        earnings: 150000,
      },
      wildCard1: {
        name: 'Matt Wallace',
        score: 0,
        position: 'T35',
        earnings: 25000,
        doubled: 50000,
      },
      wildCard2: {
        name: 'Tom Kim',
        score: -8,
        position: 'T11',
        earnings: 250000,
        doubled: 500000,
      },
      totalProjectedEarnings: 3475000,
      tiebreaker: -16,
      payout: 2000,
    },
  ]

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      setTournament(mockTournament)
      setEntries(mockEntries)
      setLastUpdated(new Date())
      setLoading(false)
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setLastUpdated(new Date())
      // Would refetch data here
    }, 60000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-[#c4a35a] animate-spin" />
            <p className="ml-3 text-lg text-gray-600">Loading leaderboard...</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-gradient-to-b from-gray-50 to-white">
        <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Leaderboard</h1>
            {tournament && (
              <p className="text-lg text-gray-600">
                {tournament.name} • {tournament.status === 'entries_open' ? 'Entries Open' : tournament.status === 'in_progress' ? 'In Progress' : 'Completed'}
              </p>
            )}
          </div>

          {/* Tournament Status Alert */}
          {tournament?.status === 'entries_open' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <p className="text-blue-900 text-sm">
                <span className="font-semibold">Entry Period Active:</span> Picks will
                be revealed once the tournament starts.
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              {lastUpdated && (
                <p className="text-sm text-gray-600">
                  Last updated:{' '}
                  <span className="font-semibold">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                </p>
              )}
            </div>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#1a472a] cursor-pointer"
              />
              <span className="text-sm text-gray-700">
                Auto-refresh (every 60s)
              </span>
            </label>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-white rounded-lg shadow-md">
            {entries.length > 0 ? (
              <LeaderboardTable entries={entries} paidPositions={8} autoRefresh={autoRefresh} />
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">No entries yet</p>
              </div>
            )}
          </div>

          {/* Stats Footer */}
          {entries.length > 0 && (
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-semibold">Total Entries</p>
                <p className="text-3xl font-bold text-[#1a472a] mt-1">
                  {entries.length}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-semibold">Total Pool</p>
                <p className="text-3xl font-bold text-[#c4a35a] mt-1">
                  ${(entries.length * 50).toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-semibold">Average Score</p>
                <p className="text-3xl font-bold text-[#1a472a] mt-1">
                  ${Math.round(entries.reduce((sum, e) => sum + e.totalProjectedEarnings, 0) / entries.length).toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-semibold">Paid Positions</p>
                <p className="text-3xl font-bold text-[#1a472a] mt-1">Top 8</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
