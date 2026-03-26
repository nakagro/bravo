import React from 'react';

interface DetailModalProps {
  selectedDetailDate: {
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
  };
  setShowDetailModal: (show: boolean) => void;
}

function DetailModal({
  selectedDetailDate,
  setShowDetailModal
}: DetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white dark:bg-gray-800 rounded shadow-lg max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium">
            Deployment: {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(selectedDetailDate.date))}
          </h3>
          <button 
            onClick={() => setShowDetailModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-3 overflow-y-auto flex-grow">
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium mb-2">Availability Summary</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-full mr-2"></div>
                  <span className="text-sm">Not Available: {selectedDetailDate.counts.notAvailable}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-full mr-2"></div>
                  <span className="text-sm">Local: {selectedDetailDate.counts.local}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-full mr-2"></div>
                  <span className="text-sm">Short Haul: {selectedDetailDate.counts.shortHaul}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-400 dark:border-orange-700 rounded-full mr-2"></div>
                  <span className="text-sm">Long Haul: {selectedDetailDate.counts.longHaul}</span>
                </div>
              </div>
            </div>
            
            <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium mb-2">Total Members</h4>
              <div className="text-lg font-bold">{selectedDetailDate.counts.total}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedDetailDate.counts.total - selectedDetailDate.counts.notAvailable} available for deployment
              </div>
            </div>
          </div>
          
          <h4 className="text-sm font-medium mb-2">Member Details</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Not Available</th>
                  <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Local</th>
                  <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Short Haul</th>
                  <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Long Haul</th>
                  <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {selectedDetailDate.users.map((user) => {
                  const userName = user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.name || "Unknown User";
                  
                  return (
                    <tr key={user.userId}>
                      <td className="p-2">
                        <div className="text-sm font-medium">{userName}</div>
                      </td>
                      <td className="p-2 text-center">
                        {user.availability.notAvailable ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 dark:text-red-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {user.availability.local ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 dark:text-green-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {user.availability.shortHaul ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {user.availability.longHaul ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600 dark:text-orange-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                      </td>
                      <td className="p-2">
                        {user.message && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">{user.message}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailModal;
