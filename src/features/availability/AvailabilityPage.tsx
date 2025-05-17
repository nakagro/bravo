import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useNavigate } from 'react-router-dom';
import { api } from "../../../convex/_generated/api";
import { formatDateTime, getRelativeTimeString } from "../../utils/dateUtils";
import StatusBadge from "./StatusBadge";

const AvailabilityPage: React.FC = () => {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  
  // State to track active tab
  const [activeTab, setActiveTab] = useState('brigade'); // Default to the Brigade tab
  
  // Fetch all user statuses
  const statuses = useQuery(api.availability.getStatuses) || [];
  
  // Get current user's status
  const userStatus = useQuery(api.availability.getCurrentUserStatus);
  
  // Get duty officer
  const dutyOfficer = useQuery(api.availability.getDutyOfficer);
  
  // Update status mutation
  const updateStatus = useMutation(api.availability.updateUserStatus);
  
  // Messages state and mutations
  const [newMessage, setNewMessage] = useState('');
  const messages = useQuery(api.messages.getMessages) || [];
  const postMessage = useMutation(api.messages.postMessage);

  // Handle status change
  const handleStatusChange = async (status: "available" | "not available" | "delayed response" | "WFH") => {
    try {
      await updateStatus({ status });
      // The query will automatically refresh due to Convex's reactivity
      // No need to manually refresh the data
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };
  
  // Handle message submission
  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    try {
      await postMessage({ message: newMessage.trim() });
      setNewMessage(''); // Clear the input after posting
    } catch (error) {
      console.error('Error posting message:', error);
    }
  };



  // Filter users who have set a status and sort by availability
  const sortedStatuses = [...statuses]
    .filter(user => user.currentStatus) // Only include users who have set a status
    .sort((a, b) => {
      const statusOrder: Record<string, number> = {
        'available': 1,
        'delayed response': 2,
        'WFH': 3,
        'not available': 4
      };
      
      const statusA = a.currentStatus || 'not available';
      const statusB = b.currentStatus || 'not available';
      
      return (statusOrder[statusA] || 5) - (statusOrder[statusB] || 5);
    });

  // Prevent navigation if status is not set
  useEffect(() => {
    // Only apply navigation prevention if user is authenticated and has no status set
    if (isAuthenticated && userStatus && !userStatus.currentStatus) {
      const preventNavigation = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        
        if (link && !link.pathname.includes('/availability')) {
          event.preventDefault();
          alert('Please set your status before navigating to other pages.');
        }
      };

      document.addEventListener('click', preventNavigation);

      return () => {
        document.removeEventListener('click', preventNavigation);
      };
    }
  }, [userStatus, isAuthenticated]);

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
  
  // Format user display name
  const formatUserName = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.name) {
      return user.name;
    } else {
      return "Unknown User";
    }
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-3">Availability</h1>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
      <button
          className={`py-2 px-4 font-medium ${activeTab === 'you' ? 
            'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 
            'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('you')}
        >
          You
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'brigade' ? 
            'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 
            'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('brigade')}
        >
          Brigade
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'messages' ? 
            'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 
            'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('messages')}
        >
          Messages
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'brigade' && (
        <>
          {/* Duty Officer Section */}
          <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm p-3 rounded">
            <h2 className="text-xl font-bold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Duty Officer
            </h2>
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-800/30">
              <p className="text-lg font-medium text-red-700 dark:text-red-400">
                {dutyOfficer ? formatUserName(dutyOfficer) : 'None assigned'}
              </p>
            </div>
          </div>
          
          {/* Brigade Members Status */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Brigade Members
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">{sortedStatuses.length} {sortedStatuses.length === 1 ? 'member' : 'members'} with status set</span>
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">Member</th>
                <th className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedStatuses.length > 0 ? (
                sortedStatuses.map((user) => {
                  // Get row background color based on status
                  const getRowColor = (status: string | undefined) => {
                    switch (status) {
                      case 'available':
                        return 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40 border-l-4 border-green-500 dark:border-green-600';
                      case 'delayed response':
                        return 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600';
                      case 'WFH':
                        return 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-l-4 border-blue-500 dark:border-blue-600';
                      case 'not available':
                        return 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/60 border-l-4 border-gray-400 dark:border-gray-600';
                      default:
                        return 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
                    }
                  };
                  
                  // Get text color based on status
                  const getTextColor = (status: string | undefined) => {
                    switch (status) {
                      case 'available':
                        return 'text-green-800 dark:text-green-300 font-medium';
                      case 'delayed response':
                        return 'text-yellow-800 dark:text-yellow-300 font-medium';
                      case 'WFH':
                        return 'text-blue-800 dark:text-blue-300 font-medium';
                      case 'not available':
                        return 'text-gray-800 dark:text-gray-300 font-medium';
                      default:
                        return '';
                    }
                  };
                  
                  // Extract the border classes from getRowColor for the first cell
                  const rowColorClasses = getRowColor(user.currentStatus);
                  const bgColorClass = rowColorClasses.split(' ').filter(cls => cls.startsWith('bg-') || cls.startsWith('hover:bg-') || cls.startsWith('dark:bg-') || cls.startsWith('dark:hover:bg-')).join(' ');
                  const borderClasses = rowColorClasses.split(' ').filter(cls => cls.startsWith('border-')).join(' ');
                  
                  return (
                    <tr key={user._id} className={`${bgColorClass} transition-colors`}>
                      <td className={`p-3 ${borderClasses}`}>
                        <div className="font-medium">{formatUserName(user)}</div>
                      </td>
                      <td className="p-3">
                        <div className={`font-medium ${getTextColor(user.currentStatus)}`}>
                          {user.currentStatus === 'available' && 'Available'}
                          {user.currentStatus === 'delayed response' && 'Delayed'}
                          {user.currentStatus === 'WFH' && 'WFH'}
                          {user.currentStatus === 'not available' && 'Unavailable'}
                        </div>
                        {user.statusUpdatedAt && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {getRelativeTimeString(user.statusUpdatedAt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
      
      {activeTab === 'you' && (
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
      )}
      
      {activeTab === 'messages' && (
        <div className="bg-white dark:bg-gray-800 shadow-sm p-4 rounded">
          <h3 className="text-lg font-medium mb-3">Messages</h3>
          
          {isAuthenticated ? (
            <>
              {/* Message Input Form */}
              <form onSubmit={handleMessageSubmit} className="mb-4 flex">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  maxLength={150}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`px-4 py-2 rounded-r-md font-medium ${!newMessage.trim() ? 
                    'bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400 cursor-not-allowed' : 
                    'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'}`}
                >
                  Post
                </button>
              </form>
              
              {/* Messages List */}
              <div className="space-y-3">
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <div key={message._id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {message.user.firstName && message.user.lastName
                            ? `${message.user.firstName} ${message.user.lastName}`
                            : message.user.name || "Unknown User"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getRelativeTimeString(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{message.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    No messages yet.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              Please sign in to view and post messages.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AvailabilityPage;
