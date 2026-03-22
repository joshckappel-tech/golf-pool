import { Trophy, Users, DollarSign } from 'lucide-react'

interface PayoutDisplayProps {
  places: { place: number; amount: number }[]
  totalPool: number
  entryCount: number
  entryFee: number
  adminCut?: number
}

export default function PayoutDisplay({
  places,
  totalPool,
  entryCount,
  entryFee,
  adminCut = 0,
}: PayoutDisplayProps) {
  const totalPayout = places.reduce((sum, p) => sum + p.amount, 0)
  const remaining = totalPool - totalPayout

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md">
      {/* Header */}
      <div className="bg-[#1a472a] text-white px-6 py-4">
        <h3 className="text-lg font-bold">Payout Structure</h3>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6">
        {/* Pool Summary */}
        <div className="grid grid-cols-3 gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Users className="w-4 h-4 text-[#1a472a]" />
              <p className="text-xs font-semibold text-gray-600 uppercase">
                Entries
              </p>
            </div>
            <p className="text-2xl font-bold text-[#1a472a]">{entryCount}</p>
            <p className="text-xs text-gray-600">@ ${entryFee}</p>
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="w-4 h-4 text-[#c4a35a]" />
              <p className="text-xs font-semibold text-gray-600 uppercase">
                Total Pool
              </p>
            </div>
            <p className="text-2xl font-bold text-[#c4a35a]">
              ${totalPool.toLocaleString()}
            </p>
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Trophy className="w-4 h-4 text-[#1a472a]" />
              <p className="text-xs font-semibold text-gray-600 uppercase">
                Paid Out
              </p>
            </div>
            <p className="text-2xl font-bold text-[#1a472a]">
              ${totalPayout.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Places List */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Prize Money by Place
          </p>
          <div className="space-y-1">
            {places.map((place, index) => (
              <div
                key={place.place}
                className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                  place.place === 1
                    ? 'bg-gradient-to-r from-[#c4a35a] to-[#b8935a] text-white font-bold'
                    : place.place <= 3
                      ? 'bg-[#f5f1e8] text-gray-900 font-semibold'
                      : 'bg-gray-50 text-gray-800'
                }`}
              >
                <span>
                  {place.place === 1 && '🥇 '}
                  {place.place === 2 && '🥈 '}
                  {place.place === 3 && '🥉 '}
                  Place {place.place}
                </span>
                <span className="font-bold">
                  ${place.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Cut and Remaining */}
        {adminCut > 0 && (
          <div className="pt-4 border-t border-gray-200 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Admin Cut:</span>
              <span className="font-semibold text-gray-900">
                ${adminCut.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {remaining > 0 && (
          <div className="pt-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Reserve/Remaining:</span>
              <span className="font-semibold text-gray-900">
                ${remaining.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              (held for tiebreaker scenarios)
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <p className="text-xs text-gray-600 text-center">
          Payouts updated automatically as entries are submitted and processed.
        </p>
      </div>
    </div>
  )
}
