import React, { useState } from 'react';
import { Button } from "../../../../components/ui/button";
import { Card, CardHeader, CardContent } from "../../../../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../../components/ui/accordion";
import { Badge } from "../../../../components/ui/badge";
import { cn } from "../../../../lib/utils";
import { ChevronDown } from 'lucide-react';

interface BrigadeViewProps {
  aggregatedDeploymentAvailability: Array<{
    date: number;
    counts: {
      notAvailable: number;
      local: number;
      shortHaul: number;
      longHaul: number;
      total: number;
    };
    users: Array<{
      userId: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      availability: {
        notAvailable: boolean;
        local: boolean;
        shortHaul: boolean;
        longHaul: boolean;
      };
      message?: string;
    }>;
  }>;
  setSelectedDetailDate: (date: any) => void;
  setShowDetailModal: (show: boolean) => void;
}

const BrigadeView: React.FC<BrigadeViewProps> = ({
  aggregatedDeploymentAvailability,
  setSelectedDetailDate,
  setShowDetailModal
}) => {
  // State for filters
  const [filters, setFilters] = useState({
    notAvailable: true,
    local: true,
    shortHaul: true,
    longHaul: true
  });

  // State for expanded accordion items
  const [expandedDate, setExpandedDate] = useState<number | null>(null);

  // Toggle filter
  const toggleFilter = (filter: 'notAvailable' | 'local' | 'shortHaul' | 'longHaul') => {
    setFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  // Toggle accordion expansion
  const toggleExpand = (dateTimestamp: number) => {
    setExpandedDate(expandedDate === dateTimestamp ? null : dateTimestamp);
  };

  // Filter users based on selected filters
  const filterUsers = (users: BrigadeViewProps['aggregatedDeploymentAvailability'][0]['users']) => {
    return users.filter(user => {
      // If all filters are off, show everyone
      if (!filters.notAvailable && !filters.local && !filters.shortHaul && !filters.longHaul) {
        return true;
      }
      
      // Check if user matches any active filter
      return (filters.notAvailable && user.availability.notAvailable) ||
             (filters.local && user.availability.local) ||
             (filters.shortHaul && user.availability.shortHaul) ||
             (filters.longHaul && user.availability.longHaul);
    });
  };

  return (
    <div className="flex flex-col">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4 self-center">
        <Button
          onClick={() => toggleFilter('notAvailable')}
          variant="outline"
          size="sm"
          className={cn(
            "text-xs flex items-center border-gray-200 dark:border-gray-800",
            filters.notAvailable && "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-400 dark:border-red-600"
          )}
        >
          <div className={cn(
            "w-3 h-3 rounded-full mr-1.5",
            filters.notAvailable ? "bg-red-200 dark:bg-red-800/50" : "bg-gray-200 dark:bg-gray-700"
          )} />
          Not Available
        </Button>
        
        <Button
          onClick={() => toggleFilter('local')}
          variant="outline"
          size="sm"
          className={cn(
            "text-xs flex items-center border-gray-200 dark:border-gray-800",
            filters.local && "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-400 dark:border-green-600"
          )}
        >
          <div className={cn(
            "w-3 h-3 rounded-full mr-1.5",
            filters.local ? "bg-green-200 dark:bg-green-800/50" : "bg-gray-200 dark:bg-gray-700"
          )} />
          Local
        </Button>
        
        <Button
          onClick={() => toggleFilter('shortHaul')}
          variant="outline"
          size="sm"
          className={cn(
            "text-xs flex items-center border-gray-200 dark:border-gray-800",
            filters.shortHaul && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-400 dark:border-yellow-600"
          )}
        >
          <div className={cn(
            "w-3 h-3 rounded-full mr-1.5",
            filters.shortHaul ? "bg-yellow-200 dark:bg-yellow-800/50" : "bg-gray-200 dark:bg-gray-700"
          )} />
          Short Haul
        </Button>
        
        <Button
          onClick={() => toggleFilter('longHaul')}
          variant="outline"
          size="sm"
          className={cn(
            "text-xs flex items-center border-gray-200 dark:border-gray-800",
            filters.longHaul && "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-400 dark:border-orange-600"
          )}
        >
          <div className={cn(
            "w-3 h-3 rounded-full mr-1.5",
            filters.longHaul ? "bg-orange-200 dark:bg-orange-800/50" : "bg-gray-200 dark:bg-gray-700"
          )} />
          Long Haul
        </Button>
      </div>

      {/* Accordion layout */}
      <div className="space-y-3">
        {aggregatedDeploymentAvailability.map((dateData) => {
          const date = new Date(dateData.date);
          // No longer highlighting today
          const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
          const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
          const filteredUsers = filterUsers(dateData.users);
          
          return (
            <Card key={dateData.date} className="border-gray-200 dark:border-gray-800 overflow-hidden">
              <Accordion 
                type="single" 
                collapsible
                value={expandedDate === dateData.date ? dateData.date.toString() : undefined}
                onValueChange={(value) => setExpandedDate(value === undefined ? null : Number(value))}
              >
                <AccordionItem value={dateData.date.toString()} className="border-0">
                  <AccordionTrigger className="px-3 py-2 hover:no-underline">
                    <div className="flex flex-row w-full items-center justify-between">
                      <div className="text-sm font-medium">{dayName}, {formattedDate}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                    {/* View all button */}
                    <div className="flex justify-between items-center mb-3">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDetailDate(dateData);
                          setShowDetailModal(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 border-blue-300 dark:border-blue-800"
                      >
                        View All
                      </Button>
                    </div>
                  
                  {/* Member list */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => {
                        const displayName = user.name || 
                          (user.firstName && user.lastName ? `${user.lastName}, ${user.firstName}` : 'Unknown User');
                        
                        return (
                          <Card key={user.userId} className="p-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                            <div className="flex flex-col gap-2">
                              <div className="text-sm font-medium">{displayName}</div>
                              <div className="flex flex-wrap gap-1">
                                {user.availability.notAvailable && (
                                  <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-400 dark:border-red-600 hover:bg-red-100 dark:hover:bg-red-900/30">
                                    Not Available
                                  </Badge>
                                )}
                                {user.availability.local && (
                                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-400 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/30">
                                    Local
                                  </Badge>
                                )}
                                {user.availability.shortHaul && (
                                  <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30">
                                    Short Haul
                                  </Badge>
                                )}
                                {user.availability.longHaul && (
                                  <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-400 dark:border-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30">
                                    Long Haul
                                  </Badge>
                                )}
                              </div>
                              {user.message && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                  "{user.message}"
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="p-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No members match the selected filters.
                      </div>
                    )}
                  </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          );
        })}
      </div>
      
      {/* Empty state */}
      {aggregatedDeploymentAvailability.length === 0 && (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">No deployment data available</p>
        </div>
      )}
    </div>
  );
};

export default BrigadeView;
