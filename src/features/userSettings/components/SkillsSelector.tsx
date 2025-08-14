import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface SkillsSelectorProps {
  userId: Id<"users">;
}

export function SkillsSelector({ userId }: SkillsSelectorProps) {
  // Fetch all available skills
  const allSkills = useQuery(api.skills.getSkills);
  
  // Fetch the user's current skills
  const userSkills = useQuery(api.skills.getUserSkills, { userId });
  
  // Mutations for adding and removing skills
  const addSkill = useMutation(api.skills.addSkillToUser);
  const removeSkill = useMutation(api.skills.removeSkillFromUser);
  const ensureNoneSkill = useMutation(api.skills.ensureNoneSkill);
  
  // Loading state
  const [updatingSkills, setUpdatingSkills] = useState<Record<string, boolean>>({});
  
  // Ensure the special NONE skill exists once component mounts
  useEffect(() => {
    // Fire and forget; idempotent on the server
    ensureNoneSkill().catch(() => void 0);
  }, [ensureNoneSkill]);

  const noneSkill = useMemo(() => allSkills?.find(s => s.code === "NONE"), [allSkills]);
  const hasNone = useMemo(() => userSkills?.some(s => s.code === "NONE") ?? false, [userSkills]);

  // Handle skill toggle for regular skills
  const toggleSkill = async (skillId: Id<"skills">) => {
    // Set updating state for this skill
    setUpdatingSkills(prev => ({ ...prev, [skillId]: true }));
    
    try {
      // Check if user already has this skill
      const hasSkill = userSkills?.some(skill => skill._id === skillId);
      
      if (hasSkill) {
        // Remove the skill
        await removeSkill({ skillId });
        toast.success("Skill removed");
      } else {
        // If selecting a real skill and NONE is set, remove NONE first
        if (hasNone && noneSkill) {
          await removeSkill({ skillId: noneSkill._id });
        }
        // Add the skill
        await addSkill({ skillId });
        toast.success("Skill added");
      }
    } catch (error) {
      toast.error("Failed to update skill");
      console.error("Error updating skill:", error);
    } finally {
      // Clear updating state
      setUpdatingSkills(prev => {
        const updated = { ...prev };
        delete updated[skillId];
        return updated;
      });
    }
  };

  // Toggle the special NONE skill (exclusive)
  const toggleNone = async () => {
    if (!noneSkill) {
      toast.error("None option unavailable. Please try again.");
      return;
    }
    const key = String(noneSkill._id);
    setUpdatingSkills(prev => ({ ...prev, [key]: true }));
    try {
      if (hasNone) {
        await removeSkill({ skillId: noneSkill._id });
        toast.success("None unset");
      } else {
        // Remove all real skills first
        const realSkillIds = (userSkills || [])
          .filter(s => s.code !== "NONE")
          .map(s => s._id);
        if (realSkillIds.length) {
          await Promise.all(realSkillIds.map(id => removeSkill({ skillId: id })));
        }
        // Add NONE
        await addSkill({ skillId: noneSkill._id });
        toast.success("Set to None");
      }
    } catch (error) {
      toast.error("Failed to update None option");
      console.error("Error toggling NONE skill:", error);
    } finally {
      setUpdatingSkills(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };
  
  // Check if a skill is in the user's skill set
  const hasSkill = (skillId: Id<"skills">) => {
    return userSkills?.some(skill => skill._id === skillId) ?? false;
  };
  
  // Loading state
  if (allSkills === undefined || userSkills === undefined) {
    return (
      <div className="animate-pulse">
        <div className="flex flex-wrap gap-2">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md w-24"
            />
          ))}
        </div>
      </div>
    );
  }
  
  // No skills available
  if (!allSkills || allSkills.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">No skills available in the system.</p>
      </div>
    );
  }
  
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        Your Skill Set
      </h2>

      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {allSkills.filter(s => s.code !== "NONE").map(skill => {
            const isActive = hasSkill(skill._id);
            const isUpdating = updatingSkills[skill._id];
            
            return (
              <button
                key={skill._id}
                onClick={() => toggleSkill(skill._id)}
                disabled={isUpdating}
                className={`
                  px-3 py-2 rounded-md text-sm font-medium transition-colors
                  flex items-center gap-2 w-full
                  ${isActive 
                    ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}
                  ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                {isUpdating ? (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <span className="flex-shrink-0">
                    {isActive ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </span>
                )}
                <span className="truncate">
                  {skill.name} <span className="text-xs opacity-70">({skill.code})</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* NONE option (placed last) */}
      <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1">
            {/* <div className="text-sm font-medium text-amber-900 dark:text-amber-200">Skills not set yet</div> */}
            <div className="text-xs text-amber-800/80 dark:text-amber-300/80">If you're a new member and you no longer have probationary status, choose "Set to None" for now. This just prevents the skill update reminders from nagging you until you have a displayable operational skill, you can change it anytime.</div>
          </div>
          <button
            onClick={toggleNone}
            disabled={!!(noneSkill && updatingSkills[String(noneSkill._id)])}
            className={`w-full sm:w-auto mt-1 sm:mt-0 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${hasNone
                ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
          >
            {hasNone ? 'Unset None' : 'Set to None'}
          </button>
        </div>
      </div>
    </div>
  );
}
