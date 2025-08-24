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
    icon: Clock,
  },
  pending_wydv: {
    label: 'Pending - WYDV',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: AlertTriangle,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-800 border-green-200',
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
    <div className="space-y-2">
      {faults.map((fault) => {
        const StatusIcon = (statusConfig as any)[fault.status]?.icon || Clock;
        const priorityInfo = (priorityConfig as any)[fault.priority];

        return (
          <Card
            key={fault._id}
            className="p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4"
            style={{
              borderLeftColor:
                fault.status === 'pending_dmo'
                  ? '#f59e0b'
                  : fault.status === 'pending_wydv'
                  ? '#3b82f6'
                  : '#10b981',
            }}
            onClick={() => onFaultClick(fault._id)}
          >
            <div className="space-y-2">
              {/* Header with vehicle and status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{fault.vehicle}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${priorityInfo?.dotColor}`}></div>
                    <span className="text-xs font-medium text-muted-foreground">{priorityInfo?.label}</span>
                  </div>
                </div>
                <Badge className={`${(statusConfig as any)[fault.status]?.color} border text-xs px-2 py-0.5`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {(statusConfig as any)[fault.status]?.label}
                </Badge>
              </div>

              {/* Description section */}
              <div className="space-y-1">
                <h3 className="font-medium text-sm leading-tight">{fault.shortDescription}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                  {fault.longDescription}
                </p>
              </div>

              {/* Footer with date and reporter */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>{new Date(fault.dateReported).toLocaleDateString()}</span>
                <span>{fault.reportedByUser?.name || 'Unknown'}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
