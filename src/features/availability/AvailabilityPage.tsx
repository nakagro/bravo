import { useState, useEffect, useMemo } from 'react';
import { useConvexAuth } from "convex/react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrigadeTab from './components/BrigadeTab';
import YouTab from './components/YouTab';
import MessagesTab from './components/MessagesTab';
import DeploymentTab from './components/DeploymentTab';
import AdminTab from './components/AdminTab';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageTabs } from "@/components/shared/PageTabs";

type AvailabilityTab = "you" | "brigade" | "messages" | "deployment" | "admin";

function AvailabilityPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  
  // Get unread message count (uses database-stored lastViewedAt for consistency)
  const unreadCount = useQuery(api.messages.getUnreadMessageCount) ?? 0;
  
  // Mutation to mark messages as viewed
  const markMessagesAsViewed = useMutation(api.messages.markMessagesAsViewed);
  
  // Check permission for admin tab (uses batched query shared with ProtectedRoute)
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const hasAdminTabAccess = moduleAccess?.availabilityAdmin;

  const requestedTab = searchParams.get("tab");
  const isKnownTab =
    requestedTab === "you" ||
    requestedTab === "brigade" ||
    requestedTab === "messages" ||
    requestedTab === "deployment" ||
    requestedTab === "admin";
  const activeTab: AvailabilityTab = !requestedTab || !isKnownTab
    ? "you"
    : requestedTab === "admin" && hasAdminTabAccess !== true
      ? "you"
      : (requestedTab as AvailabilityTab);

  // Normalize invalid/unauthorized tab values in the URL
  useEffect(() => {
    if (!requestedTab) return;
    if (isKnownTab && !(requestedTab === "admin" && hasAdminTabAccess === false)) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("tab");
      return next;
    }, { replace: true });
  }, [hasAdminTabAccess, isKnownTab, requestedTab, setSearchParams]);

  const handleTabChange = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "you") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    }, { replace: true });
  };

  const availabilityTabs = useMemo(() => {
    const tabs: Array<{ key: AvailabilityTab; label: string; badgeCount?: number }> = [
      { key: "you", label: "You" },
      { key: "brigade", label: "Brigade" },
      { key: "messages", label: "Messages", badgeCount: unreadCount > 0 ? unreadCount : undefined },
      { key: "deployment", label: "Deployment" },
    ];

    if (hasAdminTabAccess) {
      tabs.push({ key: "admin", label: "Admin" });
    }

    return tabs;
  }, [hasAdminTabAccess, unreadCount]);
  
  // Mark messages as viewed when Messages tab is opened
  useEffect(() => {
    if (activeTab === 'messages' && isAuthenticated) {
      markMessagesAsViewed();
    }
  }, [activeTab, isAuthenticated, markMessagesAsViewed]);
  
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
      
      <PageTabs
        tabs={availabilityTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Availability tabs"
      />
      
      {/* Tab Content */}
      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
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
}

export default AvailabilityPage;
