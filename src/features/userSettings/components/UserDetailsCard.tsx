import { Id } from "../../../../convex/_generated/dataModel";

interface UserDetailsCardProps {
  fullName: string;
  memberNumber?: string;
  email?: string;
  rank?: string;
}

export function UserDetailsCard({ fullName, memberNumber, email, rank }: UserDetailsCardProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        Member Details
      </h2>
      
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-w-2xl">
        <div className="space-y-4">
          {/* Name */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</h3>
            <p className="mt-1 text-base font-medium text-gray-900 dark:text-gray-100">{fullName}</p>
          </div>
          
          {/* CFA Number */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">CFA Number</h3>
            <p className="mt-1 text-base font-medium text-gray-900 dark:text-gray-100">
              {memberNumber || "Not provided"}
            </p>
          </div>
          
          {/* Email */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</h3>
            <p className="mt-1 text-base font-medium text-gray-900 dark:text-gray-100">
              {email || "Not provided"}
            </p>
          </div>
          
          {/* Rank */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Rank</h3>
            <p className="mt-1 text-base font-medium text-gray-900 dark:text-gray-100">
              {rank || "Member"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
