import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { cn } from "../../../../lib/utils";
import { ChevronDown, ChevronRight, HomeIcon, MapPinIcon, GlobeIcon, XIcon, Users } from 'lucide-react';
import SkillBadge from "../brigadetab/SkillBadge";

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
  setSelectedDetailDate?: (date: any) => void;
  setShowDetailModal?: (show: boolean) => void;
}

type AvailabilityType = 'local' | 'shortHaul' | 'longHaul' | 'notAvailable';

const BrigadeView: React.FC<BrigadeViewProps> = ({
  aggregatedDeploymentAvailability,
}) => {
  // Selected day (default to first day / today)
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  
  // Get selected day's data
  const selectedDayData = aggregatedDeploymentAvailability[selectedDateIndex] || null;
  
  // Get all user IDs from the selected day for batch skills query
  const userIds = selectedDayData?.users.map(u => u.userId as Id<"users">) || [];
  
  // Fetch all skills for all users in ONE query (avoids N+1 problem)
  const batchSkills = useQuery(
    api.skills.getBatchUserSkills,
    userIds.length > 0 ? { userIds } : "skip"
  );

  // Expanded sections (all expanded by default)
  const [expandedSections, setExpandedSections] = useState<Record<AvailabilityType, boolean>>({
    local: true,
    shortHaul: true,
    longHaul: true,
    notAvailable: true,
  });

  // Ref for horizontal scroll container
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to show selected day on mount and when selection changes
  useEffect(() => {
    if (scrollRef.current && aggregatedDeploymentAvailability.length > 0) {
      const container = scrollRef.current;
      const buttons = container.querySelectorAll('button');
      const selectedButton = buttons[selectedDateIndex];
      if (selectedButton) {
        // Scroll the selected button into view with some padding
        const containerRect = container.getBoundingClientRect();
        const buttonRect = selectedButton.getBoundingClientRect();
        const scrollLeft = buttonRect.left - containerRect.left + container.scrollLeft - 8;
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
      }
    }
  }, [selectedDateIndex, aggregatedDeploymentAvailability.length]);

  // Toggle section expansion
  const toggleSection = (section: AvailabilityType) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Group users by availability type
  const groupUsersByAvailability = (users: BrigadeViewProps['aggregatedDeploymentAvailability'][0]['users']) => {
    const groups: Record<AvailabilityType, typeof users> = {
      local: [],
      shortHaul: [],
      longHaul: [],
      notAvailable: [],
    };

    users.forEach(user => {
      if (user.availability.notAvailable) {
        groups.notAvailable.push(user);
      } else {
        if (user.availability.local) groups.local.push(user);
        if (user.availability.shortHaul) groups.shortHaul.push(user);
        if (user.availability.longHaul) groups.longHaul.push(user);
      }
    });

    return groups;
  };

  // Get display name for user
  const getDisplayName = (user: BrigadeViewProps['aggregatedDeploymentAvailability'][0]['users'][0]) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || 'Unknown User';
  };

  // Section config for consistent styling
  const sectionConfig: Record<AvailabilityType, {
    label: string;
    icon: React.ReactNode;
    bgColor: string;
    textColor: string;
    borderColor: string;
    iconBg: string;
  }> = {
    local: {
      label: 'Local',
      icon: <HomeIcon className="h-4 w-4" />,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-800 dark:text-green-300',
      borderColor: 'border-green-200 dark:border-green-800',
      iconBg: 'bg-green-100 dark:bg-green-800/50',
    },
    shortHaul: {
      label: 'Short Haul',
      icon: <MapPinIcon className="h-4 w-4" />,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      iconBg: 'bg-yellow-100 dark:bg-yellow-800/50',
    },
    longHaul: {
      label: 'Long Haul',
      icon: <GlobeIcon className="h-4 w-4" />,
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-800 dark:text-orange-300',
      borderColor: 'border-orange-200 dark:border-orange-800',
      iconBg: 'bg-orange-100 dark:bg-orange-800/50',
    },
    notAvailable: {
      label: 'Not Available',
      icon: <XIcon className="h-4 w-4" />,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-800 dark:text-red-300',
      borderColor: 'border-red-200 dark:border-red-800',
      iconBg: 'bg-red-100 dark:bg-red-800/50',
    },
  };

  // Calculate total unique available (not "not available")
  const getUniqueAvailable = (counts: BrigadeViewProps['aggregatedDeploymentAvailability'][0]['counts']) => {
    return counts.total - counts.notAvailable;
  };

  return (
    <div className="flex flex-col">
      {/* Horizontal day selector strip */}
      <div className="relative">
        {/* Scroll hint gradient - right side */}
        <div className="absolute right-0 top-0 bottom-3 w-6 bg-gradient-to-l from-white dark:from-gray-800 to-transparent pointer-events-none z-10" />

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1 pr-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {aggregatedDeploymentAvailability.map((dateData, index) => {
            const date = new Date(dateData.date);
            // Use UTC timezone for formatting since dates are stored as UTC midnight
            const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date);
            const dayNum = date.getUTCDate();
            const isSelected = index === selectedDateIndex;
            const uniqueAvailable = getUniqueAvailable(dateData.counts);
            const hasResponses = dateData.counts.total > 0;
            // Compare today's UTC date with the stored UTC date
            const todayUTC = new Date();
            const todayUTCString = `${todayUTC.getUTCFullYear()}-${todayUTC.getUTCMonth()}-${todayUTC.getUTCDate()}`;
            const dateUTCString = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
            const isToday = todayUTCString === dateUTCString;

            return (
              <button
                key={dateData.date}
                onClick={() => setSelectedDateIndex(index)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border transition-all min-w-[60px]",
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                  isToday && !isSelected && "ring-2 ring-blue-300 dark:ring-blue-700"
                )}
              >
                <span className="text-xs font-medium">{dayName}</span>
                <span className="text-lg font-bold">{dayNum}</span>
                {hasResponses ? (
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    {/* Mini indicators showing availability breakdown - stacked vertically */}
                    {dateData.counts.local > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        {dateData.counts.local}
                      </span>
                    )}
                    {dateData.counts.shortHaul > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                        {dateData.counts.shortHaul}
                      </span>
                    )}
                    {dateData.counts.longHaul > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        {dateData.counts.longHaul}
                      </span>
                    )}
                    {uniqueAvailable === 0 && dateData.counts.notAvailable > 0 && (
                      <span className="text-[10px] font-medium text-red-500 dark:text-red-400">
                        —
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">—</span>
                )}
              </button>
            );
          })}
          {/* Spacer to ensure last item can scroll into view */}
          <div className="flex-shrink-0 w-4" aria-hidden="true" />
        </div>
      </div>

      {/* Selected day content */}
      {selectedDayData ? (
        <>
          {/* Day header with summary */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(selectedDayData.date))}
            </h3>
          </div>

          {/* Grouped member sections */}
          <div className="space-y-3">
            {(['local', 'shortHaul', 'longHaul', 'notAvailable'] as AvailabilityType[]).map((type) => {
              const config = sectionConfig[type];
              const groups = groupUsersByAvailability(selectedDayData.users);
              const users = groups[type];
              const isExpanded = expandedSections[type];

              return (
                <div
                  key={type}
                  className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  {/* Section header - always visible */}
                  <button
                    onClick={() => toggleSection(type)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-2.5 rounded-lg",
                      config.bgColor
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        config.iconBg,
                        config.textColor
                      )}>
                        {config.icon}
                      </div>
                      <span className={cn("font-medium text-sm", config.textColor)}>
                        {config.label}
                      </span>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        config.iconBg,
                        config.textColor
                      )}>
                        {users.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className={cn("h-4 w-4", config.textColor)} />
                    ) : (
                      <ChevronRight className={cn("h-4 w-4", config.textColor)} />
                    )}
                  </button>

                  {/* Expanded member list */}
                  {isExpanded && (
                    <div className="px-2 py-2">
                      {users.length > 0 ? (
                        <div className="space-y-1">
                          {users.map((user) => (
                            <div
                              key={user.userId}
                              className="flex items-start justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0 gap-2"
                            >
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {getDisplayName(user)}
                                </span>
                                {user.message && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5 line-clamp-2">
                                    "{user.message}"
                                  </span>
                                )}
                              </div>
                              <DeploymentSkillBadges userId={user.userId as Id<"users">} skills={batchSkills?.[user.userId] || []} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
                          No members
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">No deployment data available</p>
        </div>
      )}

      {/* Empty state when no data at all */}
      {aggregatedDeploymentAvailability.length === 0 && (
        <div className="text-center py-10">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Users className="h-6 w-6 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">No deployment data available</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Members will appear here once they set their availability</p>
        </div>
      )}
    </div>
  );
};

// Deployment-specific skill badges - only shows DR, BAi, PC1, TC1
const DEPLOYMENT_SKILLS = ['DR', 'BAi', 'PC1', 'TC1'];

interface DeploymentSkillBadgesProps {
  userId: Id<"users">;
  skills: any[];
}

const DeploymentSkillBadges: React.FC<DeploymentSkillBadgesProps> = ({ userId, skills }) => {
  // Filter to only show deployment-relevant skills
  const filtered = (skills || []).filter((s: any) => DEPLOYMENT_SKILLS.includes(s.code));

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end flex-shrink-0">
      {filtered.map((skill) => (
        <SkillBadge key={skill._id} code={skill.code} name={skill.name} size="sm" />
      ))}
    </div>
  );
};

export default BrigadeView;
