import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

const ApplianceLocations: React.FC = () => {
  const applianceLocations = useQuery(api.applianceLocations.getApplianceLocations) || [];
  const allLocations = useQuery(api.applianceLocations.getAllLocations) || [];

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
      <h2 className="text-lg font-bold flex items-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        Appliance Locations
      </h2>
      
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
    </div>
  );
};

export default ApplianceLocations;
