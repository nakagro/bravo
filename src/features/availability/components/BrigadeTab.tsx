import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { getRelativeTimeCompact } from "../../../utils/dateUtils";
import SkillBadge from "./brigadetab/SkillBadge";
import ApplianceLocations from "./brigadetab/ApplianceLocations";

interface BrigadeTabProps {
  statuses: any[];
  dutyOfficer: any;
  handleDutyOfficerChange: (userId: string) => void;
}

const BrigadeTab: React.FC<BrigadeTabProps> = ({
  statuses,
  dutyOfficer,
  handleDutyOfficerChange
}) => {
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

  // Filter users who have set a status and group by status
  const usersWithStatus = statuses.filter(user => user.currentStatus);
  
  // Group users by their status
  const groupedByStatus: Record<string, any[]> = {
    'available - station': [],
    'available - satellite': [],
    'delayed response': [],
    'WFH': [],
    'not available': []
  };
  
  usersWithStatus.forEach(user => {
    const status = user.currentStatus || 'not available';
    if (groupedByStatus[status]) {
      groupedByStatus[status].push(user);
    }
  });
  
  // Sort users alphabetically by first name within each status group
  Object.keys(groupedByStatus).forEach(status => {
    groupedByStatus[status].sort((a, b) => {
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

  return (
    <>
      {/* Duty Officer Section */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm p-3 rounded">
        <h2 className="text-lg font-bold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Duty Officer:
          <span className="ml-2 text-red-700 dark:text-red-400">
            {dutyOfficer ? formatUserName(dutyOfficer) : 'None assigned'}
          </span>
        </h2>
      </div>
      
      {/* Appliance Locations Section */}
      <ApplianceLocations />
      
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
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {usersWithStatus.length > 0 ? (
            Object.entries(groupedByStatus).map(([status, users]) => {
              if (users.length === 0) return null;
              
              const info = statusInfo[status];
              
              return (
                <div key={status} className={`${info.bgColor}`}>
                  {/* Status Header */}
                  <div className={`px-3 py-1 border-l-4 border-b-2 ${info.borderColor}`}>
                    <h4 className={`font-semibold text-base ${info.textColor}`}>
                      {info.label}
                      <span className="ml-2 text-sm font-normal opacity-75">
                        ({users.length})
                      </span>
                    </h4>
                    {/* Skill counters temporarily hidden - will be re-enabled later */}
                    {/* {(status === 'available - station' || status === 'available - satellite') && (
                      <SkillCounters userIds={users.map(u => u._id)} textColor={info.textColor} />
                    )} */}
                  </div>
                  
                  {/* Users in this status */}
                  <div className="px-3 pb-1 space-y-0.5">
                    {users.map((user) => (
                      <div key={user._id} className="border-l-4 border-transparent py-0.5">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatUserName(user)}
                          </span>
                          {user.statusUpdatedAt && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {getRelativeTimeCompact(user.statusUpdatedAt)}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <UserSkillsInline userId={user._id} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No members found
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Compact inline skills renderer
interface UserSkillsInlineProps {
  userId: Id<"users">;
}

const UserSkillsInline: React.FC<UserSkillsInlineProps> = ({ userId }) => {
  const userSkills = useQuery(api.skills.getUserSkills, { userId });

  // Hide the special NONE skill from badges
  const filtered = (userSkills || []).filter((s) => s.code !== "NONE");

  return (
    <div className="flex flex-wrap items-center min-h-[18px] -mt-0.5">
      {filtered.map((skill) => (
        <SkillBadge key={skill._id} code={skill.code} name={skill.name} size="sm" />
      ))}
    </div>
  );
};

// Skill counters for crew viability (DR and BAi)
interface SkillCountersProps {
  userIds: Id<"users">[];
  textColor: string;
}

const SkillCounters: React.FC<SkillCountersProps> = ({ userIds, textColor }) => {
  // Query skills for all users in this group
  const allUserSkills = userIds.map(userId => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const skills = useQuery(api.skills.getUserSkills, { userId });
    return { userId, skills };
  });

  // Count users with DR (Driver) skill
  const drCount = allUserSkills.filter(({ skills }) => 
    skills?.some(skill => skill.code === 'DR')
  ).length;

  // Count users with BAi (Breathing Apparatus Internal) skill
  const baiCount = allUserSkills.filter(({ skills }) => 
    skills?.some(skill => skill.code === 'BAi')
  ).length;

  // Determine if counts meet requirements (1 DR, 2 BAi)
  const drMet = drCount >= 1;
  const baiMet = baiCount >= 2;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`font-medium ${drMet ? textColor : 'text-gray-500 dark:text-gray-400'}`}>
        DR ({drCount}/1)
      </span>
      <span className={`font-medium ${baiMet ? textColor : 'text-gray-500 dark:text-gray-400'}`}>
        BAi ({baiCount}/2)
      </span>
    </div>
  );
};

export default BrigadeTab;
