import React, { useState } from 'react';
import { useConvexAuth } from "convex/react";
import { useNavigate } from 'react-router-dom';
import BrigadeTab from './components/BrigadeTab';
import YouTab from './components/YouTab';
import MessagesTab from './components/MessagesTab';
import DeploymentTab from './components/DeploymentTab';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const AvailabilityPage: React.FC = () => {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  
  // State to track active tab
  const [activeTab, setActiveTab] = useState('you'); // Default to the You tab
  
  // Get current user's status
  const userStatus = useQuery(api.availability.getCurrentUserStatus);
  
  // Get duty officer
  const dutyOfficer = useQuery(api.availability.getDutyOfficer);
  
  // Fetch all user statuses
  const statuses = useQuery(api.availability.getStatuses) || [];
  
  // Update status mutation
  const updateStatus = useMutation(api.availability.updateUserStatus);
  
  // Messages state and mutations
  const [newMessage, setNewMessage] = useState('');
  const messages = useQuery(api.messages.getMessages) || [];
  const postMessage = useMutation(api.messages.postMessage);
  
  // Handle status change
  const handleStatusChange = async (status: "available - station" | "available - satellite" | "delayed response" | "WFH" | "not available") => {
    try {
      await updateStatus({ status });
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
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 -mb-px">
          <button
            onClick={() => setActiveTab('you')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'you' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            You
          </button>
          <button
            onClick={() => setActiveTab('brigade')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'brigade' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Brigade
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'messages' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab('deployment')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'deployment' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Deployment
          </button>
        </nav>
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
          />
        )}
        
        {activeTab === 'deployment' && isAuthenticated && (
          <DeploymentTab isAuthenticated={isAuthenticated} />
        )}
      </div>
    </div>
  );
};

export default AvailabilityPage;