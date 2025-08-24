import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Filter as FilterIcon, ChevronDown, ChevronUp, X } from 'lucide-react';

type VehicleType = 'Pumper' | 'Tanker' | 'FCV' | 'all';
type StatusType = 'pending_dmo' | 'pending_wydv' | 'resolved' | 'all';

type Stats = {
  byStatus: Record<string, number>;
  byVehicle: Record<string, number>;
  byPriority: Record<string, number>;
};

interface VehicleFaultFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;

  selectedStatus: StatusType;
  onStatusChange: (value: StatusType) => void;

  selectedVehicle: VehicleType;
  onVehicleChange: (value: VehicleType) => void;

  selectedPriority: 'low' | 'medium' | 'high' | 'all';
  onPriorityChange: (value: 'low' | 'medium' | 'high' | 'all') => void;

  stats: Stats;
  totalCount: number;

  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;

  statusConfig: Record<string, { label: string }>;
  vehicleLabels: Record<string, string>;
  priorityConfig: Record<string, { label: string; dotColor: string }>;
}

export function VehicleFaultFilters({
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedVehicle,
  onVehicleChange,
  selectedPriority,
  onPriorityChange,
  stats,
  totalCount,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onClearFilters,
  statusConfig,
  vehicleLabels,
  priorityConfig,
}: VehicleFaultFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar and Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search faults..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onToggleFilters} variant="outline" className="flex items-center gap-2 px-3">
          <FilterIcon className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
              {[selectedStatus !== 'all', selectedVehicle !== 'all', selectedPriority !== 'all'].filter(Boolean).length}
            </span>
          )}
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {hasActiveFilters && (
          <Button onClick={onClearFilters} variant="outline" className="px-3" title="Clear Filters">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collapsible Filter Grid */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select value={selectedStatus} onValueChange={(value) => onStatusChange(value as StatusType)}>
              <SelectTrigger className="bg-white dark:bg-gray-700">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses ({totalCount || 0})</SelectItem>
                {Object.entries(statusConfig).map(([status, config]) => {
                  const count = stats.byStatus[status] || 0;
                  return (
                    <SelectItem key={status} value={status}>
                      {config.label} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vehicle</Label>
            <Select value={selectedVehicle} onValueChange={(value) => onVehicleChange(value as VehicleType)}>
              <SelectTrigger className="bg-white dark:bg-gray-700">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles ({totalCount || 0})</SelectItem>
                {Object.entries(vehicleLabels).map(([key, vehicle]) => {
                  const count = stats.byVehicle[key] || 0;
                  return (
                    <SelectItem key={key} value={key}>
                      {vehicle} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Priority</Label>
            <Select value={selectedPriority} onValueChange={(value) => onPriorityChange(value as any)}>
              <SelectTrigger className="bg-white dark:bg-gray-700">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities ({totalCount || 0})</SelectItem>
                {Object.entries(priorityConfig).map(([key, config]) => {
                  const count = stats.byPriority[key] || 0;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
                        {config.label} ({count})
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
