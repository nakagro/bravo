import React, { useState, useMemo } from 'react';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Clock, AlertTriangle, CheckCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Id } from '../../../convex/_generated/dataModel';

type VehicleFault = {
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

type SortField = 'vehicle' | 'priority' | 'status' | 'dateReported' | 'reporter' | 'shortDescription';
type SortDirection = 'asc' | 'desc';

interface VehicleFaultsTableProps {
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
};

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
};

export function VehicleFaultsTable({ faults, onFaultClick }: VehicleFaultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('dateReported');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedFaults = useMemo(() => {
    return [...faults].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'vehicle':
          aValue = a.vehicle;
          bValue = b.vehicle;
          break;
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'status':
          const statusOrder = { resolved: 1, pending_dmo: 2, pending_wydv: 3 };
          aValue = statusOrder[a.status];
          bValue = statusOrder[b.status];
          break;
        case 'dateReported':
          aValue = a.dateReported;
          bValue = b.dateReported;
          break;
        case 'reporter':
          aValue = a.reportedByUser?.name || 'Unknown';
          bValue = b.reportedByUser?.name || 'Unknown';
          break;
        case 'shortDescription':
          aValue = a.shortDescription.toLowerCase();
          bValue = b.shortDescription.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [faults, sortField, sortDirection]);

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => {
    const isActive = sortField === field;
    const Icon = isActive 
      ? (sortDirection === 'asc' ? ChevronUp : ChevronDown)
      : ChevronsUpDown;

    return (
      <TableHead 
        className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <Icon className={`h-4 w-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
        </div>
      </TableHead>
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="vehicle" className="w-[100px]">Vehicle</SortableHeader>
            <SortableHeader field="priority" className="w-[80px]">Priority</SortableHeader>
            <SortableHeader field="shortDescription" className="min-w-[200px]">Description</SortableHeader>
            <SortableHeader field="status" className="w-[160px]">Status</SortableHeader>
            <SortableHeader field="dateReported" className="w-[100px]">Reported</SortableHeader>
            <SortableHeader field="reporter" className="w-[120px]">Reporter</SortableHeader>
            <TableHead className="w-[100px]">EAM #</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFaults.map((fault) => {
            const StatusIcon = statusConfig[fault.status]?.icon || Clock;
            const priorityInfo = priorityConfig[fault.priority];
            
            return (
              <TableRow 
                key={fault._id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onFaultClick(fault._id)}
              >
                <TableCell className="font-medium">
                  {fault.vehicle}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${priorityInfo?.dotColor}`}></div>
                    <span className="text-xs font-medium">{priorityInfo?.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm leading-tight">
                      {fault.shortDescription}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {fault.longDescription}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge className={`${statusConfig[fault.status]?.color} border text-xs whitespace-nowrap inline-flex items-center`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig[fault.status]?.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(fault.dateReported).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm">
                  {fault.reportedByUser?.name || 'Unknown'}
                </TableCell>
                <TableCell className="text-sm">
                  {fault.eamRequestNumber || '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {faults.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No faults to display
        </div>
      )}
    </div>
  );
}
