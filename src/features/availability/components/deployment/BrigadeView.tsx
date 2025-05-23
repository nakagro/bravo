import React from 'react';

interface BrigadeViewProps {
  aggregatedDeploymentAvailability: Array<{
    date: number;
    counts: {
      notAvailable: number;
      local: number;
      shortHaul: number;
      longHaul: number;
      total: number;
    };
    users: Array<{
      userId: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      availability: {
        notAvailable: boolean;
        local: boolean;
        shortHaul: boolean;
        longHaul: boolean;
      };
    }>;
  }>;
  setSelectedDetailDate: (date: any) => void;
  setShowDetailModal: (show: boolean) => void;
}

const BrigadeView: React.FC<BrigadeViewProps> = ({
  aggregatedDeploymentAvailability,
  setSelectedDetailDate,
  setShowDetailModal
}) => {
  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Brigade deployment availability overview for resource planning.
      </p>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Not Available</th>
              <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Local</th>
              <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Short Haul</th>
              <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Long Haul</th>
              <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {aggregatedDeploymentAvailability.map((dateData) => {
              const date = new Date(dateData.date);
              const isToday = new Date().toISOString().split('T')[0] === date.toISOString().split('T')[0];
              const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
              const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
              
              return (
                <tr key={dateData.date} className={isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}>
                  <td className="p-3">
                    <div className="text-sm font-medium">{dayName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</div>
                    {isToday && <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Today</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{dateData.counts.notAvailable}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">/{dateData.counts.total}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{dateData.counts.local}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">/{dateData.counts.total}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{dateData.counts.shortHaul}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">/{dateData.counts.total}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{dateData.counts.longHaul}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">/{dateData.counts.total}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <button 
                      onClick={() => {
                        setSelectedDetailDate(dateData);
                        setShowDetailModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default BrigadeView;
