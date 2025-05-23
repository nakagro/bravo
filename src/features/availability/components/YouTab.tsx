import React from 'react';
import { getRelativeTimeString } from "../../../utils/dateUtils";

interface YouTabProps {
  userStatus: any;
  handleStatusChange: (status: "available" | "delayed response" | "WFH" | "not available") => void;
  isAuthenticated: boolean;
}

const YouTab: React.FC<YouTabProps> = ({
  userStatus,
  handleStatusChange,
  isAuthenticated
}) => {
  // Helper functions for status styling
  const getStatusBackgroundColor = (status: string | undefined) => {
    switch (status) {
      case 'available':
        return 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-600';
      case 'delayed response':
        return 'bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 dark:border-yellow-600';
      case 'WFH':
        return 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-600';
      case 'not available':
        return 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 dark:border-gray-600';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-300 dark:border-gray-700';
    }
  };
  
  const getStatusTextColor = (status: string | undefined) => {
    switch (status) {
      case 'available':
        return 'text-green-800 dark:text-green-300';
      case 'delayed response':
        return 'text-yellow-800 dark:text-yellow-300';
      case 'WFH':
        return 'text-blue-800 dark:text-blue-300';
      case 'not available':
        return 'text-gray-800 dark:text-gray-300';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <>
      {/* Current User Status */}
      <div className="mb-4 rounded overflow-hidden shadow-sm">
        <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium">Your Status is:</h2>
        </div>
        
        {isAuthenticated ? (
          <div className={`p-3 ${getStatusBackgroundColor(userStatus?.currentStatus)}`}>
            {userStatus?.currentStatus ? (
              <>
                <div className={`font-medium text-lg ${getStatusTextColor(userStatus.currentStatus)}`}>
                  {userStatus.currentStatus === 'available' && 'Available'}
                  {userStatus.currentStatus === 'delayed response' && 'Delayed'}
                  {userStatus.currentStatus === 'WFH' && 'Working From Home'}
                  {userStatus.currentStatus === 'not available' && 'Unavailable'}
                </div>
                {userStatus.statusUpdatedAt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Updated: {getRelativeTimeString(userStatus.statusUpdatedAt)}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="font-medium text-lg text-gray-600 dark:text-gray-400">
                  End of day reset
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Your status has been reset. Please set a new status for today.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Please sign in to set your status</p>
          </div>
        )}
      </div>
      
      {/* Status Buttons */}
      {isAuthenticated && (
        <div className="mb-4 p-3 bg-white dark:bg-gray-800 shadow-sm rounded">
          <h3 className="text-lg font-medium mb-3">Update Your Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleStatusChange('available')}
              className={`flex items-center justify-center ${userStatus?.currentStatus === 'available' ? 
                'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-2 border-green-500 dark:border-green-600 shadow-md' : 
                'bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800/50 hover:shadow-md dark:hover:shadow-none'} 
                px-4 py-3 rounded-lg transition-all`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Available
            </button>
            <button
              onClick={() => handleStatusChange('delayed response')}
              className={`flex items-center justify-center ${userStatus?.currentStatus === 'delayed response' ? 
                'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-2 border-yellow-500 dark:border-yellow-600 shadow-md' : 
                'bg-white dark:bg-gray-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-800/50 hover:shadow-md dark:hover:shadow-none'} 
                px-4 py-3 rounded-lg transition-all`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Delayed
            </button>
            <button
              onClick={() => handleStatusChange('WFH')}
              className={`flex items-center justify-center ${userStatus?.currentStatus === 'WFH' ? 
                'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-2 border-blue-500 dark:border-blue-600 shadow-md' : 
                'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800/50 hover:shadow-md dark:hover:shadow-none'} 
                px-4 py-3 rounded-lg transition-all`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              WFH
            </button>
            <button
              onClick={() => handleStatusChange('not available')}
              className={`flex items-center justify-center ${userStatus?.currentStatus === 'not available' ? 
                'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400 border-2 border-gray-500 dark:border-gray-600 shadow-md' : 
                'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-400 border border-gray-300 dark:border-gray-600/50 hover:shadow-md dark:hover:shadow-none'} 
                px-4 py-3 rounded-lg transition-all`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Unavailable
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default YouTab;
