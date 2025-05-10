export function DutyCrewPage() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Duty Crew Checks</h1>
      <div className="p-8 text-center">
        <div className="text-gray-500 mb-4">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Coming Soon</h2>
        <p className="text-gray-600 dark:text-gray-400">
          The Duty Crew Checks module is currently under development and will be available soon.
        </p>
      </div>
    </div>
  );
}
