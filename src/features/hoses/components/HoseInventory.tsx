import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { HoseComments } from "./HoseComments";
import { HoseForm } from "./HoseForm";
import { HoseHistory } from "./HoseHistory";
import { HoseHistoryModal } from "./HoseHistoryModal";
import { Status, Size, Type, statusColors } from "../types";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Squares2X2Icon,
  TableCellsIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  XMarkIcon,
  ClockIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

type ViewMode = 'cards' | 'table';

type SortField = 'hoseId' | 'status' | 'size' | 'length' | 'type' | 'testDate';
type SortDirection = 'asc' | 'desc';
type UpcomingTestFilter = "1month" | "3months" | "6months";
type FilterType = Status | UpcomingTestFilter | null;

interface HoseInventoryProps {
  initialStatusFilter?: FilterType;
  onFilterApplied?: () => void;
}

export function HoseInventory({ initialStatusFilter, onFilterApplied }: HoseInventoryProps = {}) {
  // Make setViewingHistory accessible to other components
  // @ts-ignore - Adding a property to the component for external access
  if (typeof document !== 'undefined') {
    const componentElement = document.querySelector("[data-component='HoseInventory']");
    if (componentElement) {
      // @ts-ignore
      componentElement.setViewingHistory = (hoseId: Id<"hoses">) => {
        setViewingHistory(hoseId);
      };
    }
  }
  const [filters, setFilters] = useState({
    status: "" as Status | "",
    size: "" as Size | "",
    type: "" as Type | "",
    search: "",
    upcomingTest: "" as UpcomingTestFilter | "",
  });

  // Handle initial filter changes (status or upcoming test)
  useEffect(() => {
    if (initialStatusFilter) {
      // Check if it's a status filter or upcoming test filter
      const statusOptions: Status[] = ["In date", "Due for testing", "With district for repair", "Condemned"];
      const upcomingTestOptions: UpcomingTestFilter[] = ["1month", "3months", "6months"];
      
      if (statusOptions.includes(initialStatusFilter as Status)) {
        setFilters(prev => ({ ...prev, status: initialStatusFilter as Status, upcomingTest: "" }));
      } else if (upcomingTestOptions.includes(initialStatusFilter as UpcomingTestFilter)) {
        setFilters(prev => ({ ...prev, upcomingTest: initialStatusFilter as UpcomingTestFilter, status: "" }));
      }
      onFilterApplied?.();
    }
  }, [initialStatusFilter, onFilterApplied]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHose, setEditingHose] = useState<Id<"hoses"> | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Id<"hoses"> | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Function to detect if user is on a mobile device
  const isMobileDevice = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // Common breakpoint for mobile devices
    }
    return false;
  };

  // Initialize viewMode from localStorage or default based on device type
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Only access localStorage in browser environment
    if (typeof window !== 'undefined') {
      // Check if user has a saved preference
      const savedViewMode = localStorage.getItem('hoseInventoryViewMode');
      if (savedViewMode) {
        return (savedViewMode === 'table' ? 'table' : 'cards') as ViewMode;
      }
      
      // If no saved preference, set default based on device type
      return isMobileDevice() ? 'cards' : 'table';
    }
    return 'cards'; // Server-side rendering default
  });
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ 
    field: 'hoseId', 
    direction: 'asc' 
  });
  
  const handleSearch = () => {
    setFilters(f => ({ ...f, search: searchTerm }));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      size: "",
      type: "",
      search: "",
      upcomingTest: "",
    });
    setSearchTerm("");
  };

  const hoses = useQuery(api.hoses.list, {
    status: filters.status || undefined,
    size: filters.size || undefined,
    type: filters.type || undefined,
    search: filters.search || undefined,
  });

  // Function to handle sorting
  // Update localStorage when viewMode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hoseInventoryViewMode', viewMode);
    }
  }, [viewMode]);

  const handleSort = (field: SortField) => {
    setSortConfig(prevConfig => {
      // If clicking the same field, toggle direction
      if (prevConfig.field === field) {
        return { field, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
      }
      // If clicking a new field, set to ascending by default
      return { field, direction: 'asc' };
    });
  };

  // Function to filter hoses by upcoming test dates
  const filterHosesByUpcomingTest = (hoses: any[], timeframe: UpcomingTestFilter) => {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds
    const timeframeMs = {
      "1month": 30 * 24 * 60 * 60 * 1000,
      "3months": 3 * 30 * 24 * 60 * 60 * 1000,
      "6months": 6 * 30 * 24 * 60 * 60 * 1000,
    };
    
    return hoses.filter(hose => {
      // Only consider "In date" hoses for upcoming test filtering
      if (hose.status !== "In date") return false;
      
      const testExpiryDate = hose.testDate + oneYearMs;
      const timeframeFromNow = now + timeframeMs[timeframe];
      
      // Return hoses that will expire within the specified timeframe
      return testExpiryDate <= timeframeFromNow && testExpiryDate > now;
    });
  };

  // Function to sort and filter the hoses array
  const sortedHoses = useMemo(() => {
    if (!hoses) return [];
    
    let filteredHoses = [...hoses];
    
    // Apply upcoming test filter if set
    if (filters.upcomingTest) {
      filteredHoses = filterHosesByUpcomingTest(filteredHoses, filters.upcomingTest);
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
        default:
          break;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [hoses, sortConfig]);

  if (hoses === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-component="HoseInventory">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white w-full sm:w-auto whitespace-nowrap">Hose Inventory</h1> */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:ml-auto">
          {/* View mode selector */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value) setViewMode(value as ViewMode);
            }}
            className="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"
          >
            <ToggleGroupItem 
              value="cards" 
              aria-label="Card View" 
              title="Card View"
              className="px-3 py-2 text-sm data-[state=on]:bg-red-700 data-[state=on]:dark:bg-red-600 data-[state=on]:text-white bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 data-[state=on]:hover:bg-red-800 data-[state=on]:dark:hover:bg-red-700 rounded-none border-r border-gray-300 dark:border-gray-700 last:border-r-0"
            >
              <Squares2X2Icon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Cards</span>
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="table" 
              aria-label="Table View" 
              title="Table View"
              className="px-3 py-2 text-sm data-[state=on]:bg-red-700 data-[state=on]:dark:bg-red-600 data-[state=on]:text-white bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 data-[state=on]:hover:bg-red-800 data-[state=on]:dark:hover:bg-red-700 rounded-none"
            >
              <TableCellsIcon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Table</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            onClick={() => setShowAddForm(true)}
            variant="destructive"
            className="bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-700"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Hose
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
          {/* Search input - takes full width on mobile, 3 cols on desktop */}
          <div className="flex space-x-2 sm:col-span-3">
            <Input
              type="text"
              placeholder="Search hose ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-grow"
            />
            <Button
              onClick={handleSearch}
              variant="destructive"
              className="bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-700"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-1 sm:mr-0" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>
          {/* Filter controls - grouped together */}
          <div className="flex w-full sm:w-auto">
            {/* Filter toggle button - takes 3/4 of the space */}
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="flex-grow justify-center rounded-l-lg"
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              <span className="inline">{showFilters ? 'Hide Filters' : 'Filters'}</span>
              <ChevronDownIcon className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            {/* Clear button - takes 1/4 of the space */}
            <Button
              onClick={clearFilters}
              variant="outline"
              className="w-1/4 rounded-r-lg rounded-l-none border-l-0 flex items-center justify-center px-2 py-2"
              title="Clear Filters"
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-fadeIn">
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
          </div>
        )}
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedHoses.map((hose) => (
            <Card
              key={hose._id}
              className="cursor-pointer hover:border-red-500 dark:hover:border-red-400 transition-colors"
              onClick={() => setEditingHose(hose._id)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-base font-semibold">{hose.hoseId}</CardTitle>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click from triggering
                      setViewingHistory(hose._id);
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-7 w-7"
                    title="View History"
                  >
                    <ClockIcon className="h-4 w-4" />
                  </Button>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[hose.status]}`}>
                    {hose.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 dark:text-gray-400 px-4 pb-2">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <p>Size: {hose.size}mm</p>
                  <p>Length: {hose.length}m</p>
                  <p>Type: {hose.type}</p>
                  <p>Tested: {new Date(hose.testDate).toLocaleDateString()}</p>
                </div>
              </CardContent>
              <CardFooter className="px-4 pb-3 pt-1">
                <Button
                  variant="link"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click from triggering
                    setEditingHose(hose._id);
                  }}
                  className="text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-0 h-auto font-medium"
                >
                  Edit
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('hoseId')}
                >
                  Hose ID
                  {sortConfig.field === 'hoseId' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('status')}
                >
                  Status
                  {sortConfig.field === 'status' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('size')}
                >
                  Size
                  {sortConfig.field === 'size' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('length')}
                >
                  Length
                  {sortConfig.field === 'length' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('type')}
                >
                  Type
                  {sortConfig.field === 'type' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('testDate')}
                >
                  Test Date
                  {sortConfig.field === 'testDate' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoses.map((hose) => (
                <TableRow 
                  key={hose._id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => setEditingHose(hose._id)}
                >
                  <TableCell className="font-medium">{hose.hoseId}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[hose.status]}`}>
                      {hose.status}
                    </span>
                  </TableCell>
                  <TableCell>{hose.size}mm</TableCell>
                  <TableCell>{hose.length}m</TableCell>
                  <TableCell>{hose.type}</TableCell>
                  <TableCell>{new Date(hose.testDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          setViewingHistory(hose._id);
                        }}
                        className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        title="View History"
                      >
                        <ClockIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          setEditingHose(hose._id);
                        }}
                        className="h-8 w-8 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        title="Edit Hose"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(showAddForm || editingHose) && (
        <HoseForm
          hoseId={editingHose}
          onClose={() => {
            setShowAddForm(false);
            setEditingHose(null);
          }}
        />
      )}
      
      {viewingHistory && (
        <HoseHistoryModal
          hoseId={viewingHistory}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </div>
  );
}


