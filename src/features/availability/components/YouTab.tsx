import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getRelativeTimeString } from "../../../utils/dateUtils";

interface YouTabProps {
  userStatus: any;
  handleStatusChange: (status: string, durationHours?: number, nextStatus?: string) => void;
  isAuthenticated: boolean;
}

const YouTab: React.FC<YouTabProps> = ({
  userStatus,
  handleStatusChange,
  isAuthenticated
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | undefined>(undefined);
  const [showDurationSection, setShowDurationSection] = useState(false);
  const [selectedNextStatus, setSelectedNextStatus] = useState<string | undefined>(undefined);
  const [timeInputType, setTimeInputType] = useState<'hours' | 'time' | 'datetime'>('time');
  const [hoursInput, setHoursInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [dateTimeInput, setDateTimeInput] = useState('');
  // Detect touch-capable devices (heuristic for mobile/iOS overlay hint)
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || (navigator as any).maxTouchPoints > 0;
  }, []);
  
  // Fetch available status options from the backend
  const mainStatusOptions = useQuery(api.availability.getMainStatusOptions) || [];
  const nextStatusOptions = useQuery(api.availability.getAvailableStatusOptions) || [];
  
  // Fetch user skills to check for Officer skill
  const userSkills = useQuery(api.skills.getUserSkills, {});
  
  // Get current user ID
  const currentUserId = useQuery(api.availability.getCurrentUserId);
  
  // Check if current user is duty officer
  const isCurrentUserDutyOfficer = useQuery(api.availability.isCurrentUserDutyOfficer);
  
  // Check if user has Officer skill
  const hasOfficerSkill = useMemo(() => {
    return userSkills?.some(skill => skill.code === "OF") ?? false;
  }, [userSkills]);
  
  // Mutation for setting duty officer
  const setDutyOfficer = useMutation(api.availability.setDutyOfficer);
  
  // Create maps for easy lookup
  const statusMap = useMemo(() => {
    const map: Record<string, any> = {};
    mainStatusOptions.forEach(option => {
      map[option.value] = option;
    });
    return map;
  }, [mainStatusOptions]);

  const nextStatusMap = useMemo(() => {
    const map: Record<string, any> = {};
    nextStatusOptions.forEach(option => {
      map[option.value] = option;
    });
    return map;
  }, [nextStatusOptions]);
  
  // Helper function to handle status change with duration
  const handleStatusWithDuration = (status: string) => {
    handleStatusChange(status, selectedDuration, selectedNextStatus);
    if (selectedDuration) {
      showDurationToast(selectedDuration);
    }
    setSelectedDuration(undefined);
    setSelectedNextStatus(undefined);
  };

  // Format a Date to "YYYY-MM-DDTHH:mm" in LOCAL time for datetime-local inputs
  const getLocalDateTimeInputValue = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  // Apply staged duration to current status
  const onApplyDurationClick = () => {
    if (!selectedDuration) return;
    if (!userStatus?.currentStatus) {
      toast.warning('Select a status above, then set a duration.');
      return;
    }
    handleStatusChange(userStatus.currentStatus, selectedDuration, selectedNextStatus);
    showDurationToast(selectedDuration);
    setSelectedDuration(undefined);
    setSelectedNextStatus(undefined);
  };
  
  // Helper function to calculate hours from military time input
  const calculateHoursFromTime = (timeStr: string) => {
    // Remove any non-digit characters
    const cleanTime = timeStr.replace(/\D/g, '');
    
    // Only accept exactly 4 digits
    if (cleanTime.length !== 4) {
      return null;
    }
    
    // Parse hours and minutes from 4-digit format (e.g., "2100" -> 21:00)
    const hours = parseInt(cleanTime.substring(0, 2));
    const minutes = parseInt(cleanTime.substring(2, 4));
    
    // Validate time
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    
    // If target time is earlier than now, assume it's tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diffMs = targetTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours
    return Math.round(diffHours * 100) / 100; // Round to 2 decimal places (0.01 hour = 0.6 minutes)
  };
  
  // Helper function to handle custom time input
  const handleCustomTimeInput = () => {
    let hours: number | null = null;
    
    if (timeInputType === 'hours') {
      hours = parseFloat(hoursInput);
      if (isNaN(hours) || hours <= 0) return;
    } else if (timeInputType === 'time') {
      hours = calculateHoursFromTime(timeInput);
      if (!hours || hours <= 0) return;
    } else if (timeInputType === 'datetime') {
      hours = calculateHoursFromDateTime(dateTimeInput);
      if (!hours || hours <= 0) return;
    }
    // Narrow type for TS: ensure hours is a number
    if (hours === null) return;

    // Stage duration only; do not apply until user clicks a status or the Set button below
    setSelectedDuration(hours);
    
    // Clear inputs
    setHoursInput('');
    setTimeInput('');
    setDateTimeInput('');
  };

  // Helper: calculate hours from a selected local date-time string (YYYY-MM-DDTHH:mm)
  const calculateHoursFromDateTime = (dt: string) => {
    if (!dt) return null;
    // datetime-local provides local time without timezone suffix; Date will interpret it as local
    const target = new Date(dt);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    if (target <= now) return null;
    const diffMs = target.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100;
  };
  
  // Helper function to apply next status to current status
  const applyNextStatusToCurrentStatus = (nextStatus: string) => {
    if (userStatus?.currentStatus && selectedDuration) {
      handleStatusChange(userStatus.currentStatus, selectedDuration, nextStatus);
    }
    setSelectedNextStatus(nextStatus);
  };
  
  // Helper function to get status display name
  const getStatusDisplayName = (status: string) => {
    const statusOption = statusMap[status] || nextStatusMap[status];
    if (statusOption) {
      return statusOption.label;
    }
    return status;
  };
  
  // Helper function to format remaining time
  const formatRemainingTime = (expiresAt: number) => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };
  
  // Helper function to format combined remaining time and next status
  const formatStatusTransition = (expiresAt: number, nextStatus: string) => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return "Status expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeStr;
    if (hours > 0) {
      timeStr = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      timeStr = `${minutes}m`;
    }
    
    const nextStatusDisplay = nextStatus === 'reset' ? 'Available' : getStatusDisplayName(nextStatus);
    return `In ${timeStr} you will be: ${nextStatusDisplay}`;
  };
  
  // Helper function to get status background color
  const getStatusBackgroundColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-300 dark:border-gray-700';
    const statusOption = statusMap[status];
    return statusOption?.backgroundColorClass || 'bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-300 dark:border-gray-700';
  };
  
  const getStatusTextColor = (status: string | undefined) => {
    if (!status) return 'text-gray-600 dark:text-gray-400';
    const statusOption = statusMap[status];
    return statusOption?.textColorClass || 'text-gray-600 dark:text-gray-400';
  };

  // Toast helpers
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatUntil = (hours: number) => {
    const end = new Date(Date.now() + hours * 60 * 60 * 1000);
    return end.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const showDurationToast = (hours: number) => {
    const base = `Duration set: ${formatDuration(hours)} (until ${formatUntil(hours)})`;
    const tail = selectedNextStatus
      ? ` → then ${getStatusDisplayName(selectedNextStatus)}`
      : '';
    toast.info(base + tail);
  };

  // Handle duty officer toggle for users with Officer skill
  const handleDutyOfficerToggle = async () => {
    if (!currentUserId) {
      console.error('No user ID available');
      return;
    }

    const confirmMessage = 'Setting yourself as Duty Officer will remove this status from any current duty officer. Continue?';
    
    if (window.confirm(confirmMessage)) {
      try {
        await setDutyOfficer({ userId: currentUserId });
      } catch (error) {
        console.error('Error setting duty officer:', error);
        alert('Failed to update duty officer status. Please try again.');
      }
    }
  };

  return (
    <>
      {/* Current User Status */}
      <div className="mb-4 rounded overflow-hidden shadow-sm">
        <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium">Your Status is:</h2>
        </div>
        
        {isAuthenticated ? (
          <div className={`p-3 ${getStatusBackgroundColor(userStatus?.currentStatus)}`}>
            {userStatus?.currentStatus ? (
              <>
                <div className={`font-medium text-lg ${getStatusTextColor(userStatus.currentStatus)}`}>
                  {getStatusDisplayName(userStatus.currentStatus)}
                </div>
                {userStatus.statusUpdatedAt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Updated: {getRelativeTimeString(userStatus.statusUpdatedAt)}
                  </p>
                )}
                {userStatus.statusExpiresAt && userStatus.nextStatus && userStatus.nextStatusAt && (
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                    {formatStatusTransition(userStatus.statusExpiresAt, userStatus.nextStatus)}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="font-medium text-lg text-gray-600 dark:text-gray-400">
                  End of day reset
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Your status has been reset. Please set a new status for today.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Please sign in to set your status</p>
          </div>
        )}
      </div>
      
      {/* Status Buttons */}
      {isAuthenticated && (
        <div className="mb-4 p-3 bg-white dark:bg-gray-800 shadow-sm rounded">
          <h3 className="text-lg font-medium mb-3">Update Your Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {mainStatusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusWithDuration(option.value)}
                className={`flex items-center justify-center ${
                  userStatus?.currentStatus === option.value
                    ? `${option.buttonActiveColorClass} shadow-md`
                    : `bg-white dark:bg-gray-800 ${option.buttonHoverColorClass} ${option.buttonColorClass} border ${option.buttonBorderColorClass} hover:shadow-md dark:hover:shadow-none`
                } px-4 py-3 rounded-lg transition-all`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                </svg>
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duration Accordion */}
      {isAuthenticated && (
        <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <button
            onClick={() => setShowDurationSection(!showDurationSection)}
            className="w-full px-3 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-lg font-medium">
              {userStatus?.statusExpiresAt ? 
                `Duration: ${userStatus.statusDurationHours}h active` :
                (selectedDuration ? `Duration: ${selectedDuration}h` : 'Add Duration')
              }
            </span>
            <div className="flex items-center gap-2">
              {(selectedDuration || userStatus?.statusExpiresAt) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDuration(undefined);
                    setSelectedNextStatus(undefined);
                    if (userStatus?.currentStatus) {
                      handleStatusChange(userStatus.currentStatus, undefined, undefined);
                    }
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear
                </button>
              )}
              <svg 
                className={`w-5 h-5 transition-transform ${showDurationSection ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          
          {showDurationSection && (
            <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700">
              {/* Input Type Toggle */}
              <div className="flex gap-2 mb-3 mt-3">
                <button
                  onClick={() => setTimeInputType('time')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    timeInputType === 'time'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Until Time
                </button>
                <button
                  onClick={() => setTimeInputType('hours')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    timeInputType === 'hours'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Hours
                </button>
                <button
                  onClick={() => setTimeInputType('datetime')}
                  className={`px-3 py-2 rounded text-sm transition-colors ${
                    timeInputType === 'datetime'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Date & Time
                </button>
              </div>
              
              {/* Time Input */}
              <div className={`flex gap-2 mb-3 ${timeInputType === 'datetime' ? 'flex-wrap' : ''}`}>
                {timeInputType === 'hours' ? (
                  <input
                    type="number"
                    value={hoursInput}
                    onChange={(e) => setHoursInput(e.target.value)}
                    placeholder="Enter hours (e.g., 2.5)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min="0.5"
                    step="0.5"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomTimeInput()}
                  />
                ) : timeInputType === 'time' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter time (e.g., 2100, 0730, 1430)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-base md:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomTimeInput()}
                    maxLength={4}
                  />
                ) : (
                  <div className={`relative ${timeInputType === 'datetime' ? 'basis-full' : 'flex-1'} min-w-0`}>
                    <input
                      type="datetime-local"
                      value={dateTimeInput}
                      onChange={(e) => setDateTimeInput(e.target.value)}
                      aria-label="Select date and time"
                      title="Select date and time"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomTimeInput()}
                      min={getLocalDateTimeInputValue(new Date(Date.now() + 60 * 1000))}
                    />
                    {isTouchDevice && !dateTimeInput && (
                      <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-gray-500 dark:text-gray-400 text-sm">
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>Tap to pick date & time</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={handleCustomTimeInput}
                  disabled={
                    timeInputType === 'hours' ? !hoursInput :
                    timeInputType === 'time' ? !timeInput :
                    !dateTimeInput
                  }
                  className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  Set
                </button>
              </div>
              
              {/* Quick Duration Buttons - Only show when Hours mode is selected */}
              {timeInputType === 'hours' && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[1, 2, 4, 6, 8, 12, 24, 48].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => {
                        // Stage duration only; do not apply until user clicks a status or the Set button below
                        setSelectedDuration(hours);
                      }}
                      className={`px-2 py-2 rounded text-sm transition-colors ${
                        (selectedDuration === hours || userStatus?.statusDurationHours === hours) 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              )}
              
              {/* Next Status Options - Only show if duration is selected */}
              {selectedDuration && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-md font-medium mb-2">Then switch to:</h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {nextStatusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (userStatus?.currentStatus && selectedDuration) {
                            applyNextStatusToCurrentStatus(option.value);
                          } else {
                            setSelectedNextStatus(option.value);
                          }
                        }}
                        className={`px-3 py-2 rounded text-sm transition-colors ${
                          selectedNextStatus === option.value
                            ? 'ring-2 ring-blue-500'
                            : ''
                        } ${option.color}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedNextStatus ? 
                      `After ${selectedDuration}h → ${getStatusDisplayName(selectedNextStatus)}` :
                      `After ${selectedDuration}h → Status will be cleared`
                    }
                  </p>

                  {/* Apply button */}
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={onApplyDurationClick}
                      className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duty Officer Section - Only show for users with Officer skill */}
      {isAuthenticated && hasOfficerSkill && (
        <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <div className="px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-lg font-medium">
                  Duty Officer
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isCurrentUserDutyOfficer ? 'You are currently the Duty Officer' : 'Take over as Duty Officer'}
                </span>
              </div>
              <button
                onClick={handleDutyOfficerToggle}
                disabled={isCurrentUserDutyOfficer} // Disable if already duty officer since there's no unset function
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isCurrentUserDutyOfficer
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
                }`}
              >
                {isCurrentUserDutyOfficer ? 'Active' : 'Take Over'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default YouTab;