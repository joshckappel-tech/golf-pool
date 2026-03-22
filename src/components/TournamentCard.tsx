import Link from 'next/link'
import { Tournament } from '@/types'
import { Users, DollarSign, Trophy } from 'lucide-react'

interface TournamentCardProps {
  tournament: Tournament
  entryCount?: number
  poolTotal?: number
}

export default function TournamentCard({
  tournament,
  entryCount = 0,
  poolTotal = 0,
}: TournamentCardProps) {
  const getStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'setup':
        return 'bg-gray-500'
      case 'entries_open':
        return 'bg-green-600'
      case 'entries_closed':
        return 'bg-blue-500'
      case 'in_progress':
        return 'bg-blue-600'
      case 'completed':
        return 'bg-[#c4a35a]'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: Tournament['status']) => {
    switch (status) {
      case 'setup':
        return 'Setup'
      case 'entries_open':
        return 'Entries Open'
      case 'entries_closed':
        return 'Entries Closed'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      default:
        return status
    }
  }

  const getButtonPath = (status: Tournament['status']) => {
    if (status === 'entries_open') {
      return `/entry?tournament=${tournament.id}`
    }
    return `/leaderboard?tournament=${tournament.id}`
  }

  const getButtonLabel = (status: Tournament['status']) => {
    if (status === 'entries_open') {
      return 'Enter Pool'
    }
    return 'View Leaderboard'
  }

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-gray-200">
      {/* Header with Tournament Name */}
      <div className="bg-[#1a472a] px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-white">{tournament.name}</h3>
            <p className="text-gray-300 text-sm mt-1">
              {tournament.year} • {tournament.major.replace(/_/g, ' ').toUpperCase()}
            </p>
          </div>
          <span
            className={`${getStatusColor(tournament.status)} text-white text-xs font-bold px-3 py-1 rounded-full`}
          >
            {getStatusLabel(tournament.status)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Users className="w-5 h-5 text-[#1a472a]" />
            </div>
            <p className="text-2xl font-bold text-[#1a472a]">{entryCount}</p>
            <p className="text-xs text-gray-600">Entries</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <DollarSign className="w-5 h-5 text-[#1a472a]" />
            </div>
            <p className="text-2xl font-bold text-[#1a472a]">
              ${tournament.entryFee}
            </p>
            <p className="text-xs text-gray-600">Entry Fee</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Trophy className="w-5 h-5 text-[#c4a35a]" />
            </div>
            <p className="text-2xl font-bold text-[#c4a35a]">
              ${poolTotal.toLocaleString()}
            </p>
            <p className="text-xs text-gray-600">Pool Total</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-6 text-sm text-gray-700">
          <p>
            <span className="font-semibold text-[#1a472a]">Tournament Purse:</span>{' '}
            ${tournament.totalPurse.toLocaleString()}
          </p>
          {tournament.winningScore !== null && (
            <p>
              <span className="font-semibold text-[#1a472a]">Winning Score:</span>{' '}
              {tournament.winningScore > 0 ? '+' : ''}
              {tournament.winningScore}
            </p>
          )}
        </div>

        {/* Action Button */}
        <Link
          href={getButtonPath(tournament.status)}
          className="block w-full bg-[#1a472a] text-white text-center py-2 rounded-lg font-semibold hover:bg-[#0f2818] transition-colors"
        >
          {getButtonLabel(tournament.status)}
        </Link>
      </div>
    </div>
  )
}
