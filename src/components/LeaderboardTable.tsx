'use client'

import { useState, useMemo } from 'react'
import { LeaderboardEntry } from '@/types'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  paidPositions?: number
  autoRefresh?: boolean
}

type SortField =
  | 'rank'
  | 'entrantName'
  | 'totalProjectedEarnings'
  | 'payout'
  | 'tiebreaker'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

export default function LeaderboardTable({
  entries,
  paidPositions = 8,
  autoRefresh = false,
}: LeaderboardTableProps) {
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ field: 'rank', direction: 'asc' })

  const filteredAndSorted = useMemo(() => {
    let filtered = entries.filter((entry) =>
      entry.entrantName.toLowerCase().includes(search.toLowerCase())
    )

    filtered.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sort.field) {
        case 'rank':
          aVal = a.rank
          bVal = b.rank
          break
        case 'entrantName':
          aVal = a.entrantName.toLowerCase()
          bVal = b.entrantName.toLowerCase()
          break
        case 'totalProjectedEarnings':
          aVal = a.totalProjectedEarnings
          bVal = b.totalProjectedEarnings
          break
        case 'payout':
          aVal = a.payout || 0
          bVal = b.payout || 0
          break
        case 'tiebreaker':
          aVal = Math.abs(
            a.tiebreaker - (a.tiebreaker > 0 ? 1 : 0)
          )
          bVal = Math.abs(
            b.tiebreaker - (b.tiebreaker > 0 ? 1 : 0)
          )
          break
        default:
          aVal = a.rank
          bVal = b.rank
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sort.direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return filtered
  }, [entries, search, sort])

  const handleSort = (field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField
    label: string
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 hover:text-[#c4a35a] transition-colors"
    >
      <span>{label}</span>
      {sort.field === field && (
        <span className="text-xs">{sort.direction === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by entrant name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a472a]"
        />
      </div>

      {/* Auto Refresh Toggle */}
      <div className="flex justify-end">
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input
            type="checkbox"
            defaultChecked={autoRefresh}
            disabled
            className="rounded"
          />
          <span>Auto-refresh (60s)</span>
        </label>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          {/* Table Header */}
          <thead className="bg-[#1a472a] text-white sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortHeader field="rank" label="Rank" />
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortHeader field="entrantName" label="Entrant" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold">
                Group A
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold">
                Group B
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold">
                Group C
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold">
                Group D
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold">
                WC1 (2x)
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold">
                WC2 (2x)
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold">
                <SortHeader
                  field="totalProjectedEarnings"
                  label="Projected $"
                />
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold">
                <SortHeader field="tiebreaker" label="TB" />
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold">
                <SortHeader field="payout" label="Payout" />
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold">
                Details
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {filteredAndSorted.map((entry, index) => {
              const isPaid = entry.rank <= paidPositions
              const isExpanded = expandedRow === entry.entryId

              return (
                <div key={entry.entryId}>
                  <tr
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                      isPaid ? 'bg-[#fffbf5]' : ''
                    }`}
                  >
                    <td
                      className={`px-4 py-3 font-bold ${
                        isPaid ? 'text-[#c4a35a]' : 'text-gray-900'
                      }`}
                    >
                      {entry.rank}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {entry.entrantName}
                    </td>

                    {/* Group Scores */}
                    <td className="px-4 py-3 text-center text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.pickGroupA.name}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            entry.pickGroupA.score
                              ? entry.pickGroupA.score > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {entry.pickGroupA.score !== null
                            ? entry.pickGroupA.score > 0
                              ? `+${entry.pickGroupA.score}`
                              : entry.pickGroupA.score
                            : 'E'}
                        </p>
                        <p className="text-xs text-gray-600">
                          ${entry.pickGroupA.earnings.toLocaleString()}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.pickGroupB.name}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            entry.pickGroupB.score
                              ? entry.pickGroupB.score > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {entry.pickGroupB.score !== null
                            ? entry.pickGroupB.score > 0
                              ? `+${entry.pickGroupB.score}`
                              : entry.pickGroupB.score
                            : 'E'}
                        </p>
                        <p className="text-xs text-gray-600">
                          ${entry.pickGroupB.earnings.toLocaleString()}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.pickGroupC.name}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            entry.pickGroupC.score
                              ? entry.pickGroupC.score > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {entry.pickGroupC.score !== null
                            ? entry.pickGroupC.score > 0
                              ? `+${entry.pickGroupC.score}`
                              : entry.pickGroupC.score
                            : 'E'}
                        </p>
                        <p className="text-xs text-gray-600">
                          ${entry.pickGroupC.earnings.toLocaleString()}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.pickGroupD.name}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            entry.pickGroupD.score
                              ? entry.pickGroupD.score > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {entry.pickGroupD.score !== null
                            ? entry.pickGroupD.score > 0
                              ? `+${entry.pickGroupD.score}`
                              : entry.pickGroupD.score
                            : 'E'}
                        </p>
                        <p className="text-xs text-gray-600">
                          ${entry.pickGroupD.earnings.toLocaleString()}
                        </p>
                      </div>
                    </td>

                    {/* Wild Cards */}
                    <td className="px-4 py-3 text-center text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.wildCard1.name}
                        </p>
                        <p className="text-xs font-bold text-[#c4a35a] bg-[#1a472a] inline-block px-1 rounded">
                          2x
                        </p>
                        <p
                          className={`text-xs font-bold mt-1 ${
                            entry.wildCard1.score
                              ? entry.wildCard1.score > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {entry.wildCard1.score !== null
                            ? entry.wildCard1.score > 0
                              ? `+${entry.wildCard1.score}`
                              : entry.wildCard1.score
                            : 'E'}
                        </p>
                        <p className="text-xs text-gray-600">
                          ${entry.wildCard1.doubled.toLocaleString()}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {entry.wildCard2.name}
                        </p>
                        <p className="text-xs font-bold text-[#c4a35a] bg-[#1a472a] inline-block px-1 rounded">
                          2x
                        </p>
                        <p
                          className={`text-xs font-bold mt-1 ${
                            entry.wildCard2.score
                              ? entry.wildCard2.score > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {entry.wildCard2.score !== null
                            ? entry.wildCard2.score > 0
                              ? `+${entry.wildCard2.score}`
                              : entry.wildCard2.score
                            : 'E'}
                        </p>
                        <p className="text-xs text-gray-600">
                          ${entry.wildCard2.doubled.toLocaleString()}
                        </p>
                      </div>
                    </td>

                    {/* Totals */}
                    <td className="px-4 py-3 text-right font-bold text-[#c4a35a]">
                      ${entry.totalProjectedEarnings.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {entry.tiebreaker}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        isPaid ? 'text-[#c4a35a]' : 'text-gray-500'
                      }`}
                    >
                      {entry.payout
                        ? `$${entry.payout.toLocaleString()}`
                        : '—'}
                    </td>

                    {/* Expand Button */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setExpandedRow(
                            isExpanded ? null : entry.entryId
                          )
                        }
                        className="hover:text-[#c4a35a] transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={12} className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-600 uppercase font-semibold">
                                Group A
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.pickGroupA.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Position: {entry.pickGroupA.position || '—'}
                              </p>
                              <p className="text-xs text-gray-600">
                                Score:{' '}
                                {entry.pickGroupA.score !== null
                                  ? entry.pickGroupA.score > 0
                                    ? `+${entry.pickGroupA.score}`
                                    : entry.pickGroupA.score
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 uppercase font-semibold">
                                Group B
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.pickGroupB.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Position: {entry.pickGroupB.position || '—'}
                              </p>
                              <p className="text-xs text-gray-600">
                                Score:{' '}
                                {entry.pickGroupB.score !== null
                                  ? entry.pickGroupB.score > 0
                                    ? `+${entry.pickGroupB.score}`
                                    : entry.pickGroupB.score
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 uppercase font-semibold">
                                Group C
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.pickGroupC.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Position: {entry.pickGroupC.position || '—'}
                              </p>
                              <p className="text-xs text-gray-600">
                                Score:{' '}
                                {entry.pickGroupC.score !== null
                                  ? entry.pickGroupC.score > 0
                                    ? `+${entry.pickGroupC.score}`
                                    : entry.pickGroupC.score
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 uppercase font-semibold">
                                Group D
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.pickGroupD.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Position: {entry.pickGroupD.position || '—'}
                              </p>
                              <p className="text-xs text-gray-600">
                                Score:{' '}
                                {entry.pickGroupD.score !== null
                                  ? entry.pickGroupD.score > 0
                                    ? `+${entry.pickGroupD.score}`
                                    : entry.pickGroupD.score
                                  : '—'}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-600 uppercase font-semibold">
                                Wild Card 1 (2x)
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.wildCard1.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Position: {entry.wildCard1.position || '—'}
                              </p>
                              <p className="text-xs text-gray-600">
                                Score:{' '}
                                {entry.wildCard1.score !== null
                                  ? entry.wildCard1.score > 0
                                    ? `+${entry.wildCard1.score}`
                                    : entry.wildCard1.score
                                  : '—'}
                              </p>
                              <p className="text-xs text-[#c4a35a] font-bold mt-1">
                                2x Multiplier: $
                                {entry.wildCard1.doubled.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 uppercase font-semibold">
                                Wild Card 2 (2x)
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.wildCard2.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Position: {entry.wildCard2.position || '—'}
                              </p>
                              <p className="text-xs text-gray-600">
                                Score:{' '}
                                {entry.wildCard2.score !== null
                                  ? entry.wildCard2.score > 0
                                    ? `+${entry.wildCard2.score}`
                                    : entry.wildCard2.score
                                  : '—'}
                              </p>
                              <p className="text-xs text-[#c4a35a] font-bold mt-1">
                                2x Multiplier: $
                                {entry.wildCard2.doubled.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </div>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredAndSorted.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600">No entries found</p>
        </div>
      )}
    </div>
  )
}
