import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import SkillBadge from "./SkillBadge";

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

  // Filter users who have set a status and sort by availability
  const sortedStatuses = [...statuses]
    .filter(user => user.currentStatus) // Only include users who have set a status
    .sort((a, b) => {
      const statusOrder: Record<string, number> = {
        'available - station': 1,
        'available - satellite': 2,
        'delayed response': 3,
        'WFH': 4,
        'not available': 5
      };
      
      const statusA = a.currentStatus || 'not available';
      const statusB = b.currentStatus || 'not available';
      
      return (statusOrder[statusA] || 5) - (statusOrder[statusB] || 5);
    });

  return (
    <>
      {/* Duty Officer Section */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm p-3 rounded">
        <h2 className="text-xl font-bold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Duty Officer
        </h2>
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-800/30">
          <p className="text-lg font-medium text-red-700 dark:text-red-400">
            {dutyOfficer ? formatUserName(dutyOfficer) : 'None assigned'}
          </p>
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
              {sortedStatuses.length} {sortedStatuses.length === 1 ? 'member' : 'members'} with status set
            </span>
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">Member</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedStatuses.length > 0 ? (
                sortedStatuses.map((user) => {
                  // Get row background color based on status
                  const getRowColor = (status: string | undefined) => {
                    switch (status) {
                      case 'available - station':
                        return 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40 border-l-4 border-green-500 dark:border-green-600';
                      case 'available - satellite':
                        return 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40 border-l-4 border-green-400 dark:border-green-500';
                      case 'delayed response':
                        return 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-l-4 border-yellow-500 dark:border-yellow-600';
                      case 'WFH':
                        return 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border-l-4 border-blue-500 dark:border-blue-600';
                      case 'not available':
                        return 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/60 border-l-4 border-gray-400 dark:border-gray-600';
                      default:
                        return 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
                    }
                  };
                  
                  // Get text color based on status
                  const getTextColor = (status: string | undefined) => {
                    switch (status) {
                      case 'available - station':
                        return 'text-green-800 dark:text-green-300 font-medium';
                      case 'available - satellite':
                        return 'text-green-700 dark:text-green-400 font-medium';
                      case 'delayed response':
                        return 'text-yellow-800 dark:text-yellow-300 font-medium';
                      case 'WFH':
                        return 'text-blue-800 dark:text-blue-300 font-medium';
                      case 'not available':
                        return 'text-gray-800 dark:text-gray-300 font-medium';
                      default:
                        return '';
                    }
                  };
                  
                  // Extract the border classes from getRowColor for the first cell
                  const rowColorClasses = getRowColor(user.currentStatus);
                  const bgColorClass = rowColorClasses.split(' ').filter(cls => cls.startsWith('bg-') || cls.startsWith('hover:bg-') || cls.startsWith('dark:bg-') || cls.startsWith('dark:hover:bg-')).join(' ');
                  const borderClasses = rowColorClasses.split(' ').filter(cls => cls.startsWith('border-')).join(' ');
                  
                  // Check if user has skills to determine if we need a skills row
                  const hasSkills = user.skills && user.skills.length > 0;
                  
                  return (
                    <React.Fragment key={user._id}>
                      <tr className={`${bgColorClass} transition-colors`}>
                        <td className={`px-3 py-2 pb-${hasSkills ? '1' : '2'} ${borderClasses}`}>
                          <div className="font-medium">{formatUserName(user)}</div>
                        </td>
                        <td className={`px-3 py-2 pb-${hasSkills ? '1' : '2'}`}>
                          <div className="flex items-center">
                            <span className={`font-medium ${getTextColor(user.currentStatus)}`}>
                              {user.currentStatus === 'available - station' && 'Available - Station'}
                              {user.currentStatus === 'available - satellite' && 'Available - Satellite'}
                              {user.currentStatus === 'delayed response' && 'Delayed'}
                              {user.currentStatus === 'WFH' && 'WFH'}
                              {user.currentStatus === 'not available' && 'Unavailable'}
                            </span>
                            {user.statusUpdatedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                ({getRelativeTimeString(user.statusUpdatedAt)})
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Skills row - only rendered if user has skills */}
                      <UserSkillsRow 
                        userId={user._id} 
                        bgColorClass={bgColorClass} 
                        borderClasses={borderClasses} 
                      />
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// Component to display user skills in a separate row
interface UserSkillsRowProps {
  userId: Id<"users">;
  bgColorClass: string;
  borderClasses: string;
}

const UserSkillsRow: React.FC<UserSkillsRowProps> = ({ userId, bgColorClass, borderClasses }) => {
  // Fetch user skills
  const userSkills = useQuery(api.skills.getUserSkills, { userId });
  
  // If no skills or still loading, return empty fragment
  if (!userSkills || userSkills.length === 0) {
    return null;
  }
  
  // Use the same background color as the main row
  
  return (
    <tr className={`${bgColorClass} transition-colors border-b border-gray-200 dark:border-gray-700`}>
      <td colSpan={2} className={`px-3 py-1 ${borderClasses}`}>
        <div className="flex flex-wrap">
          {userSkills.map(skill => (
            <SkillBadge 
              key={skill._id} 
              code={skill.code} 
              name={skill.name} 
            />
          ))}
        </div>
      </td>
    </tr>
  );
};

export default BrigadeTab;
