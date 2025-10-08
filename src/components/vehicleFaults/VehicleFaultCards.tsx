import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Id } from '../../../convex/_generated/dataModel';

export type VehicleFault = {
  _id: Id<'vehicleFaults'>;
  vehicle: 'Pumper' | 'Tanker' | 'FCV';
  shortDescription: string;
  longDescription: string;
  status: 'pending_dmo' | 'pending_wydv' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  dateReported: number;
  dateLogged?: number;
  eamRequestNumber?: string;
  reportedByUser?: {
    _id: Id<'users'>;
    name: string | undefined;
    firstName: string | undefined;
    lastName: string | undefined;
  };
  updatedByUser?: {
    _id: Id<'users'>;
    name: string | undefined;
    firstName: string | undefined;
    lastName: string | undefined;
  };
  notes?: string;
  reportedBy: Id<'users'>;
  updatedBy?: Id<'users'>;
  createdAt: number;
  updatedAt: number;
};

interface VehicleFaultCardsProps {
  faults: VehicleFault[];
  onFaultClick: (faultId: Id<'vehicleFaults'>) => void;
}

const statusConfig = {
  pending_dmo: {
    label: 'Pending - DMO',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    hoverBgColor: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
    borderColor: 'border-yellow-400 dark:border-yellow-500',
    icon: Clock,
  },
  pending_wydv: {
    label: 'Pending - WYDV',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    hoverBgColor: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
    borderColor: 'border-blue-400 dark:border-blue-500',
    icon: AlertTriangle,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-800 border-green-200',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    hoverBgColor: 'hover:bg-green-100 dark:hover:bg-green-900/30',
    borderColor: 'border-green-400 dark:border-green-500',
    icon: CheckCircle,
  },
} as const;

const priorityConfig = {
  low: {
    label: 'Low',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dotColor: 'bg-gray-400',
  },
  medium: {
    label: 'Medium',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-400',
  },
  high: {
    label: 'High',
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
  },
} as const;

export function VehicleFaultCards({ faults, onFaultClick }: VehicleFaultCardsProps) {
  if (!faults || faults.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {faults.map((fault) => {
        const statusInfo = (statusConfig as any)[fault.status];
        const StatusIcon = statusInfo?.icon || Clock;
        const priorityInfo = (priorityConfig as any)[fault.priority];

        return (
          <div
            key={fault._id}
            className={`p-4 border-l-4 rounded-r-md cursor-pointer transition-colors ${statusInfo?.bgColor} ${statusInfo?.hoverBgColor} ${statusInfo?.borderColor}`}
            onClick={() => onFaultClick(fault._id)}
          >
            <div className="space-y-2">
              {/* Header with vehicle and status */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base text-gray-900 dark:text-white">{fault.vehicle}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${priorityInfo?.dotColor}`}></div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{priorityInfo?.label}</span>
                  </div>
                </div>
                <Badge className={`${statusInfo?.color} border text-xs px-2 py-0.5 flex-shrink-0 hover:bg-transparent pointer-events-none`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo?.label}
                </Badge>
              </div>

              {/* Description section */}
              <div className="space-y-1">
                <h3 className="font-medium text-sm leading-tight text-gray-900 dark:text-white">{fault.shortDescription}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                  {fault.longDescription}
                </p>
              </div>

              {/* Footer with date and reporter */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                <span>{new Date(fault.dateReported).toLocaleDateString()}</span>
                <span>{fault.reportedByUser?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
