import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

export function HoseStatusSync() {
  const [isLoading, setIsLoading] = useState(false);
  
  // Query to get hoses that need status updates
  const hosesNeedingUpdate = useQuery(api.hoseStatusSync.getHosesNeedingStatusUpdate);
  
  // Mutation to sync all hose statuses
  const syncAllStatuses = useMutation(api.hoseStatusSync.syncAllHoseStatuses);

  const handleSyncAll = async () => {
    setIsLoading(true);
    try {
      const result = await syncAllStatuses();
      
      if (result.updated > 0) {
        toast.success(`Successfully updated ${result.updated} hose${result.updated === 1 ? '' : 's'}`);
      } else {
        toast.info("All hose statuses are already up to date");
      }
    } catch (error) {
      console.error("Error syncing hose statuses:", error);
      toast.error("Failed to sync hose statuses");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In date":
        return "bg-green-100 text-green-800";
      case "Due for testing":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!hosesNeedingUpdate) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="h-5 w-5" />
              <span className="text-base sm:text-lg">Hose Status Synchronization</span>
            </div>
            {hosesNeedingUpdate.length > 0 && (
              <Button 
                onClick={handleSyncAll}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
                size="sm"
              >
                {isLoading ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
                <span className="sm:hidden">Sync All Hoses ({hosesNeedingUpdate.length})</span>
                <span className="hidden sm:inline">Sync All ({hosesNeedingUpdate.length})</span>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hosesNeedingUpdate.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                All Hose Statuses Are Up to Date
              </h3>
              <p className="text-gray-600">
                All hoses have the correct status based on their test dates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-gray-600 mb-4 p-3 bg-amber-50 rounded-lg">
                <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">
                  {hosesNeedingUpdate.length} hose{hosesNeedingUpdate.length === 1 ? '' : 's'} need{hosesNeedingUpdate.length === 1 ? 's' : ''} status updates based on test dates
                </span>
              </div>
              
              <div className="space-y-3">
                {hosesNeedingUpdate.map((hose) => (
                  <div 
                    key={hose._id} 
                    className="p-4 border border-gray-200 rounded-lg space-y-3"
                  >
                    {/* Hose ID and Test Info */}
                    <div>
                      <p className="font-medium text-gray-900 text-lg">{hose.hoseId}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <ClockIcon className="h-3 w-3 flex-shrink-0" />
                        <span>Tested: {formatDate(hose.testDate)}</span>
                        <span className="hidden sm:inline">({hose.daysSinceTest} days ago)</span>
                      </div>
                      <div className="sm:hidden text-xs text-gray-500 mt-1">
                        {hose.daysSinceTest} days ago
                      </div>
                    </div>
                    
                    {/* Status Information */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium min-w-[80px]">Current:</span>
                        <Badge className={`${getStatusColor(hose.currentStatus)} text-xs`}>
                          {hose.currentStatus}
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium min-w-[80px]">Should be:</span>
                        <Badge className={`${getStatusColor(hose.suggestedStatus)} text-xs`}>
                          {hose.suggestedStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3 text-sm sm:text-base">How Automatic Status Management Works:</h4>
                <ul className="text-xs sm:text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>Hoses tested within the last 365 days are automatically marked as "In date"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>Hoses tested more than 365 days ago are automatically marked as "Due for testing"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>Only "In date" and "Due for testing" statuses are automatically managed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>"With district for repair" and "Condemned" statuses require manual intervention</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>Status changes are automatically applied when test dates are updated</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
