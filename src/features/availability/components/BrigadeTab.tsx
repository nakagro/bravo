import React from 'react';
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { getRelativeTimeCompact } from "../../../utils/dateUtils";
import { ChevronRight } from "lucide-react";
import SkillBadge from "./brigadetab/SkillBadge";
import ApplianceLocations from "./brigadetab/ApplianceLocations";

interface BrigadeTabProps {
  statuses: any[];
  dutyOfficer: any;
}

function BrigadeTab({
  statuses,
  dutyOfficer
}: BrigadeTabProps) {
  // Duty crew for this week
  const upcomingAssignments = useQuery(api.dutyCrew.getUpcomingDutyCrewAssignments, { count: 1 });
  const thisWeekAssignment = upcomingAssignments?.[0];

  // Get all user IDs that have a status set
  const usersWithStatus = statuses.filter(user => user.currentStatus);
  const userIds = usersWithStatus.map(user => user._id);
  
  // Fetch all skills for all users in ONE query (avoids N+1 problem)
  const batchSkills = useQuery(
    api.skills.getBatchUserSkills,
    userIds.length > 0 ? { userIds } : "skip"
  );
  
  // Format user display name
  const formatUserName = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.name) {
      return user.name;
    } else {
      return "Unknown User";
    }
  };

  // Group users by their status (merge 'at station' variants into base groups but track which are physically at station)
  const groupedByStatus: Record<string, any[]> = {
    'available - station': [],
    'available - satellite': [],
    'delayed response': [],
    'WFH': [],
    'not available': []
  };
  
  usersWithStatus.forEach(user => {
    let status = user.currentStatus || 'not available';
    // Merge 'at station' variants into their base groups but preserve the original status for indicator
    if (status === 'available - at station') {
      status = 'available - station';
    } else if (status === 'WFH - at station') {
      status = 'WFH';
    }
    if (groupedByStatus[status]) {
      groupedByStatus[status].push(user);
    }
  });
  
  // Sort users: 'at station' users first, then alphabetically by first name
  Object.keys(groupedByStatus).forEach(status => {
    groupedByStatus[status].sort((a, b) => {
      // 'At station' users come first (both available and WFH variants)
      const aAtStation = a.currentStatus === 'available - at station' || a.currentStatus === 'WFH - at station';
      const bAtStation = b.currentStatus === 'available - at station' || b.currentStatus === 'WFH - at station';
      if (aAtStation && !bAtStation) return -1;
      if (!aAtStation && bAtStation) return 1;
      // Then sort alphabetically
      const nameA = a.firstName || a.name || '';
      const nameB = b.firstName || b.name || '';
      return nameA.localeCompare(nameB);
    });
  });
  
  // Define status display information
  const statusInfo: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
    'available - station': {
      label: 'Available - Station',
      bgColor: 'bg-green-100 dark:bg-green-900/40',
      textColor: 'text-green-800 dark:text-green-300',
      borderColor: 'border-green-600 dark:border-green-400'
    },
    'available - satellite': {
      label: 'Available - Satellite',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-400',
      borderColor: 'border-green-400 dark:border-green-700'
    },
    'delayed response': {
      label: 'Delayed Response',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      borderColor: 'border-yellow-500 dark:border-yellow-600'
    },
    'WFH': {
      label: 'Working From Home',
      bgColor: 'bg-blue-50 dark:bg-blue-900/30',
      textColor: 'text-blue-800 dark:text-blue-300',
      borderColor: 'border-blue-500 dark:border-blue-600'
    },
    'not available': {
      label: 'Not Available',
      bgColor: 'bg-gray-50 dark:bg-gray-800/50',
      textColor: 'text-gray-800 dark:text-gray-300',
      borderColor: 'border-gray-400 dark:border-gray-600'
    }
  };
  
  // Check if user is physically at station (either available or WFH variant)
  const isAtStation = (user: any) => user.currentStatus === 'available - at station' || user.currentStatus === 'WFH - at station';

  return (
    <>
      {/* Top info row — Duty Officer/Crew + Appliance Locations side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Duty Officer + Duty Crew */}
        <div className="bg-white dark:bg-gray-800 shadow-sm p-3 rounded space-y-2">
          <h2 className="text-lg font-bold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Duty Officer:
            <span className="ml-2 text-red-700 dark:text-red-400">
              {dutyOfficer ? formatUserName(dutyOfficer) : 'None assigned'}
            </span>
          </h2>
          {thisWeekAssignment && (
            <Link
              to="/dutycrew"
              className="flex items-center group border-t border-gray-100 dark:border-gray-700 pt-2 pl-7"
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">
                This weeks Duty Crew:
                <span className="ml-1.5 font-semibold text-gray-700 dark:text-gray-300">
                  {thisWeekAssignment.isSpecial ? "All Crews" : thisWeekAssignment.dutyCrew.name}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 ml-2 text-gray-300 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
            </Link>
          )}
        </div>

        {/* Appliance Locations */}
        <div className="[&>div]:mb-0 [&>div]:h-full">
          <ApplianceLocations />
        </div>
      </div>

      {/* Brigade Members Status */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Brigade Members
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
              {usersWithStatus.length} {usersWithStatus.length === 1 ? 'member' : 'members'} with status set
            </span>
          </h3>
        </div>
        
        {usersWithStatus.length > 0 ? (
          <>
            {/* Station & Satellite - 2 columns on md+ screens */}
            {(groupedByStatus['available - station'].length > 0 || groupedByStatus['available - satellite'].length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-200 dark:border-gray-700">
                {/* Available - Station */}
                {groupedByStatus['available - station'].length > 0 && (
                  <div className={`${statusInfo['available - station'].bgColor} ${groupedByStatus['available - satellite'].length > 0 ? 'md:border-r md:border-gray-200 md:dark:border-gray-700' : ''}`}>
                    <div className={`px-3 py-1 border-l-4 border-b-2 ${statusInfo['available - station'].borderColor}`}>
                      <h4 className={`font-semibold text-base ${statusInfo['available - station'].textColor}`}>
                        {statusInfo['available - station'].label}
                        <span className="ml-2 text-sm font-normal opacity-75">
                          ({groupedByStatus['available - station'].length})
                        </span>
                      </h4>
                    </div>
                    <div className="px-3 pb-1 space-y-0.5">
                      {groupedByStatus['available - station'].map((user) => (
                        <div key={user._id} className="border-l-4 border-transparent py-0.5">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                              {isAtStation(user) && (
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" 
                                  viewBox="0 0 24 24" 
                                  fill="currentColor"
                                  aria-label="At Station"
                                >
                                  <title>At Station</title>
                                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                              )}
                              {formatUserName(user)}
                              {user.isBirthday && (
                                <span aria-label="Birthday" title="Birthday" className="text-base">
                                  🎂
                                </span>
                              )}
                            </span>
                            {user.statusUpdatedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {getRelativeTimeCompact(user.statusUpdatedAt)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5">
                            <UserSkillsInline skills={batchSkills?.[user._id] || []} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Available - Satellite */}
                {groupedByStatus['available - satellite'].length > 0 && (
                  <div className={`${statusInfo['available - satellite'].bgColor}`}>
                    <div className={`px-3 py-1 border-l-4 border-b-2 ${statusInfo['available - satellite'].borderColor}`}>
                      <h4 className={`font-semibold text-base ${statusInfo['available - satellite'].textColor}`}>
                        {statusInfo['available - satellite'].label}
                        <span className="ml-2 text-sm font-normal opacity-75">
                          ({groupedByStatus['available - satellite'].length})
                        </span>
                      </h4>
                    </div>
                    <div className="px-3 pb-1 space-y-0.5">
                      {groupedByStatus['available - satellite'].map((user) => (
                        <div key={user._id} className="border-l-4 border-transparent py-0.5">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                              {formatUserName(user)}
                              {user.isBirthday && (
                                <span aria-label="Birthday" title="Birthday" className="text-base">
                                  🎂
                                </span>
                              )}
                            </span>
                            {user.statusUpdatedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {getRelativeTimeCompact(user.statusUpdatedAt)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5">
                            <UserSkillsInline skills={batchSkills?.[user._id] || []} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Other statuses - full width, stacked */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {(['delayed response', 'WFH', 'not available'] as const).map((status) => {
                const users = groupedByStatus[status];
                if (users.length === 0) return null;
                
                const info = statusInfo[status];
                
                return (
                  <div key={status} className={`${info.bgColor}`}>
                    <div className={`px-3 py-1 border-l-4 border-b-2 ${info.borderColor}`}>
                      <h4 className={`font-semibold text-base ${info.textColor}`}>
                        {info.label}
                        <span className="ml-2 text-sm font-normal opacity-75">
                          ({users.length})
                        </span>
                      </h4>
                    </div>
                    <div className="px-3 pb-1 space-y-0.5">
                      {users.map((user) => (
                        <div key={user._id} className="border-l-4 border-transparent py-0.5">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                              {isAtStation(user) && (
                                <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  className={`h-3.5 w-3.5 flex-shrink-0 ${status === 'WFH' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}
                                  viewBox="0 0 24 24" 
                                  fill="currentColor"
                                  aria-label="At Station"
                                >
                                  <title>At Station</title>
                                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                              )}
                              {formatUserName(user)}
                              {user.isBirthday && (
                                <span aria-label="Birthday" title="Birthday" className="text-base">
                                  🎂
                                </span>
                              )}
                            </span>
                            {user.statusUpdatedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {getRelativeTimeCompact(user.statusUpdatedAt)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5">
                            <UserSkillsInline skills={batchSkills?.[user._id] || []} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No members found
          </div>
        )}
      </div>
    </>
  );
}

// Compact inline skills renderer - now receives skills as props instead of querying
interface UserSkillsInlineProps {
  skills: any[];
}

function UserSkillsInline({ skills }: UserSkillsInlineProps) {
  // Hide the special NONE skill from badges
  const filtered = (skills || []).filter((s: any) => s.code !== "NONE");

  return (
    <div className="flex flex-wrap items-center min-h-[18px] -mt-0.5">
      {filtered.map((skill) => (
        <SkillBadge key={skill._id} code={skill.code} name={skill.name} size="sm" />
      ))}
    </div>
  );
}

export default BrigadeTab;
