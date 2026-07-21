import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
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

function AdminTab({ isAuthenticated }: AdminTabProps) {
  const usersWithScheduledChanges = useQuery(api.availability.getUsersWithScheduledChanges) || [];
  const allSkills = useQuery(api.skills.getSkills) || [];
  const locationEditSkills = useQuery(api.applianceLocations.getLocationEditSkills) || [];
  const updateLocationEditSkills = useMutation(api.applianceLocations.updateLocationEditSkills);
  const [isSavingSkills, setIsSavingSkills] = useState(false);

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

  // Filter out system skills (NONE) for the selector
  const selectableSkills = allSkills.filter((s: any) => s.code !== 'NONE' && s.isActive);

  const handleToggleSkill = async (code: string) => {
    const updated = locationEditSkills.includes(code)
      ? locationEditSkills.filter((c) => c !== code)
      : [...locationEditSkills, code];
    setIsSavingSkills(true);
    try {
      await updateLocationEditSkills({ skillCodes: updated });
      toast.success('Appliance location permissions updated');
    } catch (error) {
      toast.error('Failed to update permissions', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSavingSkills(false);
    }
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
      {/* Info banner */}
      {/* <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
        </svg>
        <span>Looking to change appliance locations? This has been moved to the <strong>Brigade</strong> tab next to Appliance Locations.</span>
      </div> */}

      {/* Module Settings */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <Accordion type="single" collapsible>
          <AccordionItem value="module-settings" className="border-none">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <h2 className="text-xl font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Module Settings
              </h2>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {/* Appliance Location Edit Permissions */}
              <div>
                <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 mb-1">
                  Appliance Location Permissions
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Members with any enabled skill can move appliance locations. Admins and Lieutenants+ always have access.
                </p>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {selectableSkills.map((skill: any) => {
                    const isSelected = locationEditSkills.includes(skill.code);
                    return (
                      <button
                        key={skill._id}
                        onClick={() => handleToggleSkill(skill.code)}
                        disabled={isSavingSkills}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{skill.code}</span>
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 truncate">{skill.name}</span>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                          isSelected ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
                            isSelected ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {locationEditSkills.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    No skills selected. Only admins and Lieutenants+ can move appliances.
                  </p>
                )}
              </div>
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
}

export default AdminTab;
