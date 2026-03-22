'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { Edit2, Plus, Download, Trash2, CheckCircle, Circle } from 'lucide-react'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    'tournaments' | 'golfers' | 'entries' | 'scores' | 'payouts'
  >('tournaments')
  const [editingId, setEditingId] = useState<string | null>(null)

  const mockTournaments = [
    {
      id: '1',
      name: '2026 Masters',
      status: 'in_progress' as const,
      entries: 24,
      entryFee: 50,
    },
    {
      id: '2',
      name: '2026 PGA Championship',
      status: 'setup' as const,
      entries: 0,
      entryFee: 50,
    },
  ]

  const mockGolfers = [
    { id: '1', name: 'Scottie Scheffler', group: 'A', odds: '5/1' },
    { id: '2', name: 'Rory McIlroy', group: 'A', odds: '8/1' },
    { id: '3', name: 'Jon Rahm', group: 'B', odds: '12/1' },
    { id: '4', name: 'Collin Morikawa', group: 'C', odds: '15/1' },
  ]

  const mockEntries = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      tournament: 'Masters',
      paid: true,
      amount: 50,
    },
    {
      id: '2',
      name: 'Jane Doe',
      email: 'jane@example.com',
      tournament: 'Masters',
      paid: false,
      amount: 50,
    },
  ]

  return (
    <>
      <Header />
      <main className="flex-1 bg-gradient-to-b from-gray-50 to-white">
        <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage tournaments, golfers, and entries</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-2 mb-6 overflow-x-auto border-b border-gray-200">
            {[
              { id: 'tournaments', label: 'Tournaments' },
              { id: 'golfers', label: 'Golfers' },
              { id: 'entries', label: 'Entries' },
              { id: 'scores', label: 'Scores' },
              { id: 'payouts', label: 'Payouts' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as typeof activeTab)
                }
                className={`px-4 py-3 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#1a472a] text-[#1a472a]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-md">
            {/* Tournaments Tab */}
            {activeTab === 'tournaments' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Manage Tournaments
                  </h2>
                  <button className="flex items-center space-x-2 bg-[#1a472a] text-white px-4 py-2 rounded-lg hover:bg-[#0f2818]">
                    <Plus className="w-5 h-5" />
                    <span>New Tournament</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Entries
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Entry Fee
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {mockTournaments.map((tournament) => (
                        <tr key={tournament.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {tournament.name}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                tournament.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {tournament.status === 'in_progress'
                                ? 'In Progress'
                                : 'Setup'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {tournament.entries}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            ${tournament.entryFee}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-blue-600 hover:text-blue-900 mr-4">
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button className="text-red-600 hover:text-red-900">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Golfers Tab */}
            {activeTab === 'golfers' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Manage Golfers</h2>
                  <div className="flex space-x-2">
                    <button className="flex items-center space-x-2 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300">
                      <Download className="w-5 h-5" />
                      <span>Import</span>
                    </button>
                    <button className="flex items-center space-x-2 bg-[#1a472a] text-white px-4 py-2 rounded-lg hover:bg-[#0f2818]">
                      <Plus className="w-5 h-5" />
                      <span>Add Golfer</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mockGolfers.map((golfer) => (
                    <div
                      key={golfer.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-gray-900">{golfer.name}</p>
                          <p className="text-sm text-gray-600">
                            Group {golfer.group} • Odds: {golfer.odds}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-[#1a472a] text-white text-xs font-bold rounded">
                          {golfer.group}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button className="flex-1 text-blue-600 hover:text-blue-900 text-sm font-semibold">
                          Edit
                        </button>
                        <button className="flex-1 text-red-600 hover:text-red-900 text-sm font-semibold">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entries Tab */}
            {activeTab === 'entries' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Manage Entries
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Total Entries
                      </p>
                      <p className="text-2xl font-bold text-blue-900">
                        {mockEntries.length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Paid
                      </p>
                      <p className="text-2xl font-bold text-green-900">
                        {mockEntries.filter((e) => e.paid).length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Unpaid
                      </p>
                      <p className="text-2xl font-bold text-red-900">
                        {mockEntries.filter((e) => !e.paid).length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-[#c4a35a] to-[#b8935a] rounded-lg p-4">
                      <p className="text-xs text-gray-600 uppercase font-semibold">
                        Total Revenue
                      </p>
                      <p className="text-2xl font-bold text-[#1a472a]">
                        $
                        {(
                          mockEntries.reduce(
                            (sum, e) => sum + (e.paid ? e.amount : 0),
                            0
                          ) + 50
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Tournament
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {mockEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {entry.name}
                          </td>
                          <td className="px-6 py-4 text-gray-600">{entry.email}</td>
                          <td className="px-6 py-4 text-gray-600">
                            {entry.tournament}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              {entry.paid ? (
                                <>
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                  <span className="text-sm font-semibold text-green-600">
                                    Paid
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-5 h-5 text-red-600" />
                                  <span className="text-sm font-semibold text-red-600">
                                    Pending
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!entry.paid && (
                              <button className="text-blue-600 hover:text-blue-900 text-sm font-semibold">
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Scores Tab */}
            {activeTab === 'scores' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Manage Scores
                  </h2>
                  <button className="bg-[#1a472a] text-white px-4 py-2 rounded-lg hover:bg-[#0f2818]">
                    Refresh ESPN Data
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Manual Score Override
                    </p>
                    <p className="text-sm text-blue-800 mb-4">
                      Update individual golfer scores manually if needed.
                    </p>
                    <button className="text-blue-600 hover:text-blue-900 font-semibold text-sm">
                      Override Scores
                    </button>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900 mb-2">
                      ESPN Data Sync
                    </p>
                    <p className="text-sm text-green-800 mb-4">
                      Last synced: 2 minutes ago
                    </p>
                    <button className="text-green-600 hover:text-green-900 font-semibold text-sm">
                      Sync Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payouts Tab */}
            {activeTab === 'payouts' && (
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Payout Calculator
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 uppercase font-semibold mb-2">
                      Total Entries
                    </p>
                    <input
                      type="number"
                      defaultValue="24"
                      className="w-full text-3xl font-bold border-b-2 border-[#1a472a] focus:outline-none"
                    />
                  </div>

                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 uppercase font-semibold mb-2">
                      Entry Fee
                    </p>
                    <input
                      type="number"
                      defaultValue="50"
                      className="w-full text-3xl font-bold border-b-2 border-[#1a472a] focus:outline-none"
                    />
                  </div>

                  <div className="bg-[#c4a35a] text-white rounded-lg p-4">
                    <p className="text-sm uppercase font-semibold mb-2 opacity-90">
                      Total Pool
                    </p>
                    <p className="text-3xl font-bold">$1,200</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900 mb-4">Prize Distribution</h3>
                  {[
                    { place: 1, percentage: 40 },
                    { place: 2, percentage: 25 },
                    { place: 3, percentage: 15 },
                    { place: 4, percentage: 8 },
                    { place: 5, percentage: 5 },
                    { place: 6, percentage: 4 },
                    { place: 7, percentage: 2 },
                    { place: 8, percentage: 1 },
                  ].map((row) => (
                    <div
                      key={row.place}
                      className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg"
                    >
                      <span className="font-semibold text-gray-900">
                        Place {row.place}
                      </span>
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-600">{row.percentage}%</span>
                        <span className="font-bold text-[#c4a35a]">
                          ${(1200 * (row.percentage / 100)).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
