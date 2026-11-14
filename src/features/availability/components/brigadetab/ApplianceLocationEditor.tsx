import React, { useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dateFormat";

interface ApplianceLocationEditorProps {
  onClose: () => void;
}

function ApplianceLocationEditor({ onClose }: ApplianceLocationEditorProps) {
  const applianceLocations = useQuery(api.applianceLocations.getApplianceLocationsWithUsers) || [];
  const allLocations = useQuery(api.applianceLocations.getAllLocations) || [];
  const updateApplianceLocation = useMutation(api.applianceLocations.updateApplianceLocation);

  const [isUpdating, setIsUpdating] = useState(false);
  const [customLocationFor, setCustomLocationFor] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState('');

  const locationMap = applianceLocations.reduce((acc, location) => {
    acc[location.applianceName] = location.stationLocation;
    return acc;
  }, {} as Record<string, string>);

  // Map to get full location data including updatedBy user info
  const locationDataMap = applianceLocations.reduce((acc, location) => {
    acc[location.applianceName] = location;
    return acc;
  }, {} as Record<string, typeof applianceLocations[number]>);

  // Format relative time compactly
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  };

  const getUpdatedByLabel = (location: typeof applianceLocations[number]) => {
    if (location.updatedBySource === 'serviceAccount') {
      return location.updatedByServiceAccountInfo?.name ?? 'Service Account';
    }
    if (location.updatedByUser?.firstName) return location.updatedByUser.firstName;
    if (location.updatedByUser?.name) return location.updatedByUser.name;
    if (location.updatedByServiceAccountInfo?.name) return location.updatedByServiceAccountInfo.name;
    return 'Unknown';
  };

  const appliances = ['Pumper', 'Tanker', 'FCV'] as const;
  const primaryStations = ['Main Station', 'Satellite Station'];
  const customLocations = allLocations.filter(
    loc => !primaryStations.includes(loc as any)
  );
  const allAvailableLocations = [...primaryStations, ...customLocations];

  const handleLocationUpdate = async (applianceName: typeof appliances[number], newLocation: string) => {
    if (locationMap[applianceName] === newLocation) return;
    setIsUpdating(true);
    try {
      await updateApplianceLocation({ applianceName, stationLocation: newLocation });
    } catch (error) {
      console.error('Error updating appliance location:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomLocationSubmit = async (applianceName: typeof appliances[number]) => {
    if (!customLocation.trim()) return;
    await handleLocationUpdate(applianceName, customLocation.trim());
    setCustomLocationFor(null);
    setCustomLocation('');
  };

  const formContent = (
    <div className="space-y-5">
      {appliances.map((appliance) => {
        const currentLocation = locationMap[appliance] || 'Unknown';
        return (
          <div key={appliance}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                {appliance}
              </h3>
              {locationDataMap[appliance]?.updatedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {getUpdatedByLabel(locationDataMap[appliance])}, {formatRelativeTime(locationDataMap[appliance].updatedAt)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allAvailableLocations.map((location) => (
                <button
                  key={location}
                  onClick={() => handleLocationUpdate(appliance, location)}
                  disabled={isUpdating || currentLocation === location}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentLocation === location
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 ring-1 ring-green-300 dark:ring-green-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center">
                    {location}
                    {currentLocation === location && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom location */}
            {customLocationFor === appliance ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Enter location..."
                  autoFocus
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomLocationSubmit(appliance);
                    } else if (e.key === 'Escape') {
                      setCustomLocationFor(null);
                      setCustomLocation('');
                    }
                  }}
                />
                <button
                  onClick={() => handleCustomLocationSubmit(appliance)}
                  disabled={isUpdating || !customLocation.trim()}
                  className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Set
                </button>
                <button
                  onClick={() => {
                    setCustomLocationFor(null);
                    setCustomLocation('');
                  }}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCustomLocationFor(appliance);
                  setCustomLocation('');
                }}
                disabled={isUpdating}
                className="mt-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                + Custom location
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title="Move Appliances"
      drawerHeight="max-h-[85vh]"
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Done
        </Button>
      }
    >
      {formContent}
    </ResponsiveModal>
  );
}

export default ApplianceLocationEditor;
