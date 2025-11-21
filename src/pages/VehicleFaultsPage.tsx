import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Plus, Truck, AlertTriangle, CheckCircle, Clock, Wrench, X, Search, Filter, Calendar, User, ChevronDown, ChevronUp, Grid3X3, Table2 } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { Id } from '../../convex/_generated/dataModel';
import { VehicleFaultDetail } from '../components/vehicleFaults/VehicleFaultDetail';
import { VehicleFaultsTable } from '../components/vehicleFaults/VehicleFaultsTable';
import { VehicleFaultCards } from '../components/vehicleFaults/VehicleFaultCards';
import { VehicleFaultAddDialog } from '../components/vehicleFaults/VehicleFaultAddDialog';
import { VehicleFaultFilters } from '../components/vehicleFaults/VehicleFaultFilters';
import { VehicleFaultAuditTrail } from '../components/vehicleFaults/VehicleFaultAuditTrail';

type VehicleType = 'Pumper' | 'Tanker' | 'FCV';
type StatusType = 'pending_dmo' | 'pending_wydv' | 'resolved';

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

const vehicleLabels = {
  Pumper: 'Pumper',
  Tanker: 'Tanker',
  FCV: 'FCV',
};

export function VehicleFaultsPage() {
  const [activeTab, setActiveTab] = useState<'faults' | 'audit'>('faults');
  const [selectedStatus, setSelectedStatus] = useState<StatusType | 'all'>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'medium' | 'high' | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFault, setSelectedFault] = useState<Id<'vehicleFaults'> | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const faults = useQuery(api.vehicleFaults.getVehicleFaults);
  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Update indicator position when active tab changes or component mounts
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab, faults]);


  const createFault = useMutation(api.vehicleFaults.createVehicleFault);
  const updateFault = useMutation(api.vehicleFaults.updateVehicleFault);

  const filteredFaults = useMemo(() => {
    if (!faults) return [];

    return faults.filter(fault => {
      const matchesStatus = selectedStatus === 'all' || fault.status === selectedStatus;
      const matchesVehicle = selectedVehicle === 'all' || fault.vehicle === selectedVehicle;
      const matchesPriority = selectedPriority === 'all' || fault.priority === selectedPriority;
      const matchesSearch = searchTerm === '' ||
        fault.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fault.longDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fault.vehicle.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesVehicle && matchesPriority && matchesSearch;
    });
  }, [faults, selectedStatus, selectedVehicle, selectedPriority, searchTerm]);

  const stats = useMemo(() => {
    if (!faults) return { byStatus: {}, byVehicle: {}, byPriority: {} };

    const byStatus = faults.reduce((acc, fault) => {
      acc[fault.status] = (acc[fault.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byVehicle = faults.reduce((acc, fault) => {
      acc[fault.vehicle] = (acc[fault.vehicle] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPriority = faults.reduce((acc, fault) => {
      acc[fault.priority] = (acc[fault.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      byStatus,
      byVehicle,
      byPriority
    };
  }, [faults]);

  const handleCreateFault = async (data: {
    vehicle: VehicleType;
    shortDescription: string;
    longDescription: string;
    notes?: string;
    eamRequestNumber?: string;
    dateReported: number;
    dateLogged?: number;
    priority: 'low' | 'medium' | 'high';
  }) => {
    try {
      await createFault({
        dateReported: data.dateReported,
        dateLogged: data.dateLogged,
        vehicle: data.vehicle,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription,
        eamRequestNumber: data.eamRequestNumber,
        priority: data.priority,
        notes: data.notes,
      });
      toast({
        title: "Fault Reported",
        description: "Vehicle fault has been successfully reported.",
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to report vehicle fault. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setSelectedStatus('all');
    setSelectedVehicle('all');
    setSelectedPriority('all');
    setSearchTerm('');
  };

  const hasActiveFilters = selectedStatus !== 'all' || selectedVehicle !== 'all' || selectedPriority !== 'all' || searchTerm !== '';

  // Filters extracted to VehicleFaultFilters component

  // Card view extracted to VehicleFaultCards component

  if (!faults) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicle Faults</h1>

        <div className={`flex items-center gap-2 flex-shrink-0 ${activeTab === 'faults' ? '' : 'invisible'}`}>
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-3 gap-1"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden lg:inline">Cards</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 px-3 gap-1"
            >
              <Table2 className="w-4 h-4" />
              <span className="hidden lg:inline">Table</span>
            </Button>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Report</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['faults'] = el; }}
            onClick={() => setActiveTab('faults')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === 'faults'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Faults
          </button>
          <button
            ref={(el) => { tabRefs.current['audit'] = el; }}
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === 'audit'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Audit
          </button>
        </nav>
        {/* Animated indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'faults' ? (
          <>
            <div className="mb-4">
              <VehicleFaultFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedStatus={selectedStatus}
                onStatusChange={(v) => setSelectedStatus(v as StatusType | 'all')}
                selectedVehicle={selectedVehicle}
                onVehicleChange={(v) => setSelectedVehicle(v as VehicleType | 'all')}
                selectedPriority={selectedPriority}
                onPriorityChange={(v) => setSelectedPriority(v as 'low' | 'medium' | 'high' | 'all')}
                stats={stats}
                totalCount={faults?.length || 0}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(!showFilters)}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
                statusConfig={statusConfig as any}
                vehicleLabels={vehicleLabels as any}
                priorityConfig={priorityConfig as any}
              />
            </div>

            {filteredFaults.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div className="mb-6">
                  <Truck className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {searchTerm ? 'No Matches' :
                      !hasActiveFilters ? 'No Faults' :
                        'No Results'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 px-4">
                    {searchTerm ? `No faults match "${searchTerm}"` :
                      !hasActiveFilters ?
                        'No faults reported yet.' :
                        'Try different filters.'}
                  </p>
                </div>

                <div className="space-y-2">
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="w-full max-w-xs"
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="gap-2 w-full max-w-xs"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                    {(faults?.length || 0) === 0 ? 'Report First Fault' : 'Report Fault'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {/* Compact results summary */}
                {hasActiveFilters && (
                  <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium">{filteredFaults.length}</span> of{' '}
                        <span className="font-medium">{faults?.length || 0}</span> faults
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-auto text-xs"
                        onClick={clearFilters}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                {/* Content based on view mode */}
                {viewMode === 'cards' ? (
                  <VehicleFaultCards
                    faults={filteredFaults}
                    onFaultClick={(faultId) => setSelectedFault(faultId)}
                  />
                ) : (
                  <VehicleFaultsTable
                    faults={filteredFaults}
                    onFaultClick={(faultId) => setSelectedFault(faultId)}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <VehicleFaultAuditTrail />
        )}
      </div>

      <VehicleFaultAddDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleCreateFault}
      />

      {/* Fault Detail Modal */}
      {selectedFault && (
        <VehicleFaultDetail
          faultId={selectedFault}
          onClose={() => setSelectedFault(null)}
          onUpdate={() => {
            // Trigger a refetch of the faults data
            setSelectedFault(null);
          }}
        />
      )}
    </div>
  );
}
