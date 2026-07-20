import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { HoseForm } from "./HoseForm";
import { HoseDetailPanel } from "./HoseDetailPanel";
import {
  Status,
  Size,
  Type,
  statusColors,
  statusBorderColors,
  Location,
  UpcomingTestFilter,
  OverdueFilter,
  HoseFilterType,
  TapeColor,
  getTapeColorStyle,
} from "../types";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import {
  PlusIcon,
  FunnelIcon,
  ChevronDownIcon,
  XMarkIcon,
  ClockIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { Flame } from "lucide-react";

// Shared components
import { InventorySearch } from "@/components/shared/InventorySearch";
import { SortableTableHeader } from "@/components/shared/SortableTableHeader";
import { ViewModeToggle, getSavedViewMode, type ViewMode } from "@/components/shared/ViewModeToggle";
import { EmptyState } from "@/components/shared/EmptyState";

type SortField = 'hoseId' | 'status' | 'size' | 'length' | 'type' | 'testDate' | 'location';
type SortDirection = 'asc' | 'desc';

interface HoseInventoryProps {
  initialStatusFilter?: HoseFilterType;
  onFilterApplied?: () => void;
}

export function HoseInventory({ initialStatusFilter, onFilterApplied }: HoseInventoryProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [filters, setFilters] = useState({
    status: (searchParams.get('status') || "") as Status | "",
    size: (searchParams.get('size') || "") as Size | "",
    type: (searchParams.get('type') || "") as Type | "",
    location: (searchParams.get('location') || "") as Location | "",
    upcomingTest: "" as UpcomingTestFilter | "",
    overdueFilter: "" as OverdueFilter | "",
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHose, setEditingHose] = useState<Id<"hoses"> | null>(null);
  const [viewingHose, setViewingHose] = useState<Id<"hoses"> | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(() => getSavedViewMode('hoseInventoryViewMode'));
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>(() => ({
    field: (searchParams.get('sort') as SortField) || 'hoseId',
    direction: (searchParams.get('dir') as SortDirection) || 'asc',
  }));

  // Handle initial filter changes (from dashboard clicks)
  useEffect(() => {
    if (initialStatusFilter) {
      const statusOptions: Status[] = ["In date", "Due for testing", "With district for repair", "Condemned"];
      const upcomingTestOptions: UpcomingTestFilter[] = ["1month", "3months", "6months"];
      const overdueOptions: OverdueFilter[] = ["overdue3months", "overdue6months", "overdue12months", "overdue12plus"];

      if (statusOptions.includes(initialStatusFilter as Status)) {
        setFilters(prev => ({ ...prev, status: initialStatusFilter as Status, upcomingTest: "", overdueFilter: "" }));
      } else if (upcomingTestOptions.includes(initialStatusFilter as UpcomingTestFilter)) {
        setFilters(prev => ({ ...prev, upcomingTest: initialStatusFilter as UpcomingTestFilter, status: "", overdueFilter: "" }));
      } else if (overdueOptions.includes(initialStatusFilter as OverdueFilter)) {
        setFilters(prev => ({ ...prev, overdueFilter: initialStatusFilter as OverdueFilter, status: "", upcomingTest: "" }));
      }
      onFilterApplied?.();
    }
  }, [initialStatusFilter, onFilterApplied]);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    // This component only renders for the Inventory tab, so enforce it.
    // Avoids a first-mount race where the URL briefly drops `tab=inventory`.
    params.set('tab', 'inventory');

    if (searchTerm) params.set('q', searchTerm);
    if (filters.status) params.set('status', filters.status);
    if (filters.size) params.set('size', filters.size);
    if (filters.type) params.set('type', filters.type);
    if (filters.location) params.set('location', filters.location);
    if (sortConfig.field !== 'hoseId') params.set('sort', sortConfig.field);
    if (sortConfig.direction !== 'asc') params.set('dir', sortConfig.direction);
    setSearchParams(params, { replace: true });
  }, [searchTerm, filters.status, filters.size, filters.type, filters.location, sortConfig, setSearchParams]);

  const clearFilters = useCallback(() => {
    setFilters({
      status: "",
      size: "",
      type: "",
      location: "",
      upcomingTest: "",
      overdueFilter: "",
    });
    setSearchTerm("");
  }, []);

  const hasActiveFilters = filters.status || filters.size || filters.type || filters.location || searchTerm || filters.upcomingTest || filters.overdueFilter;

  const hoses = useQuery(api.hoses.list, {
    status: filters.status || undefined,
    size: filters.size || undefined,
    type: filters.type || undefined,
    location: filters.location || undefined,
    search: searchTerm || undefined,
  });

  const tapeColors = useQuery(api.hoseTapeColors.list);
  const tapeColorForTestDate = useCallback(
    (testDate: number): TapeColor | null => {
      const year = new Date(testDate).getFullYear();
      return tapeColors?.find((m) => m.year === year)?.color ?? null;
    },
    [tapeColors]
  );

  const handleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  // Filter by upcoming test / overdue (client-side on top of server filters)
  const filterHosesByUpcomingTest = (hoses: any[], timeframe: UpcomingTestFilter) => {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
    const fourMonthsMs = 4 * 30 * 24 * 60 * 60 * 1000;
    const threeMonthsMs = 3 * 30 * 24 * 60 * 60 * 1000;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    return hoses.filter(hose => {
      if (hose.status !== "In date") return false;
      const testExpiryDate = hose.testDate + oneYearMs;
      if (timeframe === "6months") {
        return testExpiryDate <= now + sixMonthsMs && testExpiryDate > now + fourMonthsMs;
      } else if (timeframe === "3months") {
        return testExpiryDate <= now + threeMonthsMs && testExpiryDate > now + oneMonthMs;
      } else if (timeframe === "1month") {
        return testExpiryDate <= now + oneMonthMs && testExpiryDate > now;
      }
      return false;
    });
  };

  const filterHosesByOverdue = (hoses: any[], timeframe: OverdueFilter) => {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const twelveMonthsMs = 12 * 30 * 24 * 60 * 60 * 1000;
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
    const threeMonthsMs = 3 * 30 * 24 * 60 * 60 * 1000;

    return hoses.filter(hose => {
      if (hose.status !== "Due for testing") return false;
      const testExpiryDate = hose.testDate + oneYearMs;
      if (timeframe === "overdue3months") {
        return testExpiryDate >= now - threeMonthsMs && testExpiryDate < now;
      } else if (timeframe === "overdue6months") {
        return testExpiryDate >= now - sixMonthsMs && testExpiryDate < now - threeMonthsMs;
      } else if (timeframe === "overdue12months") {
        return testExpiryDate >= now - twelveMonthsMs && testExpiryDate < now - sixMonthsMs;
      } else if (timeframe === "overdue12plus") {
        return testExpiryDate < now - twelveMonthsMs;
      }
      return false;
    });
  };

  const sortedHoses = useMemo(() => {
    if (!hoses) return [];

    let filteredHoses = [...hoses];

    if (filters.upcomingTest) {
      filteredHoses = filterHosesByUpcomingTest(filteredHoses, filters.upcomingTest);
    }
    if (filters.overdueFilter) {
      filteredHoses = filterHosesByOverdue(filteredHoses, filters.overdueFilter);
    }

    return filteredHoses.sort((a, b) => {
      const { field, direction } = sortConfig;
      let comparison = 0;

      switch (field) {
        case 'hoseId':
          comparison = a.hoseId.localeCompare(b.hoseId);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'size':
          comparison = parseInt(a.size) - parseInt(b.size);
          break;
        case 'length':
          comparison = a.length - b.length;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'testDate':
          comparison = new Date(a.testDate).getTime() - new Date(b.testDate).getTime();
          break;
        case 'location':
          comparison = (a.location || '').localeCompare(b.location || '');
          break;
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }, [hoses, sortConfig, filters]);

  if (hoses === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 dark:border-red-500"></div>
      </div>
    );
  }

  // Empty state when no hoses exist at all
  if (hoses.length === 0 && !hasActiveFilters) {
    return (
      <>
        <EmptyState
          icon={<Flame className="h-12 w-12 text-red-400 dark:text-red-500" />}
          title="No hoses registered yet"
          description="Track fire hoses across your brigade. Each record includes the hose ID, size, length, type, location, and testing status."
          secondaryDescription="Monitor testing schedules, manage replacements, and maintain compliance records."
          actionLabel="Add First Hose"
          onAction={() => setShowAddForm(true)}
        />
        {showAddForm && (
          <HoseForm hoseId={null} onClose={() => setShowAddForm(false)} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4" data-component="HoseInventory">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <InventorySearch
          placeholder="Search hose ID..."
          value={searchTerm}
          onChange={setSearchTerm}
        />

        {/* Filter toggle */}
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <FunnelIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{showFilters ? 'Hide' : 'Filters'}</span>
          <ChevronDownIcon className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>

        {hasActiveFilters && (
          <Button
            onClick={clearFilters}
            variant="ghost"
            size="sm"
            className="text-red-600 dark:text-red-400"
            title="Clear all filters"
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}

        <ViewModeToggle
          storageKey="hoseInventoryViewMode"
          value={viewMode}
          onChange={setViewMode}
        />

        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Add Hose</span>
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-fadeIn">
          <Select
            value={filters.status === "" ? "all" : filters.status}
            onValueChange={(value) => setFilters(f => ({ ...f, status: value === "all" ? "" : value as Status }))}
          >
            <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Condemned">Condemned</SelectItem>
              <SelectItem value="Due for testing">Due for testing</SelectItem>
              <SelectItem value="With district for repair">With district for repair</SelectItem>
              <SelectItem value="In date">In date</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.size === "" ? "all" : filters.size}
            onValueChange={(value) => setFilters(f => ({ ...f, size: value === "all" ? "" : value as Size }))}
          >
            <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <SelectValue placeholder="All Sizes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sizes</SelectItem>
              <SelectItem value="25">25mm</SelectItem>
              <SelectItem value="38">38mm</SelectItem>
              <SelectItem value="65">65mm</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.type === "" ? "all" : filters.type}
            onValueChange={(value) => setFilters(f => ({ ...f, type: value === "all" ? "" : value as Type }))}
          >
            <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Canvas">Canvas</SelectItem>
              <SelectItem value="Duraline">Duraline</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.location === "" ? "all" : filters.location}
            onValueChange={(value) => setFilters(f => ({ ...f, location: value === "all" ? "" : value as Location }))}
          >
            <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="Station">Station</SelectItem>
              <SelectItem value="Pumper">Pumper</SelectItem>
              <SelectItem value="Tanker">Tanker</SelectItem>
              <SelectItem value="FCV">FCV</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>
            {sortedHoses.length} {sortedHoses.length === 1 ? 'hose' : 'hoses'}
            <span className="ml-1 text-red-600 dark:text-red-400">(filtered)</span>
          </span>
          <button onClick={clearFilters} className="text-red-600 dark:text-red-400 hover:underline text-sm">
            Clear
          </button>
        </div>
      )}

      {/* Empty state for filtered results */}
      {sortedHoses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Flame className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No hoses match your current filters
          </p>
          <button onClick={clearFilters} className="mt-2 text-red-600 dark:text-red-400 hover:underline text-sm">
            Clear filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedHoses.map((hose) => {
            const tapeColor = tapeColorForTestDate(hose.testDate);
            return (
            <Card
              key={hose._id}
              className={`relative overflow-hidden cursor-pointer hover:shadow-md transition-all rounded-none border-l-4 ${statusBorderColors[hose.status]}`}
              onClick={() => setViewingHose(hose._id)}
            >
              {tapeColor && (
                <div
                  className="absolute -right-9 top-3 h-3.5 w-32 rotate-45"
                  style={getTapeColorStyle(tapeColor)}
                  title="Test tape"
                />
              )}
              <CardContent className="p-4">
                {/* Header: ID and status */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{hose.hoseId}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs mt-1 ${statusColors[hose.status]}`}>
                      {hose.status}
                    </span>
                  </div>
                </div>

                {/* Key specs */}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{hose.size}<span className="text-sm font-normal text-muted-foreground">mm</span></span>
                  <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">{hose.length}<span className="text-sm font-normal text-muted-foreground">m</span></span>
                </div>

                {/* Secondary info */}
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>{hose.type}</span>
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="h-3.5 w-3.5" />
                      {hose.location || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Tested {new Date(hose.testDate).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
              <TableRow>
                <SortableTableHeader field="hoseId" label="Hose ID" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
                <SortableTableHeader field="status" label="Status" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
                <SortableTableHeader field="size" label="Size" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
                <SortableTableHeader field="length" label="Length" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
                <SortableTableHeader field="type" label="Type" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
                <SortableTableHeader field="location" label="Location" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
                <SortableTableHeader field="testDate" label="Test Date" currentField={sortConfig.field} direction={sortConfig.direction} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoses.map((hose, index) => (
                <TableRow
                  key={hose._id}
                  className={`cursor-pointer transition-colors hover:bg-red-50/50 dark:hover:bg-red-950/20 ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'
                  }`}
                  onClick={() => setViewingHose(hose._id)}
                >
                  <TableCell className="font-semibold">{hose.hoseId}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[hose.status]}`}>
                      {hose.status}
                    </span>
                  </TableCell>
                  <TableCell>{hose.size}mm</TableCell>
                  <TableCell>{hose.length}m</TableCell>
                  <TableCell>{hose.type}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPinIcon className="h-3.5 w-3.5" />
                      {hose.location || '—'}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(hose.testDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Panel - read-only quick view */}
      {viewingHose && (
        <HoseDetailPanel
          hoseId={viewingHose}
          onClose={() => setViewingHose(null)}
          onEdit={() => {
            setEditingHose(viewingHose);
            setViewingHose(null);
          }}
        />
      )}

      {/* Add/Edit Form */}
      {(showAddForm || editingHose) && (
        <HoseForm
          hoseId={editingHose}
          onClose={() => {
            setShowAddForm(false);
            setEditingHose(null);
          }}
        />
      )}
    </div>
  );
}
