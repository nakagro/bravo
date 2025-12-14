import React, { useState, useRef, useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import BookingsTab from "../features/bookings/components/BookingsTab";
import AdminTab from "../features/bookings/components/AdminTab";
import ScheduleTab from "../features/bookings/components/ScheduleTab";
import { Badge } from "@/components/ui/badge";

export function BookingsPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read tab from URL params, default to 'bookings'
  const tabFromUrl = searchParams.get('tab');
  const dateFromUrl = searchParams.get('date');
  const [activeTab, setActiveTab] = useState(tabFromUrl === 'schedule' || tabFromUrl === 'admin' ? tabFromUrl : 'bookings');
  
  // Sync tab state with URL params on mount and when URL changes
  React.useEffect(() => {
    if (tabFromUrl && (tabFromUrl === 'bookings' || tabFromUrl === 'schedule' || tabFromUrl === 'admin')) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  // Update URL when tab changes (without the date param to keep URL clean after navigation)
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams(tab === 'bookings' ? {} : { tab });
  };
  
  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  
  const currentUser = useQuery(api.auth.loggedInUser);
  const myBookings = useQuery(api.bookings.getMyBookings);
  const pendingApprovals = useQuery(api.bookings.getPendingApprovalsForMe);
  
  const isAdmin = currentUser?.isAdmin || false;
  const bookingCount = myBookings?.length ?? 0;
  const pendingCount = pendingApprovals?.length ?? 0;
  
  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab, isAdmin]);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4">Please login to view this page</h2>
        <button 
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-component="BookingsPage">
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
          {/* {myBookings !== undefined && (
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {bookingCount} {bookingCount === 1 ? 'booking' : 'bookings'}
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="destructive" className="bg-red-600 dark:bg-red-500 text-white">
              {pendingCount} pending
            </Badge>
          )} */}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['bookings'] = el; }}
            onClick={() => handleTabChange('bookings')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'bookings' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            My Bookings
          </button>
          <button
            ref={(el) => { tabRefs.current['schedule'] = el; }}
            onClick={() => handleTabChange('schedule')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'schedule' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Schedule
          </button>
          {isAdmin && (
            <button
              ref={(el) => { tabRefs.current['admin'] = el; }}
              onClick={() => handleTabChange('admin')}
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
        {activeTab === 'bookings' && (
          <BookingsTab isAuthenticated={isAuthenticated} />
        )}
        
        {activeTab === 'schedule' && (
          <ScheduleTab isAuthenticated={isAuthenticated} isAdmin={isAdmin} initialDate={dateFromUrl || undefined} />
        )}
        
        {activeTab === 'admin' && isAdmin && (
          <AdminTab isAuthenticated={isAuthenticated} />
        )}
      </div>
    </div>
  );
}
