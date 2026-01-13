import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import PersonalView from './deployment/PersonalView';
import BrigadeView from './deployment/BrigadeView';
import { Plane } from 'lucide-react';

// Helper to normalize a date to UTC midnight
// This ensures consistent date handling across timezones
function normalizeToUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}

// Helper to get a date key in YYYY-MM-DD format based on UTC
function getUTCDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

interface DeploymentTabProps {
  isAuthenticated: boolean;
}

const DeploymentTab: React.FC<DeploymentTabProps> = ({ isAuthenticated }) => {
  // State for deployment availability
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deploymentDates, setDeploymentDates] = useState<Date[]>([]);
  const [deploymentAvailability, setDeploymentAvailability] = useState<{ [key: string]: { notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean, message?: string } }>({});

  // Toggle between personal and brigade view
  const [showBrigadeView, setShowBrigadeView] = useState(false);

  // Calculate the date range for deployment availability (today + 6 days)
  // IMPORTANT: All dates are normalized to UTC midnight to ensure consistency
  useEffect(() => {
    const today = normalizeToUTCMidnight(new Date());

    const dates = [];
    for (let i = 0; i < 7; i++) {
      // Create each date at UTC midnight
      const date = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + i,
        0, 0, 0, 0
      ));
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
  const aggregatedDeploymentAvailability = useQuery(
    api.deploymentAvailability.getAggregatedDeploymentAvailability,
    startDate && endDate && showBrigadeView ? { startDate, endDate } : "skip"
  ) || [];

  // Format the deployment availability data for easier access
  // Uses UTC date keys for consistent matching
  useEffect(() => {
    if (userDeploymentAvailability.length > 0) {
      const formattedAvailability: { [key: string]: { notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean, message?: string } } = {};

      userDeploymentAvailability.forEach(record => {
        // Use getUTCDateKey for consistent key format
        const dateKey = getUTCDateKey(new Date(record.date));
        formattedAvailability[dateKey] = {
          ...record.availability,
          message: record.message || ""
        };
      });

      setDeploymentAvailability(formattedAvailability);
    }
  }, [userDeploymentAvailability]);

  // Navigation functions are defined below

  // Update deployment availability mutation
  const updateDeploymentAvailability = useMutation(api.deploymentAvailability.updateDeploymentAvailability);

  // Handle deployment availability change
  // Dates should already be UTC midnight, but we normalize to be safe
  const handleDeploymentAvailabilityChange = async (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean, message?: string) => {
    // Normalize the date to UTC midnight for consistent storage
    const normalizedDate = normalizeToUTCMidnight(date);
    const dateKey = getUTCDateKey(normalizedDate);
    const currentAvailability = deploymentAvailability[dateKey] || {
      notAvailable: false,
      local: false,
      shortHaul: false,
      longHaul: false,
      message: ""
    };

    // Extract message from currentAvailability to avoid it being part of the availability object
    const { message: currentMessage, ...availabilityOnly } = currentAvailability;
    let newAvailability = { ...availabilityOnly };

    // If setting notAvailable to true, clear all other options
    if (field === 'notAvailable' && value === true) {
      newAvailability = {
        notAvailable: true,
        local: false,
        shortHaul: false,
        longHaul: false
      };
    }
    // If setting any other option to true, make sure notAvailable is false
    else if (field !== 'notAvailable' && value === true) {
      newAvailability = {
        ...newAvailability,
        notAvailable: false,
        [field]: value
      };
    }
    // Otherwise just toggle the specified field
    else {
      newAvailability = {
        ...newAvailability,
        [field]: value
      };
    }

    // Update local state immediately for better UX
    const messageToSave = message !== undefined ? message : currentMessage || "";

    setDeploymentAvailability({
      ...deploymentAvailability,
      [dateKey]: {
        ...newAvailability,
        message: messageToSave
      }
    });

    // Send update to the server
    try {
      // Use the provided message or keep the existing one
      const messageToSave = message !== undefined ? message : currentMessage || "";

      // Send the normalized UTC midnight timestamp
      await updateDeploymentAvailability({
        date: normalizedDate.getTime(),
        availability: newAvailability,
        message: messageToSave
      });

      // We already updated the local state above for better UX
    } catch (error) {
      console.error("Error updating deployment availability:", error);
      // Revert local state if server update fails
      setDeploymentAvailability({
        ...deploymentAvailability,
        [dateKey]: currentAvailability
      });
    }
  };

  return (
    <>
      {/* Header Section */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm p-3 rounded">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center">
            <Plane className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            Deployment Availability
          </h2>
          {/* Toggle buttons for personal/brigade view */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
            <button
              onClick={() => setShowBrigadeView(false)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${!showBrigadeView
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              You
            </button>
            <button
              onClick={() => setShowBrigadeView(true)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${showBrigadeView
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              Brigade
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3">
          {!showBrigadeView ? (
            <PersonalView
              deploymentDates={deploymentDates}
              deploymentAvailability={deploymentAvailability}
              handleDeploymentAvailabilityChange={handleDeploymentAvailabilityChange}
            />
          ) : (
            <BrigadeView
              aggregatedDeploymentAvailability={aggregatedDeploymentAvailability}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default DeploymentTab;
