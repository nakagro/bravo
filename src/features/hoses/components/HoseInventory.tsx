import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { HoseComments } from "./HoseComments";

type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";
type Size = "25" | "38" | "65";
type Type = "Canvas" | "Duraline";

const statusColors = {
  "Condemned": "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  "Due for testing": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  "With district for repair": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  "In date": "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
} as const;

type ViewMode = 'cards' | 'table';

type SortField = 'hoseId' | 'status' | 'size' | 'length' | 'type' | 'testDate';
type SortDirection = 'asc' | 'desc';

export function HoseInventory() {
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
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHose, setEditingHose] = useState<Id<"hoses"> | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Id<"hoses"> | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Initialize viewMode from localStorage or default to 'cards'
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Only access localStorage in browser environment
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('hoseInventoryViewMode');
      return (savedViewMode === 'table' ? 'table' : 'cards') as ViewMode;
    }
    return 'cards';
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

  // Function to sort the hoses array
  const sortedHoses = useMemo(() => {
    if (!hoses) return [];
    
    return [...hoses].sort((a, b) => {
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
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hose Inventory</h1>
        <div className="flex flex-wrap gap-2 ml-auto">
          {/* View mode selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-sm flex items-center ${viewMode === 'cards' 
                ? 'bg-red-700 dark:bg-red-600 text-white' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Card View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm flex items-center ${viewMode === 'table' 
                ? 'bg-red-700 dark:bg-red-600 text-white' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Table View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-red-700 dark:bg-red-600 text-white px-3 py-2 text-sm sm:text-base sm:px-4 rounded-lg hover:bg-red-800 dark:hover:bg-red-700 transition-colors flex items-center whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Hose
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
          {/* Search input - takes full width on mobile, 3 cols on desktop */}
          <div className="flex space-x-2 sm:col-span-3">
            <input
              type="text"
              placeholder="Search hose ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border dark:border-gray-700 rounded-lg px-3 py-2 flex-grow bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={handleSearch}
              className="bg-red-700 dark:bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-800 dark:hover:bg-red-700 transition-colors flex items-center"
              aria-label="Search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
          {/* Filter controls - grouped together */}
          <div className="flex w-full sm:w-auto">
            {/* Filter toggle button - takes 3/4 of the space */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-l-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center flex-grow"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-1" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="inline">{showFilters ? 'Hide Filters' : 'Filters'}</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Clear button - takes 1/4 of the space */}
            <button
              onClick={clearFilters}
              className="border border-l-0 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-2 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center w-1/4"
              title="Clear Filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-fadeIn">
            <select
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as Status | "" }))}
              className="border dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Statuses</option>
              <option value="Condemned">Condemned</option>
              <option value="Due for testing">Due for testing</option>
              <option value="With district for repair">With district for repair</option>
              <option value="In date">In date</option>
            </select>
            <select
              value={filters.size}
              onChange={(e) => setFilters(f => ({ ...f, size: e.target.value as Size | "" }))}
              className="border dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Sizes</option>
              <option value="25">25mm</option>
              <option value="38">38mm</option>
              <option value="65">65mm</option>
            </select>
            <select
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as Type | "" }))}
              className="border dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Types</option>
              <option value="Canvas">Canvas</option>
              <option value="Duraline">Duraline</option>
            </select>
          </div>
        )}
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedHoses.map((hose) => (
            <div
              key={hose._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border dark:border-gray-700 cursor-pointer hover:border-red-500 dark:hover:border-red-400 transition-colors"
              onClick={() => setEditingHose(hose._id)}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{hose.hoseId}</h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click from triggering
                      setViewingHistory(hose._id);
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1"
                    title="View History"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[hose.status]}`}>
                    {hose.status}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-x-2 gap-y-1">
                <p>Size: {hose.size}mm</p>
                <p>Length: {hose.length}m</p>
                <p>Type: {hose.type}</p>
                <p>Tested: {new Date(hose.testDate).toLocaleDateString()}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click from triggering
                  setEditingHose(hose._id);
                }}
                className="mt-4 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('hoseId')}
                >
                  Hose ID
                  {sortConfig.field === 'hoseId' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('status')}
                >
                  Status
                  {sortConfig.field === 'status' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('size')}
                >
                  Size
                  {sortConfig.field === 'size' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('length')}
                >
                  Length
                  {sortConfig.field === 'length' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('type')}
                >
                  Type
                  {sortConfig.field === 'type' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('testDate')}
                >
                  Test Date
                  {sortConfig.field === 'testDate' && (
                    <span className="ml-1">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedHoses.map((hose) => (
                <tr 
                  key={hose._id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => setEditingHose(hose._id)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{hose.hoseId}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[hose.status]}`}>
                      {hose.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{hose.size}mm</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{hose.length}m</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{hose.type}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{new Date(hose.testDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          setViewingHistory(hose._id);
                        }}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1"
                        title="View History"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          setEditingHose(hose._id);
                        }}
                        className="text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1"
                        title="Edit Hose"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function HoseHistory({ hoseId }: { hoseId: Id<"hoses"> }) {
  const history = useQuery(api.hoses.getHistory, { hoseId });
  const hoses = useQuery(api.hoses.list, {});
  const hose = hoses?.find(h => h._id === hoseId);
  
  // Check if the hose has been replaced
  const hasBeenReplaced = hose?.replacedAt !== undefined;
  
  // Format the history entries for display
  const formatHistoryEntry = (entry: any) => {
    const date = new Date(entry.timestamp).toLocaleString();
    
    // Special handling for hose replacement
    if (entry.changeType === 'hose_replacement') {
      return (
        <div key={entry._id} className="border-b dark:border-gray-700 pb-3 mb-3 last:border-0 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
          <p className="text-sm text-gray-500 dark:text-gray-400">{date} by {entry.user.name}</p>
          <p className="font-medium text-blue-800 dark:text-blue-300">
            Hose was replaced with a new hose
          </p>
          {entry.notes && entry.notes !== "Hose was replaced" && (
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
              Note: {entry.notes}
            </p>
          )}
        </div>
      );
    }
    
    // Regular field changes
    let fieldDisplay = entry.field.charAt(0).toUpperCase() + entry.field.slice(1);
    
    // Format values based on field type
    let oldValueDisplay = entry.oldValue;
    let newValueDisplay = entry.newValue;
    
    if (entry.field === 'testDate') {
      oldValueDisplay = new Date(entry.oldValue).toLocaleDateString();
      newValueDisplay = new Date(entry.newValue).toLocaleDateString();
    }
    
    return (
      <div key={entry._id} className="border-b dark:border-gray-700 pb-3 mb-3 last:border-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{date} by {entry.user.name}</p>
        <p className="dark:text-gray-200">
          Changed <span className="font-medium">{fieldDisplay}</span> from{' '}
          <span className="font-medium">{oldValueDisplay}</span> to{' '}
          <span className="font-medium">{newValueDisplay}</span>
        </p>
      </div>
    );
  };
  
  return (
    <div>
      {hasBeenReplaced && (
        <div className="text-red-500 dark:text-red-400 text-sm mb-4 p-2 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-900/20">
          This hose has been replaced on {new Date(hose.replacedAt!).toLocaleDateString()}
        </div>
      )}
      
      <div className="mt-2">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-2">
              {history.map(formatHistoryEntry)}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No history available for this hose</p>
          )
        ) : (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-red-700 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
}

