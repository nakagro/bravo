import React, { useState } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { getRelativeTimeCompact } from "../../../../utils/dateUtils";
import ApplianceLocationEditor from "./ApplianceLocationEditor";

const ApplianceLocations: React.FC = () => {
  const applianceLocations = useQuery(api.applianceLocations.getApplianceLocations) || [];
  const allLocations = useQuery(api.applianceLocations.getAllLocations) || [];
  const currentUserSkills = useQuery(api.skills.getUserSkills, {});
  const locationEditSkills = useQuery(api.applianceLocations.getLocationEditSkills);

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Check if current user has any of the configured skills for editing locations
  const canEditLocations = (locationEditSkills && currentUserSkills)
    ? currentUserSkills.some((skill: any) => locationEditSkills.includes(skill.code))
    : false;

  // Most recent update across all appliances
  const lastUpdatedAt = applianceLocations.length > 0
    ? Math.max(...applianceLocations.map(loc => loc.updatedAt))
    : null;

  // Create a map for easy lookup
  const locationMap = applianceLocations.reduce((acc, location) => {
    acc[location.applianceName] = location.stationLocation;
    return acc;
  }, {} as Record<string, string>);

  const appliances = ['Pumper', 'Tanker', 'FCV'];
  const primaryStations = ['Main Station', 'Satellite Station'];

  // Group appliances by their location
  const getAppliancesAtLocation = (station: string) => {
    return appliances.filter(appliance => locationMap[appliance] === station);
  };

  // Get custom locations (excluding primary stations)
  const customLocations = allLocations.filter(
    loc => !primaryStations.includes(loc as any)
  );

  return (
    <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm p-3 rounded">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Appliance Locations
        </h2>
        {canEditLocations ? (
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {lastUpdatedAt && (
              <span>{getRelativeTimeCompact(lastUpdatedAt)}</span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        ) : lastUpdatedAt ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {getRelativeTimeCompact(lastUpdatedAt)}
          </span>
        ) : null}
      </div>
      
      <div className="flex flex-wrap gap-3">
        {/* Primary stations */}
        {primaryStations.map((station) => {
          const appliancesAtStation = getAppliancesAtLocation(station);
          
          return (
            <div key={station} className="flex-1 min-w-[calc(50%-0.375rem)] border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              <h3 className="font-semibold text-base leading-tight text-gray-800 dark:text-gray-200 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{station}</h3>
              
              <div>
                {appliancesAtStation.length > 0 ? (
                  <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                    {appliancesAtStation.map((appliance, index) => (
                      <span key={appliance} className="text-gray-700 dark:text-gray-300">
                        {appliance}{index < appliancesAtStation.length - 1 && <span className="text-gray-500 dark:text-gray-500">, </span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 italic whitespace-nowrap text-sm"></span>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Custom locations */}
        {customLocations.map((location) => {
          const appliancesAtLocation = getAppliancesAtLocation(location);
          
          // Only show custom locations that have appliances
          if (appliancesAtLocation.length === 0) return null;
          
          return (
            <div key={location} className="flex-1 min-w-[calc(50%-0.375rem)] border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              <h3 className="font-semibold text-base leading-tight text-gray-800 dark:text-gray-200 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{location}</h3>
              
              <div>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                  {appliancesAtLocation.map((appliance, index) => (
                    <span key={appliance} className="text-gray-700 dark:text-gray-300">
                      {appliance}{index < appliancesAtLocation.length - 1 && <span className="text-gray-500 dark:text-gray-500">, </span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor modal */}
      {isEditorOpen && (
        <ApplianceLocationEditor onClose={() => setIsEditorOpen(false)} />
      )}
    </div>
  );
};

export default ApplianceLocations;
