import React, { useState, useEffect, useRef } from 'react';
import { useConvexAuth } from "convex/react";
import { useNavigate } from 'react-router-dom';
import BrigadeTab from './components/BrigadeTab';
import YouTab from './components/YouTab';
import MessagesTab from './components/MessagesTab';
import DeploymentTab from './components/DeploymentTab';
import AdminTab from './components/AdminTab';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const MESSAGES_LAST_VIEWED_KEY = 'availability_messages_last_viewed';

const AvailabilityPage: React.FC = () => {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  
  // State to track active tab
  const [activeTab, setActiveTab] = useState('you'); // Default to the You tab
  
  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  
  // State to track when user last viewed messages (loaded from localStorage)
  const [lastViewedMessagesAt, setLastViewedMessagesAt] = useState<number>(() => {
    const stored = localStorage.getItem(MESSAGES_LAST_VIEWED_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  
  // Get current user's status
  const userStatus = useQuery(api.availability.getCurrentUserStatus);
  
  // Get duty officer
  const dutyOfficer = useQuery(api.availability.getDutyOfficer);
  
  // Fetch all user statuses (using raw query without time filtering)
  const statuses = useQuery(api.availability.getAllUsersStatus) || [];
  
  // Update status mutation
  const updateStatus = useMutation(api.availability.updateUserStatus);
  
  // Messages state and mutations
  const [newMessage, setNewMessage] = useState('');
  const messages = useQuery(api.messages.getMessages) || [];
  const postMessage = useMutation(api.messages.postMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const updateMessage = useMutation(api.messages.updateMessage);
  const currentUserId = useQuery(api.messages.getCurrentUserId);
  
  // Get unread message count
  const unreadCount = useQuery(api.messages.getUnreadMessageCount, { 
    lastViewedAt: lastViewedMessagesAt 
  }) || 0;
  
  // Check permission for admin tab (uses batched query shared with ProtectedRoute)
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const hasAdminTabAccess = moduleAccess?.availabilityAdmin;
  
  // Redirect away from admin tab if user doesn't have access
  React.useEffect(() => {
    if (activeTab === 'admin' && hasAdminTabAccess === false) {
      setActiveTab('you'); // Redirect to default tab
    }
  }, [activeTab, hasAdminTabAccess]);
  
  // Update last viewed timestamp when Messages tab is opened
  useEffect(() => {
    if (activeTab === 'messages') {
      const now = Date.now();
      setLastViewedMessagesAt(now);
      localStorage.setItem(MESSAGES_LAST_VIEWED_KEY, now.toString());
    }
  }, [activeTab]);
  
  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab, hasAdminTabAccess]);
  
  // Handle status change
  const handleStatusChange = async (status: string, durationHours?: number, nextStatus?: string) => {
    try {
      await updateStatus({ status: status as any, durationHours, nextStatus: nextStatus as any });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };
  
  // Handle duty officer change
  const handleDutyOfficerChange = async (userId: string) => {
    try {
      // Using any to bypass TypeScript error since the API might accept dutyOfficerId
      // but the type definition doesn't include it
      await updateStatus({ status: userStatus?.currentStatus || "available - station", dutyOfficerId: userId } as any);
    } catch (error) {
      console.error("Error updating duty officer:", error);
    }
  };
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      try {
        await postMessage({ message: newMessage.trim() });
        setNewMessage('');
      } catch (error) {
        console.error("Error posting message:", error);
      }
    }
  };
  
  // Handle deleting a message
  const handleDeleteMessage = async (messageId: any) => {
    try {
      await deleteMessage({ messageId });
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };
  
  // Handle updating a message
  const handleUpdateMessage = async (messageId: any, message: string) => {
    try {
      await updateMessage({ messageId, message });
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4">Please login to view this page</h2>
        <button 
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4" data-component="AvailabilityPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Availability</h1>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['you'] = el; }}
            onClick={() => setActiveTab('you')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'you' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            You
          </button>
          <button
            ref={(el) => { tabRefs.current['brigade'] = el; }}
            onClick={() => setActiveTab('brigade')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'brigade' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Brigade
          </button>
          <button
            ref={(el) => { tabRefs.current['messages'] = el; }}
            onClick={() => setActiveTab('messages')}
            className={`py-2 px-2 sm:px-3 text-sm relative transition-colors whitespace-nowrap ${
              activeTab === 'messages' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Messages
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            ref={(el) => { tabRefs.current['deployment'] = el; }}
            onClick={() => setActiveTab('deployment')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'deployment' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Deployment
          </button>
          {hasAdminTabAccess && (
            <button
              ref={(el) => { tabRefs.current['admin'] = el; }}
              onClick={() => setActiveTab('admin')}
              className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                activeTab === 'admin' 
                  ? 'text-red-600 dark:text-red-400 font-bold' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
            >
              Admin
            </button>
          )}
        </nav>
        {/* Animated indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>
      
      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'you' && isAuthenticated && (
          <YouTab
            userStatus={userStatus}
            handleStatusChange={handleStatusChange}
            isAuthenticated={isAuthenticated}
          />
        )}
        
        {activeTab === 'brigade' && isAuthenticated && (
          <BrigadeTab
            statuses={statuses}
            dutyOfficer={dutyOfficer}
            handleDutyOfficerChange={handleDutyOfficerChange}
          />
        )}
        
        {activeTab === 'messages' && isAuthenticated && (
          <MessagesTab
            isAuthenticated={isAuthenticated}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            messages={messages}
            handleSendMessage={handleSendMessage}
            currentUserId={currentUserId || null}
            handleDeleteMessage={handleDeleteMessage}
            handleUpdateMessage={handleUpdateMessage}
          />
        )}
        
        {activeTab === 'deployment' && isAuthenticated && (
          <DeploymentTab isAuthenticated={isAuthenticated} />
        )}
        
        {activeTab === 'admin' && isAuthenticated && hasAdminTabAccess && (
          <AdminTab isAuthenticated={isAuthenticated} />
        )}
      </div>
    </div>
  );
};

export default AvailabilityPage;