export function UnauthorizedState() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">User Settings</h1>
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Please sign in to view your settings</h2>
      </div>
    </div>
  );
}
