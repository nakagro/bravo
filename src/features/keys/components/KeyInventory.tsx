import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { KeyComments } from "./KeyComments";
import { KeyForm } from "./KeyForm";

// Import shadcn components
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { cn } from "../../../lib/utils";
import { Search, Plus, LayoutGrid, List, ChevronDown, ChevronUp, Edit, Mail, Phone, User, KeyRound } from "lucide-react";

type ViewMode = 'cards' | 'table';
type SortField = 'pegNumber' | 'siteName' | 'address' | 'itemCount';
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
          // Parse as numbers for proper numeric sorting
          const aPegNum = parseInt(a.pegNumber, 10);
          const bPegNum = parseInt(b.pegNumber, 10);
          
          // If both are valid numbers, compare numerically
          if (!isNaN(aPegNum) && !isNaN(bPegNum)) {
            comparison = aPegNum - bPegNum;
          } else {
            // Fallback to string comparison if either is not a number
            comparison = a.pegNumber.localeCompare(b.pegNumber);
          }
          break;
        case 'siteName':
          comparison = a.siteName.localeCompare(b.siteName);
          break;
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'itemCount':
          comparison = a.itemCount - b.itemCount;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 dark:border-red-500"></div>
      </div>
    );
  }

  // Empty state when no keys exist
  if (keys.length === 0 && !filters.search) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
          <KeyRound className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No keys yet</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-sm">
          Get started by adding your first key to the inventory.
        </p>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add First Key
        </Button>
        {showAddForm && (
          <KeyForm
            keyId={null}
            onClose={() => setShowAddForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-component="KeyInventory">
      <div className="flex justify-between items-center gap-4">
        <div className="flex flex-wrap gap-2 ml-auto">
          {/* View mode selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
            <Button
              onClick={() => setViewMode('cards')}
              variant={viewMode === 'cards' ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex items-center rounded-r-none",
                viewMode === 'cards' && "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
              )}
              title="Card View"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
            <Button
              onClick={() => setViewMode('table')}
              variant={viewMode === 'table' ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex items-center rounded-l-none",
                viewMode === 'table' && "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
              )}
              title="Table View"
            >
              <List className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Table</span>
            </Button>
          </div>
          <Button
            onClick={() => setShowAddForm(true)}
            variant="default"
            className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Key
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:gap-4">
          {/* Search input */}
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                type="text"
                placeholder="Search keys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus-visible:ring-red-500"
              />
            </div>
            <Button
              onClick={handleSearch}
              variant="default"
              className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
            >
              Search
            </Button>
            {filters.search && (
              <Button
                onClick={clearFilters}
                variant="outline"
                className="border-gray-300 dark:border-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Clear
              </Button>
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800">
                <TableRow>
                  <TableHead 
                    className="cursor-pointer w-[50px]"
                    onClick={() => handleSort('pegNumber')}
                  >
                    <div className="flex items-center">
                      Peg
                      {sortConfig.field === 'pegNumber' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('siteName')}
                  >
                    <div className="flex items-center">
                      Site Name
                      {sortConfig.field === 'siteName' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer"
                    onClick={() => handleSort('address')}
                  >
                    <div className="flex items-center">
                      Address
                      {sortConfig.field === 'address' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer w-[100px] text-center"
                    onClick={() => handleSort('itemCount')}
                  >
                    <div className="flex items-center justify-center">
                      Items
                      {sortConfig.field === 'itemCount' && (
                        <span className="ml-1">
                          {sortConfig.direction === 'asc' ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>
                    Notes
                  </TableHead>
                  <TableHead className="text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedKeys.map((key, idx) => (
                  <TableRow
                    key={key._id}
                    className={
                      cn(
                        "hover:bg-gray-50 dark:hover:bg-gray-700",
                        idx % 2 === 0
                          ? "bg-white dark:bg-gray-900"
                          : "bg-gray-50 dark:bg-gray-800"
                      )
                    }
                  >
                    <TableCell className="font-medium">{key.pegNumber}</TableCell>
                    <TableCell>{key.siteName}</TableCell>
                    <TableCell>{key.address}</TableCell>
                    <TableCell className="text-center">
                      {key.itemCount > 0 && (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold">
                          {key.itemCount}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {key.notes && (
                        <div className="max-w-xs truncate">
                          {key.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 h-8 w-8 p-0"
                        onClick={() => setEditingKey(key._id)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    updatedAt: number,
    itemCount: number
  }, 
  onEdit: () => void
}) {
  return (
    <Card 
      className="cursor-pointer hover:border-red-500 dark:hover:border-red-400 border-gray-200 dark:border-gray-700 transition-colors shadow-sm flex flex-col"
      onClick={onEdit}
    >
      <CardHeader className="p-3 pb-0 space-y-0">
        <div className="flex justify-between items-start">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{keyData.pegNumber}</h3>
          {keyData.itemCount > 0 && (
            <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">
              {keyData.itemCount} {keyData.itemCount === 1 ? 'item' : 'items'}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-3 pt-2 text-sm text-gray-600 dark:text-gray-400 grid grid-cols-1 gap-y-1 flex-1">
        <p className="font-medium text-gray-700 dark:text-gray-300">{keyData.siteName}</p>
        <p>{keyData.address}</p>
        
        {/* Contact Information - Condensed */}
        {keyData.contactName && (
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            <p>{keyData.contactName}</p>
          </div>
        )}
        {keyData.contactPhone && (
          <div className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            <p>{keyData.contactPhone}</p>
          </div>
        )}
        {keyData.contactEmail && (
          <div className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            <p>{keyData.contactEmail}</p>
          </div>
        )}
        
        {/* Notes - Condensed */}
        {keyData.notes && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={keyData.notes}>
            Notes: {keyData.notes}
          </p>
        )}
      </CardContent>
      
      <CardFooter className="p-3 pt-0 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click from triggering
            onEdit();
          }}
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
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
      <Card className="max-w-2xl w-full max-h-[90vh] flex flex-col border-gray-200 dark:border-gray-700 shadow-xl">
        <CardHeader className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-row items-center justify-between space-y-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Comments for Key {key.pegNumber}
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full h-8 w-8"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4">
          <KeyComments keyId={keyId} />
        </CardContent>
      </Card>
    </div>
  );
}
