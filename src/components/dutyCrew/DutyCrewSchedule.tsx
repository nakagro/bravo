import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CalendarIcon, UserGroupIcon, UserIcon } from "@heroicons/react/24/outline";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";

export function DutyCrewSchedule() {
  const upcomingAssignments = useQuery(api.dutyCrew.getUpcomingDutyCrewAssignments, {
    count: 4, // Show the next 4 upcoming duty crew assignments
  });
  
  const [selectedDutyCrew, setSelectedDutyCrew] = useState<Id<"dutyCrew"> | null>(null);
  const dutyCrewMembers = useQuery(
    api.dutyCrewMembers.getDutyCrewMembers,
    selectedDutyCrew ? { dutyCrewId: selectedDutyCrew } : "skip"
  );

  // Format date to display in a readable format (e.g., "Sunday, June 2, 2025")
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!upcomingAssignments) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-10 w-10"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
          Upcoming Duty Crew Schedule
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          View which duty crew is scheduled for upcoming Sundays
        </p>
      </div>
      
      <Accordion type="single" collapsible className="divide-y divide-gray-200 dark:divide-gray-700">
        {upcomingAssignments.map((assignment) => (
          <AccordionItem key={assignment.date} value={assignment.date.toString()} className="border-none">
            <AccordionTrigger 
              onClick={() => setSelectedDutyCrew(assignment.dutyCrew._id)}
              className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    assignment.isSpecial 
                      ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-200' 
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200'
                  }`}>
                    {assignment.isSpecial ? (
                      <UserGroupIcon className="h-5 w-5" />
                    ) : (
                      <CalendarIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-4 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(assignment.date)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {assignment.dutyCrew.name}
                    </div>
                  </div>
                </div>
                {assignment.notes && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {assignment.notes}
                  </div>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-0 sm:px-6">
              <div className="mt-2 space-y-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                  <UserGroupIcon className="h-4 w-4 mr-1" /> 
                  Duty Crew Members
                </h4>
                
                {selectedDutyCrew === assignment.dutyCrew._id && (
                  <div className="space-y-2">
                    {dutyCrewMembers ? (
                      dutyCrewMembers.length > 0 ? (
                        <ul className="space-y-2">
                          {dutyCrewMembers.map((member) => (
                            <li key={member._id} className="flex items-center text-sm">
                              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                              </div>
                              <div className="ml-3">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {member.firstName && member.lastName 
                                    ? `${member.firstName} ${member.lastName}` 
                                    : member.name || 'Unknown'}
                                  {member.isLeader && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                      Leader
                                    </span>
                                  )}
                                </div>
                                {member.rank && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {member.rank}
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          No members assigned to this duty crew.
                        </p>
                      )
                    ) : (
                      <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div className="ml-3 space-y-1 flex-1">
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
