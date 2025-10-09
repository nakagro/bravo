import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  UserDetailsCard,
  SkillsSelector,
  LoadingState,
  UnauthorizedState,
  PasswordChangeForm,
  NotificationSettings,
  TestEmailButton
} from "../features/userSettings/components";

export function UserSettingsPage() {
  // Fetch the current user's data
  const user = useQuery(api.auth.loggedInUser);
  
  // Loading state
  if (user === undefined) {
    return <LoadingState />;
  }
  
  // If user is not found or not logged in
  if (user === null) {
    return <UnauthorizedState />;
  }

  // Format the user's name
  const fullName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.name || "Not provided";

  return (
    <div className="space-y-6" data-component="UserSettingsPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Settings</h1>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Member Details Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <UserDetailsCard 
            fullName={fullName}
            memberNumber={user.memberNumber}
            email={user.email}
            rank={user.rank}
          />
        </div>
        
        {/* Skills Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <SkillsSelector userId={user._id} />
        </div>
        
        {/* Notification Settings Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <NotificationSettings />
        </div>
        
        {/* Test Email Section */}
        {user.email && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
            <TestEmailButton 
              userEmail={user.email}
              userName={fullName}
            />
          </div>
        )}
        
        {/* Password Change Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <PasswordChangeForm />
        </div>
      </div>
    </div>
  );
}


