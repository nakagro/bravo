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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldLabel } from "@/components/ui/field";
import { ChevronDown, Clock, Flame, Funnel, MapPin, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    upcomingTest: (searchParams.get('upcoming') || "") as UpcomingTestFilter | "",
    overdueFilter: (searchParams.get('overdue') || "") as OverdueFilter | "",
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
    if (filters.upcomingTest) params.set('upcoming', filters.upcomingTest);
    if (filters.overdueFilter) params.set('overdue', filters.overdueFilter);
    if (sortConfig.field !== 'hoseId') params.set('sort', sortConfig.field);
    if (sortConfig.direction !== 'asc') params.set('dir', sortConfig.direction);
    setSearchParams(params, { replace: true });
  }, [searchTerm, filters.status, filters.size, filters.type, filters.location, filters.upcomingTest, filters.overdueFilter, sortConfig, setSearchParams]);

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

  return (
    <div className="space-y-4" data-component="HoseInventory">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InventorySearch
          placeholder="Search by hose ID…"
          value={searchTerm}
          onChange={setSearchTerm}
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="min-h-11 flex-1 touch-manipulation sm:flex-none"
            aria-expanded={showFilters}
            aria-controls="hose-inventory-filters"
          >
            <Funnel data-icon="inline-start" aria-hidden="true" />
            {showFilters ? 'Hide filters' : 'Filters'}
            <ChevronDown
              data-icon="inline-end"
              aria-hidden="true"
              className={cn("transition-transform motion-reduce:transition-none", showFilters && "rotate-180")}
            />
          </Button>

          {hasActiveFilters && (
            <Button
              type="button"
              onClick={clearFilters}
              variant="ghost"
              className="min-h-11 touch-manipulation text-red-700 dark:text-red-400"
            >
              <X data-icon="inline-start" aria-hidden="true" />
              <span className="hidden sm:inline">Clear</span>
              <span className="sr-only sm:hidden">Clear filters</span>
            </Button>
          )}

          <ViewModeToggle
            storageKey="hoseInventoryViewMode"
            value={viewMode}
            onChange={setViewMode}
          />

          <Button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="min-h-11 touch-manipulation bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">Add hose</span>
            <span className="sr-only sm:hidden">Add hose</span>
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div id="hose-inventory-filters" className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="hose-status-filter">Status</FieldLabel>
          <Select
            value={filters.status === "" ? "all" : filters.status}
            onValueChange={(value) => setFilters(f => ({ ...f, status: value === "all" ? "" : value as Status }))}
          >
            <SelectTrigger id="hose-status-filter" className="min-h-11 bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Condemned">Condemned</SelectItem>
              <SelectItem value="Due for testing">Due for testing</SelectItem>
              <SelectItem value="With district for repair">With district for repair</SelectItem>
              <SelectItem value="In date">In date</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="hose-size-filter">Size</FieldLabel>
          <Select
            value={filters.size === "" ? "all" : filters.size}
            onValueChange={(value) => setFilters(f => ({ ...f, size: value === "all" ? "" : value as Size }))}
          >
            <SelectTrigger id="hose-size-filter" className="min-h-11 bg-background">
              <SelectValue placeholder="All Sizes" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
              <SelectItem value="all">All Sizes</SelectItem>
              <SelectItem value="25">25mm</SelectItem>
              <SelectItem value="38">38mm</SelectItem>
              <SelectItem value="65">65mm</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="hose-type-filter">Type</FieldLabel>
          <Select
            value={filters.type === "" ? "all" : filters.type}
            onValueChange={(value) => setFilters(f => ({ ...f, type: value === "all" ? "" : value as Type }))}
          >
            <SelectTrigger id="hose-type-filter" className="min-h-11 bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Canvas">Canvas</SelectItem>
              <SelectItem value="Duraline">Duraline</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="hose-location-filter">Location</FieldLabel>
          <Select
            value={filters.location === "" ? "all" : filters.location}
            onValueChange={(value) => setFilters(f => ({ ...f, location: value === "all" ? "" : value as Location }))}
          >
            <SelectTrigger id="hose-location-filter" className="min-h-11 bg-background">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="Station">Station</SelectItem>
              <SelectItem value="Pumper">Pumper</SelectItem>
              <SelectItem value="Tanker">Tanker</SelectItem>
              <SelectItem value="FCV">FCV</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          </Field>
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && hoses !== undefined && (
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

      {/* Results stay mounted independently from the search control so typing never loses focus. */}
      {hoses === undefined ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading hose results">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : hoses.length === 0 && !hasActiveFilters ? (
        <EmptyState
          icon={<Flame className="size-12 text-red-400 dark:text-red-500" />}
          title="No hoses registered yet"
          description="Track fire hoses across your brigade. Each record includes the hose ID, size, length, type, location, and testing status."
          secondaryDescription="Monitor testing schedules, manage replacements, and maintain compliance records."
          actionLabel="Add first hose"
          onAction={() => setShowAddForm(true)}
        />
      ) : sortedHoses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Flame aria-hidden="true" className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-gray-500 dark:text-gray-400">
            No hoses match your current filters
          </p>
          <Button type="button" variant="link" onClick={clearFilters} className="mt-2 text-red-700 dark:text-red-400">
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedHoses.map((hose) => {
            const tapeColor = tapeColorForTestDate(hose.testDate);
            return (
            <button
              key={hose._id}
              type="button"
              onClick={() => setViewingHose(hose._id)}
              className="group h-full cursor-pointer touch-manipulation text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              aria-label={`View hose ${hose.hoseId}`}
            >
            <Card
              className={cn(
                "relative h-full overflow-hidden rounded-none border-l-4 transition-[background-color,box-shadow] group-hover:bg-accent/40 group-hover:shadow-lg group-active:bg-accent/60 motion-reduce:transition-none [content-visibility:auto]",
                statusBorderColors[hose.status],
              )}
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
                      <MapPin aria-hidden="true" className="size-3.5" />
                      {hose.location || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock aria-hidden="true" className="size-3.5" />
                    Tested {new Date(hose.testDate).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
            </button>
            );
          })}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted-foreground md:hidden">Swipe sideways to see all columns.</p>
          <div className="overflow-x-auto overscroll-x-contain rounded-lg border">
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
                  role="button"
                  tabIndex={0}
                  aria-label={`View hose ${hose.hoseId}`}
                  onClick={() => setViewingHose(hose._id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setViewingHose(hose._id);
                    }
                  }}
                  className={`cursor-pointer [content-visibility:auto] hover:bg-red-50/70 focus-visible:bg-red-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 dark:hover:bg-red-950/30 dark:focus-visible:bg-red-950/30 ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'
                  }`}
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
                      <MapPin aria-hidden="true" className="size-3.5" />
                      {hose.location || '-'}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(hose.testDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
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
