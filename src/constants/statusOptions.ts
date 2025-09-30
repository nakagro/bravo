// Static status options - no need for reactive queries since these never change
export const MAIN_STATUS_OPTIONS = [
  { 
    value: 'available - station', 
    label: 'Available - Station',
    shortLabel: 'Available - Station',
    icon: 'M5 13l4 4L19 7',
    backgroundColorClass: 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-600',
    textColorClass: 'text-green-800 dark:text-green-300',
    buttonColorClass: 'text-green-700 dark:text-green-400',
    buttonHoverColorClass: 'hover:bg-green-50 dark:hover:bg-green-900/20',
    buttonActiveColorClass: 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600',
    buttonBorderColorClass: 'border-green-300 dark:border-green-800/50',
  },
  { 
    value: 'available - satellite', 
    label: 'Available - Satellite',
    shortLabel: 'Available - Satellite',
    icon: 'M5 13l4 4L19 7',
    backgroundColorClass: 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 dark:border-green-500',
    textColorClass: 'text-green-700 dark:text-green-400',
    buttonColorClass: 'text-green-700 dark:text-green-400',
    buttonHoverColorClass: 'hover:bg-green-50 dark:hover:bg-green-900/20',
    buttonActiveColorClass: 'bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-500',
    buttonBorderColorClass: 'border-green-300 dark:border-green-800/50',
  },
  { 
    value: 'delayed response', 
    label: 'Delayed',
    shortLabel: 'Delayed',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    backgroundColorClass: 'bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 dark:border-yellow-600',
    textColorClass: 'text-yellow-800 dark:text-yellow-300',
    buttonColorClass: 'text-yellow-700 dark:text-yellow-400',
    buttonHoverColorClass: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
    buttonActiveColorClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 dark:border-yellow-600',
    buttonBorderColorClass: 'border-yellow-300 dark:border-yellow-800/50',
  },
  { 
    value: 'WFH', 
    label: 'Working From Home',
    shortLabel: 'WFH',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    backgroundColorClass: 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-600',
    textColorClass: 'text-blue-800 dark:text-blue-300',
    buttonColorClass: 'text-blue-700 dark:text-blue-400',
    buttonHoverColorClass: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    buttonActiveColorClass: 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-600',
    buttonBorderColorClass: 'border-blue-300 dark:border-blue-800/50',
  },
  { 
    value: 'not available', 
    label: 'Unavailable',
    shortLabel: 'Unavailable',
    icon: 'M6 18L18 6M6 6l12 12',
    backgroundColorClass: 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 dark:border-gray-600',
    textColorClass: 'text-gray-800 dark:text-gray-300',
    buttonColorClass: 'text-gray-700 dark:text-gray-400',
    buttonHoverColorClass: 'hover:bg-gray-100 dark:hover:bg-gray-700/50',
    buttonActiveColorClass: 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-500 dark:border-gray-600',
    buttonBorderColorClass: 'border-gray-300 dark:border-gray-600/50',
  },
] as const;

export const NEXT_STATUS_OPTIONS = [
  { 
    value: 'available - station', 
    label: 'Available - Station', 
    color: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
  },
  { 
    value: 'available - satellite', 
    label: 'Available - Satellite', 
    color: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
  },
  { 
    value: 'delayed response', 
    label: 'Delayed', 
    color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' 
  },
  { 
    value: 'WFH', 
    label: 'WFH', 
    color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
  },
  { 
    value: 'not available', 
    label: 'Unavailable', 
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
  },
  { 
    value: 'reset', 
    label: 'Clear Status', 
    color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' 
  },
] as const;

// Type exports for TypeScript
export type MainStatusOption = typeof MAIN_STATUS_OPTIONS[number];
export type NextStatusOption = typeof NEXT_STATUS_OPTIONS[number];
