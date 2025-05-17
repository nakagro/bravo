import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { KeyComments } from "./KeyComments";
import { KeyForm } from "./KeyForm";

type ViewMode = 'cards' | 'table';
type SortField = 'pegNumber' | 'siteName' | 'address';
type SortDirection = 'asc' | 'desc';

export function KeyInventory() {
  const [filters, setFilters] = useState({
    search: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<Id<"keys"> | null>(null);
  const [viewingComments, setViewingComments] = useState<Id<"keys"> | null>(null);
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
      const savedViewMode = localStorage.getItem('keyInventoryViewMode');
      if (savedViewMode) {
        return (savedViewMode === 'table' ? 'table' : 'cards') as ViewMode;
      }
      
      // If no saved preference, set default based on device type
      return isMobileDevice() ? 'cards' : 'table';
    }
    return 'cards'; // Server-side rendering default
  });
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({ 
    field: 'pegNumber', 
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
      search: "",
    });
    setSearchTerm("");
  };

  const keys = useQuery(api.keys.list, {
    search: filters.search || undefined,
  });

  // Update localStorage when viewMode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('keyInventoryViewMode', viewMode);
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

  // Function to sort the keys array
  const sortedKeys = useMemo(() => {
    if (!keys) return [];
    
    return [...keys].sort((a, b) => {
      const { field, direction } = sortConfig;
      let comparison = 0;
      
      switch (field) {
        case 'pegNumber':
          comparison = a.pegNumber.localeCompare(b.pegNumber);
          break;
        case 'siteName':
          comparison = a.siteName.localeCompare(b.siteName);
          break;
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        default:
          break;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [keys, sortConfig]);

  if (keys === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-component="KeyInventory">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Key Management</h1>
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
            Add Key
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:gap-4">
          {/* Search input */}
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Search keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-red-700 dark:bg-red-600 text-white rounded-lg hover:bg-red-800 dark:hover:bg-red-700 transition-colors"
            >
              Search
            </button>
            {filters.search && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Display keys based on view mode */}
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedKeys.map(key => (
              <KeyCard
                key={key._id}
                keyData={key}
                onEdit={() => setEditingKey(key._id)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('pegNumber')}
                  >
                    <div className="flex items-center">
                      Peg Number
                      {sortConfig.field === 'pegNumber' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('siteName')}
                  >
                    <div className="flex items-center">
                      Site Name
                      {sortConfig.field === 'siteName' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('address')}
                  >
                    <div className="flex items-center">
                      Address
                      {sortConfig.field === 'address' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Contact
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Notes
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedKeys.map(key => (
                  <tr key={key._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {key.pegNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {key.siteName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {key.address}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {key.contactName && (
                        <div className="flex items-center mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {key.contactName}
                        </div>
                      )}
                      {key.contactEmail && (
                        <div className="flex items-center mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {key.contactEmail}
                        </div>
                      )}
                      {key.contactPhone && (
                        <div className="flex items-center mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {key.contactPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {key.notes && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                          {key.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingKey(key._id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Key Form Modal */}
      {(showAddForm || editingKey) && (
        <KeyForm
          keyId={editingKey}
          onClose={() => {
            setShowAddForm(false);
            setEditingKey(null);
          }}
        />
      )}

      {/* Comments Modal */}
      {viewingComments && (
        <KeyCommentsModal
          keyId={viewingComments}
          onClose={() => setViewingComments(null)}
        />
      )}
    </div>
  );
}

// KeyCard component for card view
function KeyCard({ 
  keyData, 
  onEdit 
}: { 
  keyData: { 
    _id: Id<"keys">, 
    _creationTime: number,
    pegNumber: string, 
    siteName: string, 
    address: string, 
    contactName?: string,
    contactEmail?: string,
    contactPhone?: string,
    notes?: string,
    createdBy: Id<"users">,
    updatedAt: number
  }, 
  onEdit: () => void
}) {
  const remove = useMutation(api.keys.remove);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this key?")) {
      try {
        await remove({ id: keyData._id });
        toast.success("Key deleted successfully");
      } catch (error) {
        console.error("Error deleting key:", error);
        toast.error("Failed to delete key");
      }
    }
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border dark:border-gray-700 cursor-pointer hover:border-red-500 dark:hover:border-red-400 transition-colors"
      onClick={onEdit}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{keyData.pegNumber}</h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click from triggering
              handleDelete();
            }}
            className="text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-300 p-1"
            title="Delete Key"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 grid grid-cols-1 gap-y-1">
        <p className="font-medium text-gray-700 dark:text-gray-300">{keyData.siteName}</p>
        <p>{keyData.address}</p>
        
        {/* Contact Information - Condensed */}
        {keyData.contactName && <p>Contact: {keyData.contactName}</p>}
        {keyData.contactPhone && <p>Phone: {keyData.contactPhone}</p>}
        {keyData.contactEmail && <p>Email: {keyData.contactEmail}</p>}
        
        {/* Notes - Condensed */}
        {keyData.notes && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={keyData.notes}>
            Notes: {keyData.notes}
          </p>
        )}
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent card click from triggering
          onEdit();
        }}
        className="mt-3 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
      >
        Edit
      </button>
    </div>
  );
}

// KeyCommentsModal component for viewing comments
function KeyCommentsModal({ 
  keyId, 
  onClose 
}: { 
  keyId: Id<"keys">, 
  onClose: () => void 
}) {
  const key = useQuery(api.keys.get, { id: keyId });

  if (!key) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Comments for Key {key.pegNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <KeyComments keyId={keyId} />
        </div>
      </div>
    </div>
  );
}
