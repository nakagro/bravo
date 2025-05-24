import React, { useState } from 'react';

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
      message?: string;
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
  // State for filters
  const [filters, setFilters] = useState({
    notAvailable: true,
    local: true,
    shortHaul: true,
    longHaul: true
  });

  // State for expanded accordion items
  const [expandedDate, setExpandedDate] = useState<number | null>(null);

  // Toggle filter
  const toggleFilter = (filter: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul') => {
    setFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  // Toggle accordion expansion
  const toggleExpand = (dateTimestamp: number) => {
    setExpandedDate(expandedDate === dateTimestamp ? null : dateTimestamp);
  };

  // Filter users based on selected filters
  const filterUsers = (users: BrigadeViewProps['aggregatedDeploymentAvailability'][0]['users']) => {
    return users.filter(user => {
      // If all filters are off, show everyone
      if (!filters.notAvailable && !filters.local && !filters.shortHaul && !filters.longHaul) {
        return true;
      }
      
      // Check if user matches any active filter
      return (filters.notAvailable && user.availability.notAvailable) ||
             (filters.local && user.availability.local) ||
             (filters.shortHaul && user.availability.shortHaul) ||
             (filters.longHaul && user.availability.longHaul);
    });
  };

  return (
    <div className="flex flex-col">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4 self-center">
        <button
          onClick={() => toggleFilter('notAvailable')}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center ${filters.notAvailable 
            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-400 dark:border-red-600' 
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          <div className={`w-3 h-3 rounded-full mr-1.5 ${filters.notAvailable 
            ? 'bg-red-200 dark:bg-red-800/50' 
            : 'bg-gray-200 dark:bg-gray-700'}`} />
          Not Available
        </button>
        
        <button
          onClick={() => toggleFilter('local')}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center ${filters.local 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-400 dark:border-green-600' 
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          <div className={`w-3 h-3 rounded-full mr-1.5 ${filters.local 
            ? 'bg-green-200 dark:bg-green-800/50' 
            : 'bg-gray-200 dark:bg-gray-700'}`} />
          Local
        </button>
        
        <button
          onClick={() => toggleFilter('shortHaul')}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center ${filters.shortHaul 
            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-400 dark:border-yellow-600' 
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          <div className={`w-3 h-3 rounded-full mr-1.5 ${filters.shortHaul 
            ? 'bg-yellow-200 dark:bg-yellow-800/50' 
            : 'bg-gray-200 dark:bg-gray-700'}`} />
          Short Haul
        </button>
        
        <button
          onClick={() => toggleFilter('longHaul')}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center ${filters.longHaul 
            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-400 dark:border-orange-600' 
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
        >
          <div className={`w-3 h-3 rounded-full mr-1.5 ${filters.longHaul 
            ? 'bg-orange-200 dark:bg-orange-800/50' 
            : 'bg-gray-200 dark:bg-gray-700'}`} />
          Long Haul
        </button>
      </div>

      {/* Accordion layout */}
      <div className="space-y-3">
        {aggregatedDeploymentAvailability.map((dateData) => {
          const date = new Date(dateData.date);
          // No longer highlighting today
          const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
          const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
          const isExpanded = expandedDate === dateData.date;
          const filteredUsers = filterUsers(dateData.users);
          
          return (
            <div key={dateData.date} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Accordion header */}
              <div 
                className="bg-white dark:bg-gray-900 cursor-pointer"
                onClick={() => toggleExpand(dateData.date)}
              >
                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between">
                  {/* Date info */}
                  <div className="flex items-center mb-2 sm:mb-0">
                    <div className="mr-3">
                      <div className="text-sm font-medium">{dayName}, {formattedDate}</div>
                    </div>
                    <div className="ml-auto sm:ml-0">
                      <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Availability counts */}

                </div>
              </div>
              
              {/* Accordion content */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                  {/* View all button */}
                  <div className="flex justify-between items-center mb-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailDate(dateData);
                        setShowDetailModal(true);
                      }}
                      className="px-3 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      View All
                    </button>
                  </div>
                  
                  {/* Member list */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => {
                        const displayName = user.name || 
                          (user.firstName && user.lastName ? `${user.lastName}, ${user.firstName}` : 'Unknown User');
                        
                        return (
                          <div key={user.userId} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <div className="flex flex-col gap-2">
                              <div className="text-sm font-medium">{displayName}</div>
                              <div className="flex flex-wrap gap-1">
                                {user.availability.notAvailable && (
                                  <div className="px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-400 dark:border-red-600">
                                    Not Available
                                  </div>
                                )}
                                {user.availability.local && (
                                  <div className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-400 dark:border-green-600">
                                    Local
                                  </div>
                                )}
                                {user.availability.shortHaul && (
                                  <div className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-400 dark:border-yellow-600">
                                    Short Haul
                                  </div>
                                )}
                                {user.availability.longHaul && (
                                  <div className="px-2 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-400 dark:border-orange-600">
                                    Long Haul
                                  </div>
                                )}
                              </div>
                              
                              {/* Display user message/note if available */}
                              {user.message && user.message.trim() !== "" && (
                                <div className="mt-1 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {user.message}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                        No members match the selected filters
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Empty state */}
      {aggregatedDeploymentAvailability.length === 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">No deployment data available</p>
        </div>
      )}
    </div>
  );
};

export default BrigadeView;
