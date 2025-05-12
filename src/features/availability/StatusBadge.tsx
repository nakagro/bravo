import React from 'react';

type StatusType = 'available' | 'not available' | 'delayed response' | 'WFH' | undefined | null;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

/**
 * A component that displays a user's status as a colored badge
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusColor = (status: StatusType): string => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'delayed response':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'WFH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'not available':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: StatusType): string => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'delayed response':
        return 'Delayed';
      case 'WFH':
        return 'WFH';
      case 'not available':
        return 'Unavailable';
      default:
        return 'Not Set';
    }
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)} ${className}`}
    >
      {getStatusText(status)}
    </span>
  );
};

export default StatusBadge;
