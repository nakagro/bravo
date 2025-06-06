import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import PersonalView from './deployment/PersonalView';
import BrigadeView from './deployment/BrigadeView';
import DetailModal from './deployment/DetailModal';
import { Button } from "../../../components/ui/button";
import { Card, CardHeader, CardContent } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";

interface DeploymentTabProps {
  isAuthenticated: boolean;
}

const DeploymentTab: React.FC<DeploymentTabProps> = ({ isAuthenticated }) => {
  // State for deployment availability
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deploymentDates, setDeploymentDates] = useState<Date[]>([]);
  const [deploymentAvailability, setDeploymentAvailability] = useState<{[key: string]: {notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean, message?: string}}>({});
  
  // State for detailed view modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailDate, setSelectedDetailDate] = useState<{
    date: number, 
    counts: {
      notAvailable: number,
      local: number,
      shortHaul: number,
      longHaul: number,
      total: number
    },
    users: Array<{
      userId: string,
      name?: string,
      firstName?: string,
      lastName?: string,
      availability: {
        notAvailable: boolean,
        local: boolean,
        shortHaul: boolean,
        longHaul: boolean
      },
      message?: string
    }>
  } | null>(null);
  
  // Toggle between personal and brigade view
  const [showBrigadeView, setShowBrigadeView] = useState(false);
  
  // Calculate the date range for deployment availability (today + 6 days)
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
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
  useEffect(() => {
    if (userDeploymentAvailability.length > 0) {
      const formattedAvailability: {[key: string]: {notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean, message?: string}} = {};
      
      userDeploymentAvailability.forEach(record => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
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
  const handleDeploymentAvailabilityChange = async (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean, message?: string) => {
    const dateKey = date.toISOString().split('T')[0];
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
      
      await updateDeploymentAvailability({
        date: date.getTime(),
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
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="px-4 py-3 flex flex-row justify-between items-center border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">Deployment Availability</h3>
          {/* Toggle button for personal/brigade view */}
          <Button
            onClick={() => setShowBrigadeView(!showBrigadeView)}
            variant={showBrigadeView ? "default" : "secondary"}
            size="sm"
            className="text-xs font-medium"
          >
            {showBrigadeView ? 'Show Your Availability' : 'Show Brigade View'}
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {!showBrigadeView ? (
            <PersonalView 
              deploymentDates={deploymentDates}
              deploymentAvailability={deploymentAvailability}
              handleDeploymentAvailabilityChange={handleDeploymentAvailabilityChange}
            />
          ) : (
            <BrigadeView 
              aggregatedDeploymentAvailability={aggregatedDeploymentAvailability}
              setSelectedDetailDate={setSelectedDetailDate}
              setShowDetailModal={setShowDetailModal}
            />
          )}
        </CardContent>
      </Card>
        
      {/* Detailed View Modal */}
      {showDetailModal && selectedDetailDate && (
        <DetailModal 
          selectedDetailDate={selectedDetailDate}
          setShowDetailModal={setShowDetailModal}
        />
      )}
    </>
  );
};

export default DeploymentTab;
