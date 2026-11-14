import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { InventorySearch } from "@/components/shared/InventorySearch";
import { ViewModeToggle, getSavedViewMode } from "@/components/shared/ViewModeToggle";
import type { ViewMode } from "@/components/shared/ViewModeToggle";
import { EmptyState } from "@/components/shared/EmptyState";
import { VehicleFaultCards } from "./VehicleFaultCards";
import { VehicleFaultTable } from "./VehicleFaultTable";
import { VehicleFaultDetailPanel } from "./VehicleFaultDetailPanel";
import { VehicleFaultForm } from "./VehicleFaultForm";
import { VehicleFaultAuditTrail } from "./VehicleFaultAuditTrail";
import { VehicleFaultVehicleTypeAdmin } from "./VehicleFaultVehicleTypeAdmin";
import { statusConfig, priorityConfig, tabConfig } from "../types";
import type { StatusType, PriorityType, TabKey } from "../types";
import { Plus, Truck, Settings, Filter as FilterIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VIEW_MODE_KEY = "vehicleFaults-viewMode";

export function VehicleFaultInventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const faults = useQuery(api.vehicleFaults.getVehicleFaults);
  const vehicleTypes = useQuery(api.vehicleFaultVehicleTypes.getVehicleTypes);
  const currentUser = useQuery(api.auth.loggedInUser);

  // Filter state from search params
  const activeTab = (searchParams.get("tab") as TabKey) || "faults";
  const selectedStatus = (searchParams.get("status") as StatusType | "all") || "all";
  const selectedVehicle = searchParams.get("vehicle") || "all";
  const selectedPriority = (searchParams.get("priority") as PriorityType | "all") || "all";
  const searchTerm = searchParams.get("q") || "";

  const [viewMode, setViewMode] = useState<ViewMode>(() => getSavedViewMode(VIEW_MODE_KEY));
  const [selectedFault, setSelectedFault] = useState<Id<"vehicleFaults"> | null>(null);
  const [editingFaultId, setEditingFaultId] = useState<Id<"vehicleFaults"> | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showVehicleTypeAdmin, setShowVehicleTypeAdmin] = useState(false);

  // Tab indicator animation
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab, faults]);

  // Helpers for updating search params
  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === "all" || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("status");
      next.delete("vehicle");
      next.delete("priority");
      next.delete("q");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const filteredFaults = useMemo(() => {
    if (!faults) return [];
    return faults.filter((fault) => {
      const matchesStatus = selectedStatus === "all" || fault.status === selectedStatus;
      const matchesVehicle = selectedVehicle === "all" || fault.vehicle === selectedVehicle;
      const matchesPriority = selectedPriority === "all" || fault.priority === selectedPriority;
      const matchesSearch =
        searchTerm === "" ||
        fault.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fault.longDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fault.vehicle.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesVehicle && matchesPriority && matchesSearch;
    });
  }, [faults, selectedStatus, selectedVehicle, selectedPriority, searchTerm]);

  const stats = useMemo(() => {
    if (!faults) return { byStatus: {} as Record<string, number>, byVehicle: {} as Record<string, number>, byPriority: {} as Record<string, number> };
    return {
      byStatus: faults.reduce((acc, f) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc; }, {} as Record<string, number>),
      byVehicle: faults.reduce((acc, f) => { acc[f.vehicle] = (acc[f.vehicle] || 0) + 1; return acc; }, {} as Record<string, number>),
      byPriority: faults.reduce((acc, f) => { acc[f.priority] = (acc[f.priority] || 0) + 1; return acc; }, {} as Record<string, number>),
    };
  }, [faults]);

  const hasActiveFilters = selectedStatus !== "all" || selectedVehicle !== "all" || selectedPriority !== "all" || searchTerm !== "";
  const isAdmin = currentUser?.isAdmin;

  // Derive vehicle labels from dynamic types or fallback to stats
  const vehicleLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (vehicleTypes) {
      vehicleTypes.forEach((vt) => { labels[vt.name] = vt.name; });
    }
    // Also include any vehicles from existing faults not in the types
    if (faults) {
      faults.forEach((f) => { if (!labels[f.vehicle]) labels[f.vehicle] = f.vehicle; });
    }
    return labels;
  }, [vehicleTypes, faults]);

  if (!faults) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicle Faults</h1>
        <div className={`flex items-center gap-2 flex-shrink-0 ${activeTab === "faults" ? "" : "invisible"}`}>
          <ViewModeToggle storageKey={VIEW_MODE_KEY} value={viewMode} onChange={setViewMode} />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVehicleTypeAdmin(true)}
              className="gap-1"
              title="Manage vehicle types"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <Button onClick={() => { setEditingFaultId(undefined); setIsFormOpen(true); }} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Report</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[tab.key] = el; }}
              onClick={() => setParam("tab", tab.key === "faults" ? "" : tab.key)}
              className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "text-red-600 dark:text-red-400 font-bold"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div
          className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
          style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
        />
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "faults" ? (
          <>
            {/* Filters */}
            <div className="mb-4 space-y-4">
              <div className="flex gap-2">
                <InventorySearch
                  placeholder="Search faults..."
                  value={searchTerm}
                  onChange={(v) => setParam("q", v)}
                />
                <Button onClick={() => setShowFilters(!showFilters)} variant="outline" className="flex items-center gap-2 px-3">
                  <FilterIcon className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                      {[selectedStatus !== "all", selectedVehicle !== "all", selectedPriority !== "all"].filter(Boolean).length}
                    </span>
                  )}
                  {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {hasActiveFilters && (
                  <Button onClick={clearFilters} variant="outline" className="px-3" title="Clear Filters">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={selectedStatus} onValueChange={(v) => setParam("status", v)}>
                      <SelectTrigger className="bg-white dark:bg-gray-700">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses ({faults.length})</SelectItem>
                        {Object.entries(statusConfig).map(([status, config]) => (
                          <SelectItem key={status} value={status}>
                            {config.label} ({stats.byStatus[status] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vehicle</Label>
                    <Select value={selectedVehicle} onValueChange={(v) => setParam("vehicle", v)}>
                      <SelectTrigger className="bg-white dark:bg-gray-700">
                        <SelectValue placeholder="All Vehicles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vehicles ({faults.length})</SelectItem>
                        {Object.entries(vehicleLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label} ({stats.byVehicle[key] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Priority</Label>
                    <Select value={selectedPriority} onValueChange={(v) => setParam("priority", v)}>
                      <SelectTrigger className="bg-white dark:bg-gray-700">
                        <SelectValue placeholder="All Priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities ({faults.length})</SelectItem>
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                              {config.label} ({stats.byPriority[key] || 0})
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            {filteredFaults.length === 0 ? (
              <EmptyState
                icon={<Truck />}
                title={searchTerm ? "No Matches" : !hasActiveFilters ? "No Faults" : "No Results"}
                description={
                  searchTerm
                    ? `No faults match "${searchTerm}"`
                    : !hasActiveFilters
                    ? "No faults reported yet."
                    : "Try different filters."
                }
                actionLabel={hasActiveFilters ? undefined : faults.length === 0 ? "Report First Fault" : "Report Fault"}
                onAction={hasActiveFilters ? undefined : () => { setEditingFaultId(undefined); setIsFormOpen(true); }}
              />
            ) : (
              <div>
                {hasActiveFilters && (
                  <div className="mb-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium">{filteredFaults.length}</span> of{" "}
                        <span className="font-medium">{faults.length}</span> faults
                      </span>
                      <Button variant="ghost" size="sm" className="p-1 h-auto text-xs" onClick={clearFilters}>
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                {viewMode === "cards" ? (
                  <VehicleFaultCards faults={filteredFaults} onFaultClick={setSelectedFault} />
                ) : (
                  <VehicleFaultTable faults={filteredFaults} onFaultClick={setSelectedFault} />
                )}
              </div>
            )}
          </>
        ) : (
          <VehicleFaultAuditTrail />
        )}
      </div>

      {/* Detail Panel */}
      {selectedFault && (
        <VehicleFaultDetailPanel
          faultId={selectedFault}
          onClose={() => setSelectedFault(null)}
          onEdit={() => {
            setEditingFaultId(selectedFault);
            setSelectedFault(null);
            setIsFormOpen(true);
          }}
        />
      )}

      {/* Create/Edit Form */}
      <VehicleFaultForm
        faultId={editingFaultId}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSaved={() => setEditingFaultId(undefined)}
      />

      {/* Vehicle Type Admin */}
      {showVehicleTypeAdmin && (
        <VehicleFaultVehicleTypeAdmin
          open={showVehicleTypeAdmin}
          onOpenChange={setShowVehicleTypeAdmin}
        />
      )}
    </div>
  );
}
