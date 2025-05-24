import React, { useState, useEffect, useRef } from 'react';

interface PersonalViewProps {
  deploymentDates: Date[];
  deploymentAvailability: {[key: string]: {notAvailable: boolean, local: boolean, shortHaul: boolean, longHaul: boolean, message?: string}};
  handleDeploymentAvailabilityChange: (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean, message?: string) => void;
}

const PersonalView: React.FC<PersonalViewProps> = ({
  deploymentDates,
  deploymentAvailability,
  handleDeploymentAvailabilityChange
}) => {
  return (
    <>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {deploymentDates.map((date) => {
          const dateKey = date.toISOString().split('T')[0];
          const availability = deploymentAvailability[dateKey] || {
            notAvailable: false,
            local: false,
            shortHaul: false,
            longHaul: false,
            message: ""
          };
          
          // No longer highlighting today
          const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
          const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
          
          return (
            <div 
              key={dateKey} 
              className="rounded shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 mb-4"
            >
              <div className="px-3 py-2 bg-white dark:bg-gray-900">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">{dayName}, {formattedDate}</h4>
                </div>
              </div>
              
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-1 gap-2">
                  {/* Not Available Button */}
                  <button
                    onClick={() => handleDeploymentAvailabilityChange(date, 'notAvailable', !availability.notAvailable)}
                    className={`flex items-center justify-between px-3 py-2 rounded transition-all ${availability.notAvailable 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-400 dark:border-red-600' 
                      : 'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-800/50'}`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 ${availability.notAvailable 
                        ? 'bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium">Not Available</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border ${availability.notAvailable 
                      ? 'bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'}`}
                    >
                      {availability.notAvailable && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                  
                  {/* Divider with text */}
                  <div className="relative flex items-center py-0.5">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink mx-1 text-xs text-gray-400 dark:text-gray-500">OR</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {/* Local Button */}
                    <button
                      onClick={() => handleDeploymentAvailabilityChange(date, 'local', !availability.local)}
                      disabled={availability.notAvailable}
                      className={`flex flex-col items-center px-2 py-2 rounded transition-all ${availability.local 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-400 dark:border-green-600' 
                        : 'bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-800/50'} 
                        ${availability.notAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${availability.local 
                        ? 'bg-green-200 dark:bg-green-800/50 text-green-700 dark:text-green-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium mt-1">Local</span>
                    </button>
                    
                    {/* Short Haul Button */}
                    <button
                      onClick={() => handleDeploymentAvailabilityChange(date, 'shortHaul', !availability.shortHaul)}
                      disabled={availability.notAvailable}
                      className={`flex flex-col items-center px-2 py-2 rounded transition-all ${availability.shortHaul 
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-400 dark:border-yellow-600' 
                        : 'bg-white dark:bg-gray-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-800/50'} 
                        ${availability.notAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${availability.shortHaul 
                        ? 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-700 dark:text-yellow-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium mt-1">Short</span>
                    </button>
                    
                    {/* Long Haul Button */}
                    <button
                      onClick={() => handleDeploymentAvailabilityChange(date, 'longHaul', !availability.longHaul)}
                      disabled={availability.notAvailable}
                      className={`flex flex-col items-center px-2 py-2 rounded transition-all ${availability.longHaul 
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-400 dark:border-orange-600' 
                        : 'bg-white dark:bg-gray-800 hover:bg-orange-50 dark:hover:bg-orange-900/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-800/50'} 
                        ${availability.notAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${availability.longHaul 
                        ? 'bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium mt-1">Long</span>
                    </button>
                  </div>
                  
                  {/* Message input field */}
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Add a note (optional):</label>
                    <MessageInput 
                      date={date}
                      initialValue={availability.message || ""}
                      availability={availability}
                      handleDeploymentAvailabilityChange={handleDeploymentAvailabilityChange}
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
};

// MessageInput component with debouncing
interface MessageInputProps {
  date: Date;
  initialValue: string;
  availability: {
    notAvailable: boolean;
    local: boolean;
    shortHaul: boolean;
    longHaul: boolean;
    message?: string;
  };
  handleDeploymentAvailabilityChange: (date: Date, field: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul', value: boolean, message?: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ date, initialValue, availability, handleDeploymentAvailabilityChange }) => {
  // Local state for the input value
  const [inputValue, setInputValue] = useState(initialValue);
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

  return (
    <input
      type="text"
      className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-blue-500 dark:focus:border-blue-600"
      value={inputValue}
      onChange={handleInputChange}
    />
  );
};

export default PersonalView;
