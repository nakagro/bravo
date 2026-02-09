import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AdminTabProps {
  isAuthenticated: boolean;
}

const AdminTab: React.FC<AdminTabProps> = ({ isAuthenticated }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomInput, setShowCustomInput] = useState<string | null>(null); // Track which appliance is showing custom input

  const applianceLocations = useQuery(api.applianceLocations.getApplianceLocationsWithUsers) || [];
  const allLocations = useQuery(api.applianceLocations.getAllLocations) || [];
  const updateApplianceLocation = useMutation(api.applianceLocations.updateApplianceLocation);
  const usersWithScheduledChanges = useQuery(api.availability.getUsersWithScheduledChanges) || [];

  // Create a map for easy lookup
  const locationMap = applianceLocations.reduce((acc, location) => {
    acc[location.applianceName] = location.stationLocation;
    return acc;
  }, {} as Record<string, string>);

  const appliances = ['Pumper', 'Tanker', 'FCV'] as const;
  const primaryStations = ['Main Station', 'Satellite Station'] as const;

  // Format user display name
  const formatUserName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user?.name) {
      return user.name;
    } else {
      return "Unknown User";
    }
  };

  const handleLocationUpdate = async (applianceName: typeof appliances[number], newLocation: string) => {
    setIsUpdating(true);

    try {
      await updateApplianceLocation({
        applianceName,
        stationLocation: newLocation,
      });
      toast.success(`${applianceName} location updated to ${newLocation}`, {
        description: 'The appliance location has been successfully changed.',
      });
      setShowCustomInput(null);
      setCustomLocation('');
    } catch (error) {
      console.error('Error updating appliance location:', error);
      toast.error('Failed to update appliance location', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomLocationSubmit = async (applianceName: typeof appliances[number]) => {
    if (!customLocation.trim()) {
      toast.error('Please enter a location name');
      return;
    }
    await handleLocationUpdate(applianceName, customLocation.trim());
  };

  // Helper functions for scheduled status changes
  const statusInfo: Record<string, { label: string; textColor: string }> = {
    'available - station': {
      label: 'Available - Station',
      textColor: 'text-green-800 dark:text-green-300'
    },
    'available - satellite': {
      label: 'Available - Satellite',
      textColor: 'text-green-700 dark:text-green-400'
    },
    'delayed response': {
      label: 'Delayed Response',
      textColor: 'text-yellow-800 dark:text-yellow-300'
    },
    'WFH': {
      label: 'Working From Home',
      textColor: 'text-blue-800 dark:text-blue-300'
    },
    'not available': {
      label: 'Not Available',
      textColor: 'text-gray-800 dark:text-gray-300'
    },
    'reset': {
      label: 'Available (Reset)',
      textColor: 'text-green-800 dark:text-green-300'
    }
  };

  const getStatusDisplayName = (status: string) => {
    return statusInfo[status]?.label || status;
  };

  const getStatusTextColor = (status: string) => {
    return statusInfo[status]?.textColor || 'text-gray-800 dark:text-gray-300';
  };

  const formatTimeRemaining = (expiresAt: number) => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    } else if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatDurationHours = (durationHours: number) => {
    const totalMinutes = Math.round(durationHours * 60);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    
    if (days > 0) {
      if (hours > 0 && minutes > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${days}d ${hours}h`;
      if (minutes > 0) return `${days}d ${minutes}m`;
      return `${days}d`;
    } else if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };



  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Please log in to access admin features.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Appliance Location Management */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <Accordion type="single" collapsible defaultValue="appliance-locations">
          <AccordionItem value="appliance-locations" className="border-none">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <h2 className="text-xl font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Appliance Locations
              </h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {applianceLocations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No appliance locations found. Please run the initialization function via the Convex dashboard to set up default locations.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Function: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">applianceLocations:initializeApplianceLocations</code>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {appliances.map((appliance) => {
              const currentLocation = locationMap[appliance] || 'Unknown';
              const locationData = applianceLocations.find(loc => loc.applianceName === appliance);
              
              return (
                <div key={appliance} className="py-4 first:pt-0">
                  {/* Mobile-first responsive layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Appliance info section */}
                    <div className="flex items-center">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg">{appliance}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Currently at: <span className="font-medium">{currentLocation}</span>
                        </p>
                        {locationData && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Last updated: {getRelativeTimeString(locationData.updatedAt)} by{' '}
                            <span className="font-medium">
                              {formatUserName(locationData.updatedByUser)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Buttons section - full width on mobile, compact on desktop */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:flex-shrink-0">
                        {/* Primary stations */}
                        {primaryStations.map((station) => (
                          <button
                            key={station}
                            onClick={() => handleLocationUpdate(appliance, station)}
                            disabled={isUpdating || currentLocation === station}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto ${
                              currentLocation === station
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 cursor-default'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                          >
                            <span className="flex items-center justify-center">
                              {station}
                              {currentLocation === station && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                          </button>
                        ))}
                        
                        {/* Custom locations */}
                        {allLocations
                          .filter(loc => !primaryStations.includes(loc as any))
                          .map((location) => (
                            <button
                              key={location}
                              onClick={() => handleLocationUpdate(appliance, location)}
                              disabled={isUpdating || currentLocation === location}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto ${
                                currentLocation === location
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 cursor-default'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              <span className="flex items-center justify-center">
                                {location}
                                {currentLocation === location && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          ))}
                      </div>
                      
                      {/* Custom location input */}
                      {showCustomInput === appliance ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={customLocation}
                            onChange={(e) => setCustomLocation(e.target.value)}
                            placeholder="Enter custom location..."
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomLocationSubmit(appliance);
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCustomLocationSubmit(appliance)}
                              disabled={isUpdating || !customLocation.trim()}
                              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Set
                            </button>
                            <button
                              onClick={() => {
                                setShowCustomInput(null);
                                setCustomLocation('');
                              }}
                              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowCustomInput(appliance)}
                          disabled={isUpdating}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                        >
                          + Add Custom Location
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Scheduled Status Changes */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <Accordion type="single" collapsible defaultValue="scheduled-changes">
          <AccordionItem value="scheduled-changes" className="border-none">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <h2 className="text-xl font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Scheduled Status Changes
                {usersWithScheduledChanges.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({usersWithScheduledChanges.length})
                  </span>
                )}
              </h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {usersWithScheduledChanges.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    No members have scheduled status changes at this time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {usersWithScheduledChanges.map((user) => (
                    <div key={user._id} className="py-4 first:pt-0">
                      {/* User name */}
                      <div className="font-semibold text-lg mb-2">
                        {formatUserName(user)}
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {/* When status was set */}
                        {user.statusUpdatedAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-gray-600 dark:text-gray-400 min-w-[120px]">Status Set:</span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {formatDateTime(user.statusUpdatedAt)}
                            </span>
                          </div>
                        )}

                        {/* Current status */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-[120px]">Current Status:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {user.currentStatus ? getStatusDisplayName(user.currentStatus) : 'Not Set'}
                          </span>
                        </div>
                        
                        {/* Duration info */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-[120px]">Duration:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatDurationHours(user.statusDurationHours)}
                          </span>
                        </div>

                        {/* Time remaining */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-[120px]">Time Remaining:</span>
                          <span className="font-medium text-purple-600 dark:text-purple-400">
                            {formatTimeRemaining(user.statusExpiresAt)}
                          </span>
                        </div>
                        
                        {/* Next status */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-[120px]">Changes To:</span>
                          <span className={`font-medium ${getStatusTextColor(user.nextStatus)}`}>
                            {getStatusDisplayName(user.nextStatus)}
                          </span>
                        </div>
                        
                        {/* Change time */}
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-[120px]">At:</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {formatDateTime(user.nextStatusAt)}
                          </span>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default AdminTab;