function HoseHistoryModal({ hoseId, onClose }: { hoseId: Id<"hoses">, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg relative p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">History</h2>
          </div>
        </div>
        
        <HoseHistory hoseId={hoseId} />
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function HoseForm({ hoseId, onClose }: { hoseId: Id<"hoses"> | null, onClose: () => void }) {
  const hoses = useQuery(api.hoses.list, {});
  const hose = hoses?.find(h => h._id === hoseId);
  const add = useMutation(api.hoses.add);
  const update = useMutation(api.hoses.update);
  const markAsReplaced = useMutation(api.hoses.markAsReplaced);
  const deleteHose = useMutation(api.hoses.deleteHose);
  
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [replacementNotes, setReplacementNotes] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

  const initialLength = hose?.length || 15;
  const [lengthOption, setLengthOption] = useState<'15' | '30' | 'other'>(
    initialLength === 15 ? '15' : initialLength === 30 ? '30' : 'other'
  );
  const [customLength, setCustomLength] = useState(
    initialLength !== 15 && initialLength !== 30 ? initialLength : 0
  );

  const [formData, setFormData] = useState({
    hoseId: hose?.hoseId || "",
    length: hose?.length || 15,
    size: hose?.size || "25" as Size,
    type: hose?.type || "Canvas" as Type,
    testDate: hose?.testDate ? new Date(hose.testDate).toISOString().split('T')[0] : "",
    status: hose?.status || "In date" as Status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (hoseId) {
        await update({
          id: hoseId,
          length: formData.length,
          size: formData.size,
          type: formData.type,
          testDate: new Date(formData.testDate).getTime(),
          status: formData.status,
        });
        toast.success("Hose updated successfully");
      } else {
        await add({
          hoseId: formData.hoseId,
          length: formData.length,
          size: formData.size,
          type: formData.type,
          testDate: new Date(formData.testDate).getTime(),
          status: formData.status,
        });
        toast.success("Hose added successfully");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };



  const handleMarkAsReplaced = async () => {
    if (!hoseId) return;
    
    try {
      await markAsReplaced({
        id: hoseId,
        notes: replacementNotes.trim() || undefined
      });
      toast.success("Hose marked as replaced");
      setShowReplaceDialog(false);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };
  
  const handleDeleteHose = async () => {
    if (!hoseId) return;
    
    try {
      await deleteHose({
        id: hoseId,
        reason: deletionReason.trim() || undefined
      });
      toast.success("Hose deleted successfully");
      setShowDeleteDialog(false);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg relative p-6 w-full max-w-md h-[80vh] overflow-y-auto shadow-xl" style={{ minHeight: '600px' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Header with title and actions */}
        <div className="flex justify-between items-center mb-6 pr-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{hoseId ? `Edit Hose - ${hose?.hoseId}` : 'Add New Hose'}</h2>
        </div>
        {/* Tabs navigation */}
        <div className="flex border-b mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'details' 
              ? 'text-red-700 border-b-2 border-red-700' 
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            Hose Details
          </button>
          {hoseId && (
            <>
              
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 font-medium text-sm ${activeTab === 'history' 
                  ? 'text-red-700 border-b-2 border-red-700' 
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                History
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 font-medium text-sm ${activeTab === 'comments' 
                  ? 'text-red-700 border-b-2 border-red-700' 
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                Comments
              </button>

            </>
          )}
        </div>

        <div className="tab-content" style={{ minHeight: '450px' }}>
          {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic identification section */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Hose Identification</h3>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hose ID</label>
                <input
                  type="text"
                  value={formData.hoseId}
                  onChange={(e) => setFormData(f => ({ ...f, hoseId: e.target.value }))}
                  className="mt-1 block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="WV0001"
                  required
                  disabled={!!hoseId}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(f => ({ ...f, type: e.target.value as Type }))}
                    className="mt-1 block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="Canvas">Canvas</option>
                    <option value="Duraline">Duraline</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Size</label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData(f => ({ ...f, size: e.target.value as Size }))}
                    className="mt-1 block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="25">25mm</option>
                    <option value="38">38mm</option>
                    <option value="65">65mm</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Length (m)</label>
                <select
                  value={lengthOption}
                  onChange={(e) => {
                    const value = e.target.value as '15' | '30' | 'other';
                    setLengthOption(value);
                    if (value === '15') {
                      setFormData(f => ({ ...f, length: 15 }));
                    } else if (value === '30') {
                      setFormData(f => ({ ...f, length: 30 }));
                    } else if (value === 'other') {
                      setFormData(f => ({ ...f, length: customLength }));
                    }
                  }}
                  className="mt-1 block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="15">15m</option>
                  <option value="30">30m</option>
                  <option value="other">Other</option>
                </select>
                
                {lengthOption === 'other' && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={customLength}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setCustomLength(value);
                        setFormData(f => ({ ...f, length: value }));
                      }}
                      className="block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Custom length"
                      required={lengthOption === 'other'}
                      min="1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Status and testing section */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Status & Testing</h3>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(f => ({ ...f, status: e.target.value as Status }))}
                  className="mt-1 block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="In date">In date</option>
                  <option value="Due for testing">Due for testing</option>
                  <option value="With district for repair">With district for repair</option>
                  <option value="Condemned">Condemned</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Date</label>
                <input
                  type="date"
                  value={formData.testDate}
                  onChange={(e) => setFormData(f => ({ ...f, testDate: e.target.value }))}
                  className="mt-1 block w-full border dark:border-gray-700 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
            </div>
          </div>
          {/* Actions section */}
          {hoseId && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Hose Actions</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowReplaceDialog(true)}
                  className="text-blue-600 hover:text-blue-800 font-medium flex items-center p-2 hover:bg-blue-50 rounded-md transition-colors w-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Mark as Replaced
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-800 font-medium flex items-center p-2 hover:bg-red-50 rounded-md transition-colors w-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Hose
                </button>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-red-700 dark:bg-red-600 text-white rounded-lg hover:bg-red-800 dark:hover:bg-red-700 transition-colors font-medium"
            >
              {hoseId ? "Update" : "Add"} Hose
            </button>
          </div>
        </form>
        ) : activeTab === 'comments' ? (
          <HoseComments hoseId={hoseId!} />
        ) : (
          <div className="mt-4">
            <HoseHistory hoseId={hoseId!} />
          </div>
        )}
        </div>
      </div>
      
      {/* Replacement confirmation dialog */}
      {showReplaceDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Mark Hose as Replaced</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will record that hose {hose?.hoseId} has been replaced with a new hose. 
              This action is for historical tracking purposes only.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
              <textarea
                value={replacementNotes}
                onChange={(e) => setReplacementNotes(e.target.value)}
                className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Add any notes about the replacement (e.g., reason for replacement)"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReplaceDialog(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsReplaced}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                Confirm Replacement
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-500">Delete Hose</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete hose {hose?.hoseId}? This action cannot be undone.
              All comments and history for this hose will also be deleted.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for deletion (optional)</label>
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                className="w-full border dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Add any notes about why this hose is being deleted"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-gray-900 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHose}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600"
              >
                Delete Hose
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
