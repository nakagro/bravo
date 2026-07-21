import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { KeyForm } from "./KeyForm";
import { KeyDetailPanel } from "./KeyDetailPanel";
import { useSearchParams } from "react-router-dom";

// Import shadcn components
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { cn } from "../../../lib/utils";
import { Search, Plus, LayoutGrid, List, ChevronDown, ChevronUp, KeyRound, X, Phone, User } from "lucide-react";

type ViewMode = 'cards' | 'table';
type SortField = 'pegNumber' | 'siteName' | 'address' | 'itemCount';
type SortDirection = 'asc' | 'desc';

export function KeyInventory() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<Id<"keys"> | null>(null);
  const [viewingKey, setViewingKey] = useState<Id<"keys"> | null>(null);

  const isMobileDevice = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  };

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('keyInventoryViewMode');
      if (savedViewMode) {
        return (savedViewMode === 'table' ? 'table' : 'cards') as ViewMode;
      }
      return isMobileDevice() ? 'cards' : 'table';
    }
    return 'cards';
  });

  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>(() => ({
    field: (searchParams.get('sort') as SortField) || 'pegNumber',
    direction: (searchParams.get('dir') as SortDirection) || 'asc',
  }));

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    const currentTab = searchParams.get("tab");
    if (currentTab) params.set("tab", currentTab);
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (sortConfig.field !== 'pegNumber') params.set('sort', sortConfig.field);
    if (sortConfig.direction !== 'asc') params.set('dir', sortConfig.direction);
    setSearchParams(params, { replace: true });
    // searchParams is read for the current tab only; including it would
    // re-run this effect on its own setSearchParams call above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortConfig, setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearch("");
  }, []);

  const keys = useQuery(api.keys.list, {
    search: debouncedSearch || undefined,
  });

  // Persist view mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('keyInventoryViewMode', viewMode);
    }
  }, [viewMode]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const sortedKeys = useMemo(() => {
    if (!keys) return [];

    return [...keys].sort((a, b) => {
      const { field, direction } = sortConfig;
      let comparison = 0;

      switch (field) {
        case 'pegNumber': {
          const aPegNum = parseInt(a.pegNumber, 10);
          const bPegNum = parseInt(b.pegNumber, 10);
          if (!isNaN(aPegNum) && !isNaN(bPegNum)) {
            comparison = aPegNum - bPegNum;
          } else {
            comparison = a.pegNumber.localeCompare(b.pegNumber);
          }
          break;
        }
        case 'siteName':
          comparison = a.siteName.localeCompare(b.siteName);
          break;
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'itemCount':
          comparison = a.itemCount - b.itemCount;
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

  // Empty state when no keys exist at all
  if (keys.length === 0 && !debouncedSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-red-50 dark:bg-red-950/30 p-5 mb-5">
          <KeyRound className="h-12 w-12 text-red-400 dark:text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No protected premises keys yet</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-2 max-w-md">
          Track keys held for protected premises in your brigade area. Each key record includes the peg number, site details, contact info, and individual items on the peg.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-center mb-6 max-w-md text-sm">
          Members can quickly look up addresses and contacts during callouts.
        </p>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add First Key
        </Button>
        {showAddForm && (
          <KeyForm keyId={null} onClose={() => setShowAddForm(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-component="KeyInventory">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search - instant filtering */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <Input
            type="text"
            placeholder="Search by peg, site, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus-visible:ring-red-500"
          />
          {searchTerm && (
            <button
              onClick={clearFilters}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* View mode toggle */}
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
          <span className="hidden sm:inline">Add Key</span>
        </Button>
      </div>

      {/* Search results indicator */}
      {debouncedSearch && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>{sortedKeys.length} result{sortedKeys.length !== 1 ? 's' : ''} for &ldquo;{debouncedSearch}&rdquo;</span>
          <button onClick={clearFilters} className="text-red-600 dark:text-red-400 hover:underline text-sm">
            Clear
          </button>
        </div>
      )}

      {/* No search results */}
      {debouncedSearch && sortedKeys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Search className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No keys match &ldquo;{debouncedSearch}&rdquo;
          </p>
          <button onClick={clearFilters} className="mt-2 text-red-600 dark:text-red-400 hover:underline text-sm">
            Clear search
          </button>
        </div>
      )}

      {/* Display keys based on view mode */}
      {sortedKeys.length > 0 && (
        <>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedKeys.map(key => (
                <KeyCard
                  key={key._id}
                  keyData={key}
                  onView={() => setViewingKey(key._id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader className="bg-gray-50 dark:bg-gray-800">
                  <TableRow>
                    <TableHead className="cursor-pointer w-[50px]" onClick={() => handleSort('pegNumber')}>
                      <div className="flex items-center">
                        Peg
                        {sortConfig.field === 'pegNumber' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('siteName')}>
                      <div className="flex items-center">
                        Site Name
                        {sortConfig.field === 'siteName' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hidden md:table-cell" onClick={() => handleSort('address')}>
                      <div className="flex items-center">
                        Address
                        {sortConfig.field === 'address' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer w-[180px]" onClick={() => handleSort('itemCount')}>
                      <div className="flex items-center">
                        Items
                        {sortConfig.field === 'itemCount' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedKeys.map((key, idx) => (
                    <TableRow
                      key={key._id}
                      className={cn(
                        "cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors",
                        idx % 2 === 0
                          ? "bg-white dark:bg-gray-900"
                          : "bg-gray-50/50 dark:bg-gray-800/50"
                      )}
                      onClick={() => setViewingKey(key._id)}
                    >
                      <TableCell className="font-semibold text-red-700 dark:text-red-400">{key.pegNumber}</TableCell>
                      <TableCell className="font-medium">{key.siteName}</TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600 dark:text-gray-400">{key.address}</TableCell>
                      <TableCell>
                        {key.itemSummary ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {key.itemSummary}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Detail Panel - read-only quick view */}
      {viewingKey && (
        <KeyDetailPanel
          keyId={viewingKey}
          onClose={() => setViewingKey(null)}
          onEdit={() => {
            setEditingKey(viewingKey);
            setViewingKey(null);
          }}
        />
      )}

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
    </div>
  );
}

// KeyCard component for card view
function KeyCard({
  keyData,
  onView,
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
    itemCount: number,
    itemSummary: string,
  },
  onView: () => void,
}) {
  return (
    <div
      className="group cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-red-400 dark:hover:border-red-500 transition-all hover:shadow-md p-3 flex flex-col"
      onClick={onView}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-lg font-bold text-red-700 dark:text-red-400">{keyData.pegNumber}</span>
        {keyData.itemCount > 0 && (
          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
            {keyData.itemSummary}
          </Badge>
        )}
      </div>

      {/* Site info */}
      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{keyData.siteName}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{keyData.address}</p>

      {/* Contact quick info */}
      {(keyData.contactName || keyData.contactPhone) && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
          {keyData.contactName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{keyData.contactName}</span>
            </div>
          )}
          {keyData.contactPhone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{keyData.contactPhone}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes preview */}
      {keyData.notes && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 truncate italic" title={keyData.notes}>
          {keyData.notes}
        </p>
      )}
    </div>
  );
}
