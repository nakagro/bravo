import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export function StationChecksHistory() {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const [selectedDutyCrew, setSelectedDutyCrew] = useState<Id<"dutyCrew"> | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<Id<"stationCheckSubmissions"> | null>(null);
  
  const history = useQuery(
    api.stationChecks.getStationCheckHistory,
    selectedDutyCrew ? { dutyCrewId: selectedDutyCrew, limit: 10 } : "skip"
  );
  
  // Format date to display in a readable format
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Format time to display in a readable format
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Get user's full name
  const getUserFullName = (user: { firstName?: string; lastName?: string; name: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name;
  };
  
  if (!dutyCrews) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center">
          <ClockIcon className="h-5 w-5 mr-2" />
          Station Checks History
        </CardTitle>
        <CardDescription>
          View past station checks submissions
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          <div className="w-full max-w-xs">
            <label htmlFor="duty-crew-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Duty Crew
            </label>
            <Select
              value={selectedDutyCrew?.toString() || ""}
              onValueChange={(value) => setSelectedDutyCrew(value as Id<"dutyCrew">)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a duty crew" />
              </SelectTrigger>
              <SelectContent>
                {dutyCrews.map((crew) => (
                  <SelectItem key={crew._id} value={crew._id}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedDutyCrew && history ? (
            history.length > 0 ? (
              <div className="space-y-4">
                {history.map((submission) => (
                  <div 
                    key={submission._id} 
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div 
                      className="p-4 bg-gray-50 dark:bg-gray-800 flex justify-between items-center cursor-pointer"
                      onClick={() => setExpandedSubmission(
                        expandedSubmission === submission._id ? null : submission._id
                      )}
                    >
                      <div>
                        <h4 className="text-md font-medium text-gray-900 dark:text-white">
                          {formatDate(submission.date)}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Completed by {getUserFullName(submission.completedBy)} at {formatTime(submission.completedAt)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon">
                        {expandedSubmission === submission._id ? (
                          <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                    
                    {expandedSubmission === submission._id && (
                      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="space-y-3">
                          {submission.checkItems.map((item) => (
                            <div key={item.checkId} className="flex items-start p-2 border border-gray-200 dark:border-gray-700 rounded-md">
                              <div className="flex-shrink-0 mt-0.5 mr-2">
                                {item.isCompleted ? (
                                  <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${
                                  item.isCompleted 
                                    ? "text-gray-900 dark:text-white" 
                                    : "text-gray-500 dark:text-gray-400"
                                }`}>
                                  {item.name}
                                </p>
                                {item.notes && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Notes: {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {submission.notes && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">General Notes:</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                              {submission.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No submission history found for this duty crew.</p>
              </div>
            )
          ) : selectedDutyCrew ? (
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Select a duty crew to view submission history.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
