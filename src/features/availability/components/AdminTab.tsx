import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { toast } from "sonner";

interface AdminTabProps {
  isAuthenticated: boolean;
}

const AdminTab: React.FC<AdminTabProps> = ({ isAuthenticated }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const applianceLocations = useQuery(api.applianceLocations.getApplianceLocationsWithUsers) || [];
  const updateApplianceLocation = useMutation(api.applianceLocations.updateApplianceLocation);

  // Create a map for easy lookup
  const locationMap = applianceLocations.reduce((acc, location) => {
    acc[location.applianceName] = location.stationLocation;
    return acc;
  }, {} as Record<string, string>);

  const appliances = ['Pumper', 'Tanker', 'FCV'] as const;
  const stations = ['Main Station', 'Satellite Station'] as const;

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

  const handleLocationUpdate = async (applianceName: typeof appliances[number], newLocation: typeof stations[number]) => {
    setIsUpdating(true);

    try {
      await updateApplianceLocation({
        applianceName,
        stationLocation: newLocation,
      });
      toast.success(`${applianceName} location updated to ${newLocation}`, {
        description: 'The appliance location has been successfully changed.',
      });
    } catch (error) {
      console.error('Error updating appliance location:', error);
      toast.error('Failed to update appliance location', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };



  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Please log in to access admin features.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Appliance Location Management */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Appliance Locations
          </h2>
        </div>

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
          <div className="space-y-4">
            {appliances.map((appliance) => {
              const currentLocation = locationMap[appliance] || 'Unknown';
              const locationData = applianceLocations.find(loc => loc.applianceName === appliance);
              
              return (
                <div key={appliance} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:flex-shrink-0">
                      {stations.map((station) => (
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Additional Admin Features Placeholder */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h2 className="text-xl font-bold flex items-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
          Other Admin Settings
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Additional administrative features can be added here in the future.
        </p>
      </div>
    </div>
  );
};

export default AdminTab;
