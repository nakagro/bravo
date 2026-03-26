import React, { useState, useEffect, useRef } from 'react';
import { Button } from "../../../../components/ui/button";
import { Toggle } from "../../../../components/ui/toggle";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { XIcon, HomeIcon, MapPinIcon, GlobeIcon, Zap } from 'lucide-react';
import { cn } from "../../../../lib/utils";
import MessagePresetManager from "../MessagePresetManager";

interface PersonalViewProps {
  deploymentDates: Date[];
  deploymentAvailability: { [key: string]: { notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean, message?: string } };
  handleDeploymentAvailabilityChange: (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean, message?: string) => void;
}

function PersonalView({
  deploymentDates,
  deploymentAvailability,
  handleDeploymentAvailabilityChange
}: PersonalViewProps) {
  return (
    <>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {deploymentDates.map((date) => {
          // Use UTC-based ISO string for consistent key matching with stored data
          const dateKey = date.toISOString().split('T')[0];
          const availability = deploymentAvailability[dateKey] || {
            notAvailable: false,
            local: false,
            shortHaul: false,
            longHaul: false,
            message: ""
          };

          // No longer highlighting today
          // Use UTC timezone for formatting since dates are stored as UTC midnight
          const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date);
          const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);

          return (
            <div
              key={dateKey}
              className="bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg p-3 shadow-sm"
            >
              {/* Date header */}
              <div className="mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dayName}, {formattedDate}</h4>
              </div>

              {/* Controls */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {/* Not Available Button */}
                  <Button
                    onClick={() => handleDeploymentAvailabilityChange(date, 'notAvailable', !availability.notAvailable)}
                    variant="outline"
                    className={cn(
                      "flex items-center justify-between w-full h-auto py-2 border-gray-200 dark:border-gray-800",
                      availability.notAvailable && "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-400 dark:border-red-600"
                    )}
                  >
                    <div className="flex items-center">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center mr-2",
                        availability.notAvailable
                          ? "bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}>
                        <XIcon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium">Not Available</span>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border",
                      availability.notAvailable
                        ? "bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600"
                        : "border-gray-300 dark:border-gray-600"
                    )}>
                      {availability.notAvailable && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </Button>

                  {/* Divider with text */}
                  <div className="relative flex py-2">
                    <div className="flex-grow border-t border-gray-400 dark:border-gray-600 h-0 my-auto"></div>
                    <span className="flex-shrink-0 mx-2 text-xs font-medium text-gray-500 dark:text-gray-400">OR</span>
                    <div className="flex-grow border-t border-gray-400 dark:border-gray-600 h-0 my-auto"></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Local Button */}
                    <Toggle
                      pressed={availability.local}
                      onPressedChange={(pressed) => handleDeploymentAvailabilityChange(date, 'local', pressed)}
                      disabled={availability.notAvailable}
                      className={cn(
                        "flex flex-col items-center justify-center h-auto py-2 space-y-1.5",
                        "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm",
                        "data-[state=on]:bg-green-100 dark:data-[state=on]:bg-green-900/30 data-[state=on]:text-green-800 dark:data-[state=on]:text-green-300 data-[state=on]:border-green-500 dark:data-[state=on]:border-green-600",
                        "hover:bg-green-50 dark:hover:bg-green-900/10 data-[disabled]:opacity-50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center",
                        availability.local
                          ? "bg-green-200 dark:bg-green-800/50 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}>
                        <HomeIcon className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-medium">Local</span>
                    </Toggle>

                    {/* Short Haul Button */}
                    <Toggle
                      pressed={availability.shortHaul}
                      onPressedChange={(pressed) => handleDeploymentAvailabilityChange(date, 'shortHaul', pressed)}
                      disabled={availability.notAvailable}
                      className={cn(
                        "flex flex-col items-center justify-center h-auto py-2 space-y-1.5",
                        "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm",
                        "data-[state=on]:bg-yellow-100 dark:data-[state=on]:bg-yellow-900/30 data-[state=on]:text-yellow-800 dark:data-[state=on]:text-yellow-300 data-[state=on]:border-yellow-500 dark:data-[state=on]:border-yellow-600",
                        "hover:bg-yellow-50 dark:hover:bg-yellow-900/10 data-[disabled]:opacity-50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center",
                        availability.shortHaul
                          ? "bg-yellow-200 dark:bg-yellow-800/50 text-yellow-700 dark:text-yellow-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}>
                        <MapPinIcon className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-medium">Short</span>
                    </Toggle>

                    {/* Long Haul Button */}
                    <Toggle
                      pressed={availability.longHaul}
                      onPressedChange={(pressed) => handleDeploymentAvailabilityChange(date, 'longHaul', pressed)}
                      disabled={availability.notAvailable}
                      className={cn(
                        "flex flex-col items-center justify-center h-auto py-2 space-y-1.5",
                        "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm",
                        "data-[state=on]:bg-orange-100 dark:data-[state=on]:bg-orange-900/30 data-[state=on]:text-orange-800 dark:data-[state=on]:text-orange-300 data-[state=on]:border-orange-500 dark:data-[state=on]:border-orange-600",
                        "hover:bg-orange-50 dark:hover:bg-orange-900/10 data-[disabled]:opacity-50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center",
                        availability.longHaul
                          ? "bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}>
                        <GlobeIcon className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-medium">Long</span>
                    </Toggle>
                  </div>

                  {/* Message input field */}
                  <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                    <Label htmlFor={`message-${dateKey}`} className="text-xs text-gray-600 dark:text-gray-400 mb-1">Add a note:</Label>
                    <MessageInput
                      date={date}
                      initialValue={availability.message || ""}
                      availability={availability}
                      handleDeploymentAvailabilityChange={handleDeploymentAvailabilityChange}
                      id={`message-${dateKey}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// MessageInput component with debouncing
interface MessageInputProps {
  date: Date;
  initialValue: string;
  id?: string;
  availability: {
    notAvailable: boolean;
    local: boolean;
    shortHaul: boolean;
    longHaul: boolean;
    message?: string;
  };
  handleDeploymentAvailabilityChange: (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean, message?: string) => void;
}

function MessageInput({ date, initialValue, availability, handleDeploymentAvailabilityChange, id }: MessageInputProps) {
  // Local state for the input value
  const [inputValue, setInputValue] = useState(initialValue);
  const [showPresetManager, setShowPresetManager] = useState(false);
  // Ref to store the timeout ID
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local state when initialValue changes (e.g., when switching dates)
  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout to update the database after 500ms of inactivity
    timeoutRef.current = setTimeout(() => {
      // Update the message without changing availability options
      handleDeploymentAvailabilityChange(
        date,
        availability.notAvailable ? 'notAvailable' : 'local', // Just pass the current state
        availability.notAvailable ? true : availability.local, // Just pass the current state
        newValue
      );
    }, 500);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const persistMessage = (message: string) => {
    handleDeploymentAvailabilityChange(
      date,
      availability.notAvailable ? 'notAvailable' : 'local',
      availability.notAvailable ? true : availability.local,
      message
    );
  };

  const handlePresetSelect = (message: string) => {
    setInputValue(message);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    persistMessage(message);
  };

  return (
    <>
      <div className="flex gap-2">
        <Input
          type="text"
          id={id}
          className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 dark:focus:border-gray-600 dark:focus:ring-gray-600"
          value={inputValue}
          onChange={handleInputChange}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="flex-shrink-0"
          title="Quick messages"
          onClick={() => setShowPresetManager(true)}
        >
          <Zap className="h-4 w-4" />
        </Button>
      </div>

      {showPresetManager && (
        <MessagePresetManager
          onClose={() => setShowPresetManager(false)}
          onSelectPreset={handlePresetSelect}
        />
      )}
    </>
  );
}

export default PersonalView;
