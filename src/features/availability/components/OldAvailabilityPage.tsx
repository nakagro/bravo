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
  
  // State for deployment availability
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deploymentDates, setDeploymentDates] = useState<Date[]>([]);
  const [deploymentAvailability, setDeploymentAvailability] = useState<{[key: string]: {notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean}}>({});
  
  // State for detailed view modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailDate, setSelectedDetailDate] = useState<{
    date: number, 
    counts: {
      notAvailable: number,
      local: number,
      shortHaul: number,
      longHaul: number,
      total: number
    },
    users: Array<{
      userId: string,
      name?: string,
      firstName?: string,
      lastName?: string,
      availability: {
        notAvailable: boolean,
        local: boolean,
        shortHaul: boolean,
        longHaul: boolean
      }
    }>
  } | null>(null);
  
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
  
  // Deployment availability mutations and queries
  const updateDeploymentAvailability = useMutation(api.deploymentAvailability.updateDeploymentAvailability);
  
  // Calculate the date range for deployment availability (today + 6 days)
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    setDeploymentDates(dates);
    setSelectedDate(today); // Default to today
  }, []);
  
  // Fetch current user's deployment availability when dates are set
  const startDate = deploymentDates.length > 0 ? deploymentDates[0].getTime() : 0;
  const endDate = deploymentDates.length > 0 ? deploymentDates[deploymentDates.length - 1].getTime() : 0;
  
  const userDeploymentAvailability = useQuery(
    api.deploymentAvailability.getCurrentUserDeploymentAvailability,
    startDate && endDate ? { startDate, endDate } : "skip"
  ) || [];
  
  // Fetch aggregated deployment availability for brigade view
  const [showBrigadeView, setShowBrigadeView] = useState(false);
  const aggregatedDeploymentAvailability = useQuery(
    api.deploymentAvailability.getAggregatedDeploymentAvailability,
    startDate && endDate && showBrigadeView ? { startDate, endDate } : "skip"
  ) || [];
  
  // Format the deployment availability data for easier access
  useEffect(() => {
    if (userDeploymentAvailability.length > 0) {
      const formattedAvailability: {[key: string]: {notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean}} = {};
      
      userDeploymentAvailability.forEach(record => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
        formattedAvailability[dateKey] = record.availability;
      });
      
      setDeploymentAvailability(formattedAvailability);
    }
  }, [userDeploymentAvailability]);
  
  // Handle deployment availability change
  const handleDeploymentAvailabilityChange = async (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean) => {
    if (!date) return;
    
    const dateKey = date.toISOString().split('T')[0];
    const midnight = new Date(date).setHours(0, 0, 0, 0);
    
    // Get current availability for this date
    let currentAvailability = deploymentAvailability[dateKey] || {
      notAvailable: false,
      local: false,
      shortHaul: false,
      longHaul: false
    };
    
    let newAvailability;
    
    if (field === 'notAvailable' && value) {
      // If setting notAvailable to true, set all others to false
      newAvailability = {
        notAvailable: true,
        local: false,
        shortHaul: false,
        longHaul: false
      };
    } else if (field === 'notAvailable' && !value) {
      // If setting notAvailable to false, keep the rest as is
      newAvailability = {
        ...currentAvailability,
        notAvailable: false
      };
    } else if (currentAvailability.notAvailable) {
      // If notAvailable is true and trying to set another field, don't allow it
      return;
    } else {
      // Otherwise, update the specific field
      newAvailability = {
        ...currentAvailability,
        [field]: value
      };
    }
    
    // Update local state
    setDeploymentAvailability(prev => ({
      ...prev,
      [dateKey]: newAvailability
    }));
    
    // Send update to server
    try {
      await updateDeploymentAvailability({
        date: midnight,
        availability: newAvailability
      });
    } catch (error) {
      console.error('Error updating deployment availability:', error);
      // Revert local state on error
      setDeploymentAvailability(prev => ({
        ...prev,
        [dateKey]: currentAvailability
      }));
    }
  };

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
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'deployment' ? 
            'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400' : 
            'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`}
          onClick={() => setActiveTab('deployment')}
        >
          Deployment
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
      
      {activeTab === 'deployment' && isAuthenticated && (
        <div className="bg-white dark:bg-gray-800 shadow-sm p-4 rounded">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">Deployment Availability</h3>
            {/* Toggle button for personal/brigade view */}
            <button
              onClick={() => setShowBrigadeView(!showBrigadeView)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                showBrigadeView 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {showBrigadeView ? 'Show Your Availability' : 'Show Brigade View'}
            </button>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const newStartDate = new Date(startDate);
                  newStartDate.setDate(newStartDate.getDate() - 7);
                  
                  const dates = [];
                  for (let i = 0; i < 7; i++) {
                    const date = new Date(newStartDate);
                    date.setDate(newStartDate.getDate() + i);
                    dates.push(date);
                  }
                  
                  setDeploymentDates(dates);
                }}
                className="p-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Previous week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {deploymentDates.length > 0 && new Date(deploymentDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {deploymentDates.length > 0 && new Date(deploymentDates[6]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <button
                onClick={() => {
                  const newStartDate = new Date(startDate);
                  newStartDate.setDate(newStartDate.getDate() + 7);
                  
                  const dates = [];
                  for (let i = 0; i < 7; i++) {
                    const date = new Date(newStartDate);
                    date.setDate(newStartDate.getDate() + i);
                    dates.push(date);
                  }
                  
                  setDeploymentDates(dates);
                }}
                className="p-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Next week"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {!showBrigadeView ? (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Mark your deployment availability for each day. Select all options that apply or mark as Not Available.
              </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {deploymentDates.map((date) => {
              const dateKey = date.toISOString().split('T')[0];
              const availability = deploymentAvailability[dateKey] || {
                notAvailable: false,
                local: false,
                shortHaul: false,
                longHaul: false
              };
              
              const isToday = new Date().toISOString().split('T')[0] === dateKey;
              const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
              const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
              
              return (
                <div 
                  key={dateKey} 
                  className={`rounded shadow-sm overflow-hidden ${isToday ? 'border-2 border-blue-400 dark:border-blue-600' : 'border border-gray-200 dark:border-gray-700'}`}
                >
                  <div className={`px-2 py-1.5 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}>
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-medium">{dayName}, {formattedDate}</h4>
                      {isToday && (
                        <span className="px-1 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-2 py-1.5 bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-1 gap-1.5">
                      {/* Not Available Button */}
                      <button
                        onClick={() => handleDeploymentAvailabilityChange(date, 'notAvailable', !availability.notAvailable)}
                        className={`flex items-center justify-between px-2 py-1 rounded transition-all ${availability.notAvailable 
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-400 dark:border-red-600' 
                          : 'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-800/50'}`}
                      >
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-1.5 ${availability.notAvailable 
                            ? 'bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium">Not Available</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full border ${availability.notAvailable 
                          ? 'bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600' 
                          : 'border-gray-300 dark:border-gray-600'}`}
                        >
                          {availability.notAvailable && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                      
                      {/* Divider with text */}
                      <div className="relative flex items-center py-0.5">
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        <span className="flex-shrink mx-1 text-[10px] text-gray-400 dark:text-gray-500">OR</span>
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* Local Button */}
                        <button
                          onClick={() => handleDeploymentAvailabilityChange(date, 'local', !availability.local)}
                          disabled={availability.notAvailable}
                          className={`flex flex-col items-center px-1 py-1 rounded transition-all ${availability.local 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-400 dark:border-green-600' 
                            : 'bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-800/50'} 
                            ${availability.notAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${availability.local 
                            ? 'bg-green-200 dark:bg-green-800/50 text-green-700 dark:text-green-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium mt-0.5">Local</span>
                        </button>
                        
                        {/* Short Haul Button */}
                        <button
                          onClick={() => handleDeploymentAvailabilityChange(date, 'shortHaul', !availability.shortHaul)}
                          disabled={availability.notAvailable}
                          className={`flex flex-col items-center px-1 py-1 rounded transition-all ${availability.shortHaul 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-400 dark:border-yellow-600' 
                            : 'bg-white dark:bg-gray-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-800/50'} 
                            ${availability.notAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${availability.shortHaul 
                            ? 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-700 dark:text-yellow-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium mt-0.5">Short</span>
                        </button>
                        
                        {/* Long Haul Button */}
                        <button
                          onClick={() => handleDeploymentAvailabilityChange(date, 'longHaul', !availability.longHaul)}
                          disabled={availability.notAvailable}
                          className={`flex flex-col items-center px-1 py-1 rounded transition-all ${availability.longHaul 
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-400 dark:border-orange-600' 
                            : 'bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-800/50'} 
                            ${availability.notAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${availability.longHaul 
                            ? 'bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium mt-0.5">Long</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-sm">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center px-2 py-1 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-800/30">
                <div className="w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-xs text-red-800 dark:text-red-300">Not Available</span>
              </div>
              
              <div className="inline-flex items-center px-2 py-1 bg-green-50 dark:bg-green-900/10 rounded border border-green-100 dark:border-green-800/30">
                <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <span className="text-xs text-green-800 dark:text-green-300">Local</span>
              </div>
              
              <div className="inline-flex items-center px-2 py-1 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-800/30">
                <div className="w-4 h-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mr-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <span className="text-xs text-yellow-800 dark:text-yellow-300">Short Haul</span>
              </div>
              
              <div className="inline-flex items-center px-2 py-1 bg-orange-50 dark:bg-orange-900/10 rounded border border-orange-100 dark:border-orange-800/30">
                <div className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mr-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" />
                  </svg>
                </div>
                <span className="text-xs text-orange-800 dark:text-orange-300">Long Haul</span>
              </div>
            </div>
            
            <div className="mt-2 flex items-center text-xs text-gray-600 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Select multiple types or mark as Not Available</span>
            </div>
          </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Brigade deployment availability overview for resource planning.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="p-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Not Available</th>
                      <th className="p-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Local</th>
                      <th className="p-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Short Haul</th>
                      <th className="p-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Long Haul</th>
                      <th className="p-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
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
                          <td className="p-2">
                            <div className="text-xs font-medium">{dayName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</div>
                            {isToday && <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Today</div>}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-xs font-medium">{dateData.counts.notAvailable}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-0.5">/{dateData.counts.total}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-xs font-medium">{dateData.counts.local}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-0.5">/{dateData.counts.total}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-xs font-medium">{dateData.counts.shortHaul}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-0.5">/{dateData.counts.total}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center">
                              <span className="text-xs font-medium">{dateData.counts.longHaul}</span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-0.5">/{dateData.counts.total}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <button 
                              onClick={() => {
                                setSelectedDetailDate(dateData);
                                setShowDetailModal(true);
                              }}
                              className="px-2 py-1 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {aggregatedDeploymentAvailability.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-500 dark:text-gray-400">
                          No deployment availability data found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium mb-2">Brigade Availability Summary:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The numbers show how many members are available for each deployment type on each day.
                  Use this information to plan resources for potential deployments.
                </p>
              </div>
            </>
          )}
        </div>
      )}
      
      {activeTab === 'deployment' && !isAuthenticated && (
        <div className="bg-white dark:bg-gray-800 shadow-sm p-4 rounded">
          <p className="text-gray-600 dark:text-gray-400">
            Please sign in to set your deployment availability.
          </p>
        </div>
      )}
      {/* Detailed View Modal */}
      {showDetailModal && selectedDetailDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white dark:bg-gray-800 rounded shadow-lg max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-1.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-medium">
                Deployment: {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(selectedDetailDate.date))}
              </h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-3 overflow-y-auto flex-grow">
              <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-medium mb-1.5">Availability Summary</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-full mr-1.5"></div>
                      <span className="text-xs">Not Available: {selectedDetailDate.counts.notAvailable}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 rounded-full mr-1.5"></div>
                      <span className="text-xs">Local: {selectedDetailDate.counts.local}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-full mr-1.5"></div>
                      <span className="text-xs">Short Haul: {selectedDetailDate.counts.shortHaul}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-orange-100 dark:bg-orange-900/30 border border-orange-400 dark:border-orange-700 rounded-full mr-1.5"></div>
                      <span className="text-xs">Long Haul: {selectedDetailDate.counts.longHaul}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-medium mb-1.5">Total Members</h4>
                  <div className="text-lg font-bold">{selectedDetailDate.counts.total}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedDetailDate.counts.total - selectedDetailDate.counts.notAvailable} available for deployment
                  </div>
                </div>
              </div>
              
              <h4 className="text-xs font-medium mb-1.5">Member Details</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Member</th>
                      <th className="p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Not Available</th>
                      <th className="p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Local</th>
                      <th className="p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Short Haul</th>
                      <th className="p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Long Haul</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedDetailDate.users.map((user) => {
                      const userName = user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.name || "Unknown User";
                      
                      return (
                        <tr key={user.userId}>
                          <td className="p-1.5">
                            <div className="text-xs font-medium">{userName}</div>
                          </td>
                          <td className="p-1.5 text-center">
                            {user.availability.notAvailable ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-600 dark:text-red-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {user.availability.local ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-600 dark:text-green-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {user.availability.shortHaul ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {user.availability.longHaul ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {selectedDetailDate.users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500 dark:text-gray-400">
                          No members have set their availability for this date
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-md font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
