import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { HoseComments } from "./HoseComments"; 
import { HoseHistory } from "./HoseHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ArrowPathIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Status, Size, Type, Location } from "../types";
import { useIsMobile } from "@/hooks/use-mobile";

// Types are imported from ../types

export function HoseForm({ hoseId, onClose }: { hoseId: Id<"hoses"> | null, onClose: () => void }) {
  const isMobile = useIsMobile();
  const hoses = useQuery(api.hoses.list, {});
  const moduleSettings = useQuery(api.modules.getModuleSettings, {});
  const hose = hoses?.find((h: Doc<"hoses">) => h._id === hoseId);
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
  const [lengthOption, setLengthOption] = useState<'1.5' | '3' | '5' | '15' | '30' | 'other'>(
    initialLength === 1.5
      ? '1.5'
      : initialLength === 3
      ? '3'
      : initialLength === 5
      ? '5'
      : initialLength === 15
      ? '15'
      : initialLength === 30
      ? '30'
      : 'other'
  );
  const [customLength, setCustomLength] = useState(
    initialLength !== 15 && initialLength !== 30 ? initialLength : 0
  );

  const [formData, setFormData] = useState({
    hoseId: hose?.hoseId || "WV",
    length: hose?.length || 15,
    size: hose?.size || "25" as Size,
    type: hose?.type || "Canvas" as Type,
    location: (hose?.location as Location | undefined) || undefined,
    testDate: hose?.testDate ? new Date(hose.testDate).toISOString().split('T')[0] : "",
    status: hose?.status || "In date" as Status,
  });

  // Update form data when hose data loads (fixes test date display bug when filtered)
  useEffect(() => {
    if (hose) {
      setFormData({
        hoseId: hose.hoseId,
        length: hose.length,
        size: hose.size,
        type: hose.type,
        location: (hose.location as Location | undefined) || undefined,
        testDate: hose.testDate ? new Date(hose.testDate).toISOString().split('T')[0] : "",
        status: hose.status,
      });
    }
  }, [hose]);

  // Prefill default location for new hoses from module settings if available
  useEffect(() => {
    if (!hose && !formData.location) {
      const hosesModule = moduleSettings?.find((m: any) => m.moduleId === "hoses");
      const defaultLocation = hosesModule?.config?.defaultLocation as Location | undefined;
      if (defaultLocation) {
        setFormData((f) => ({ ...f, location: defaultLocation }));
      } else {
        // Fallback to Station
        setFormData((f) => ({ ...f, location: "Station" as Location }));
      }
    }
  }, [hose, formData.location, moduleSettings]);

  // Helper function to determine if a hose should be "In date" or "Due for testing" based on test date
  const getAutoStatus = (testDate: string): "In date" | "Due for testing" => {
    if (!testDate) return "Due for testing";
    const testTimestamp = new Date(testDate).getTime();
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000); // 365 days in milliseconds
    return testTimestamp >= oneYearAgo ? "In date" : "Due for testing";
  };

  // Check if the test date change will trigger an automatic status change
  const getStatusChangeWarning = () => {
    if (!hose || !formData.testDate) return null;
    
    const currentStatus = hose.status;
    const originalTestDate = hose.testDate ? new Date(hose.testDate).toISOString().split('T')[0] : "";
    
    // Only show warning for "In date" and "Due for testing" hoses
    if (currentStatus !== "In date" && currentStatus !== "Due for testing") {
      return null;
    }
    
    // Only show warning if test date has actually changed
    if (formData.testDate === originalTestDate) {
      return null;
    }
    
    const suggestedStatus = getAutoStatus(formData.testDate);
    
    // Only show warning if the status would actually change
    if (currentStatus === suggestedStatus) {
      return null;
    }
    
    return {
      currentStatus,
      suggestedStatus,
      isImprovement: suggestedStatus === "In date"
    };
  };

  const statusWarning = getStatusChangeWarning();

  const handleReplace = async () => {
    if (!hose) {
      toast.error("Hose data not found. Cannot mark as replaced.");
      setShowReplaceDialog(false);
      return;
    }
    try {
      await markAsReplaced({
        id: hose._id,
        notes: replacementNotes,
      });
      toast.success(`Hose ${hose.hoseId} marked as replaced successfully.`);
      setReplacementNotes("");
      setShowReplaceDialog(false);
      // onClose(); // Optional: call if the main form should close after this action
    } catch (error) {
      console.error("Failed to mark hose as replaced:", error);
      toast.error("Failed to mark hose as replaced. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (hoseId) {
        // Prepare update object
        const updateData: any = {
          id: hoseId,
          length: formData.length,
          size: formData.size,
          type: formData.type,
          testDate: new Date(formData.testDate).getTime(),
        };
        if (formData.location) updateData.location = formData.location;
        
        // Only include status if it's not going to be automatically managed
        // or if the user manually changed it from the original
        const originalStatus = hose?.status;
        const hasStatusWarning = statusWarning !== null;
        const userChangedStatus = formData.status !== originalStatus;
        
        // If there's a status warning and user hasn't manually changed status,
        // let the backend handle automatic status management
        if (!hasStatusWarning || userChangedStatus) {
          updateData.status = formData.status;
        }
        
        await update(updateData);
        toast.success("Hose updated successfully");
      } else {
        await add({
          hoseId: formData.hoseId,
          length: formData.length,
          size: formData.size,
          type: formData.type,
          ...(formData.location ? { location: formData.location } : {}),
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
  
  // useEffect for Escape key removed as shadcn/ui Dialog handles this.

  // Form content - shared between mobile drawer and desktop dialog
  const formContent = (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'comments' | 'history')} className="flex flex-col flex-1 min-h-0">
      {/* Custom tab bar with proper mobile sizing */}
      <div className={`grid w-full ${hoseId ? 'grid-cols-3' : 'grid-cols-1'} gap-1 p-1 bg-muted rounded-lg flex-shrink-0`}>
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`h-11 rounded-md text-base font-medium transition-all ${
            activeTab === 'details'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Details
        </button>
        {hoseId && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`h-11 rounded-md text-base font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`h-11 rounded-md text-base font-medium transition-all ${
                activeTab === 'comments'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Comments
            </button>
          </>
        )}
      </div>

      <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 pb-20">
        <form id="hose-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Hose Identification Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identification</h3>
            
            <div>
              <Label htmlFor="hoseId" className="text-base font-medium">Hose ID</Label>
              <Input
                id="hoseId"
                type="text"
                value={formData.hoseId}
                onChange={(e) => {
                  const next = e.target.value;
                  setFormData((f) => ({ ...f, hoseId: next }));
                  if (!hoseId) {
                    const match = next.trim().toUpperCase().match(/^WV\s*(25|38|65)/i);
                    if (match) {
                      setFormData((f) => ({ ...f, size: match[1] as Size }));
                    }
                  }
                }}
                onBlur={(e) => {
                  if (!hoseId && e.target.value.trim() === "") {
                    setFormData((f) => ({ ...f, hoseId: "WV" }));
                  }
                }}
                className="mt-2 h-12 text-base"
                placeholder="WV0001"
                required
                disabled={!!hoseId}
              />
            </div>

            {/* Type and Size - stacked on mobile */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hoseType" className="text-base font-medium">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(f => ({ ...f, type: value as Type }))}
                >
                  <SelectTrigger id="hoseType" className="mt-2 h-12 text-base">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Canvas" className="h-12 text-base">Canvas</SelectItem>
                    <SelectItem value="Duraline" className="h-12 text-base">Duraline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hoseSize" className="text-base font-medium">Size</Label>
                <Select
                  value={formData.size}
                  onValueChange={(value) => setFormData(f => ({ ...f, size: value as Size }))}
                >
                  <SelectTrigger id="hoseSize" className="mt-2 h-12 text-base">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25" className="h-12 text-base">25mm</SelectItem>
                    <SelectItem value="38" className="h-12 text-base">38mm</SelectItem>
                    <SelectItem value="65" className="h-12 text-base">65mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="hoseLocation" className="text-base font-medium">Location</Label>
              <Select
                value={formData.location ?? undefined}
                onValueChange={(value) => setFormData((f) => ({ ...f, location: value as Location }))}
              >
                <SelectTrigger id="hoseLocation" className="mt-2 h-12 text-base">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Station" className="h-12 text-base">Station</SelectItem>
                  <SelectItem value="Pumper" className="h-12 text-base">Pumper</SelectItem>
                  <SelectItem value="Tanker" className="h-12 text-base">Tanker</SelectItem>
                  <SelectItem value="FCV" className="h-12 text-base">FCV</SelectItem>
                  <SelectItem value="Other" className="h-12 text-base">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="lengthOption" className="text-base font-medium">Length</Label>
              <Select
                value={lengthOption}
                onValueChange={(value) => {
                  const val = value as '1.5' | '3' | '5' | '15' | '30' | 'other';
                  setLengthOption(val);
                  const lengths: Record<string, number> = { '1.5': 1.5, '3': 3, '5': 5, '15': 15, '30': 30 };
                  if (lengths[val]) {
                    setFormData((f) => ({ ...f, length: lengths[val] }));
                  } else if (val === 'other') {
                    setFormData((f) => ({ ...f, length: customLength }));
                  }
                }}
              >
                <SelectTrigger id="lengthOption" className="mt-2 h-12 text-base">
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.5" className="h-12 text-base">1.5m</SelectItem>
                  <SelectItem value="3" className="h-12 text-base">3m</SelectItem>
                  <SelectItem value="5" className="h-12 text-base">5m</SelectItem>
                  <SelectItem value="15" className="h-12 text-base">15m</SelectItem>
                  <SelectItem value="30" className="h-12 text-base">30m</SelectItem>
                  <SelectItem value="other" className="h-12 text-base">Other</SelectItem>
                </SelectContent>
              </Select>
              {lengthOption === 'other' && (
                <Input
                  id="customLength"
                  type="number"
                  value={customLength}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setCustomLength(value);
                    setFormData(f => ({ ...f, length: value }));
                  }}
                  className="mt-2 h-12 text-base"
                  placeholder="Custom length (m)"
                  required
                  min="1"
                  step="0.1"
                />
              )}
            </div>
          </div>
          
          {/* Status & Testing Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status & Testing</h3>
            
            <div>
              <Label htmlFor="status" className="text-base font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(f => ({ ...f, status: value as Status }))}
              >
                <SelectTrigger id="status" className="mt-2 h-12 text-base">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In date" className="h-12 text-base">In date</SelectItem>
                  <SelectItem value="Due for testing" className="h-12 text-base">Due for testing</SelectItem>
                  <SelectItem value="With district for repair" className="h-12 text-base">With district for repair</SelectItem>
                  <SelectItem value="Condemned" className="h-12 text-base">Condemned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="testDate" className="text-base font-medium">Test Date</Label>
              <Input
                id="testDate"
                type="date"
                value={formData.testDate}
                onChange={(e) => setFormData(f => ({ ...f, testDate: e.target.value }))}
                className="mt-2 h-12 text-base"
                required
              />
              {statusWarning && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  statusWarning.isImprovement 
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                    : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {statusWarning.isImprovement ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <p className={`text-sm ${statusWarning.isImprovement ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      Status will change to <span className="font-medium">"{statusWarning.suggestedStatus}"</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions Section - only for existing hoses */}
          {hoseId && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</h3>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full h-12 text-base justify-start">
                    <ArrowPathIcon className="h-5 w-5 mr-3" />
                    Mark as Replaced
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark Hose as Replaced</AlertDialogTitle>
                    <AlertDialogDescription>
                      Record that hose {hose?.hoseId} has been replaced.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    value={replacementNotes}
                    onChange={(e) => setReplacementNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="min-h-[100px]"
                  />
                  <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto" onClick={() => setReplacementNotes('')}>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="w-full sm:w-auto" onClick={handleMarkAsReplaced}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-12 text-base justify-start border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <TrashIcon className="h-5 w-5 mr-3" />
                    Delete Hose
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this hose?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {hose?.hoseId} and all history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder="Reason for deletion (optional)"
                    className="min-h-[100px]"
                  />
                  <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto" onClick={() => setDeletionReason('')}>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteHose}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </form>
      </TabsContent>

      {hoseId && (
        <>
          <TabsContent value="history" className="flex-1 overflow-y-auto mt-4">
            <HoseHistory hoseId={hoseId} />
          </TabsContent>
          <TabsContent value="comments" className="flex-1 overflow-y-auto mt-4">
            <HoseComments hoseId={hoseId} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );

  // Sticky footer with action buttons
  const formFooter = (
    <div className="flex gap-3 p-4 border-t border-gray-700 dark:border-gray-700 bg-background">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
        Cancel
      </Button>
      <Button type="submit" form="hose-form" className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800">
        {hoseId ? "Update" : "Add"} Hose
      </Button>
    </div>
  );

  // Mobile: Full-screen drawer sliding up from bottom
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="h-[95vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 border-b border-gray-700 pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-xl font-bold">
                {hoseId ? `Edit ${hose?.hoseId || 'Hose'}` : 'Add New Hose'}
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10">
                <XMarkIcon className="h-6 w-6" />
              </Button>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pt-4">
            {formContent}
          </div>
          <DrawerFooter className="flex-shrink-0 p-0">
            {formFooter}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Traditional dialog
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 dark:border-gray-700">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-gray-700 dark:border-gray-700">
          <DialogTitle className="text-xl font-bold">
            {hoseId ? `Edit Hose - ${hose?.hoseId}` : 'Add New Hose'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pt-4">
          {formContent}
        </div>
        <div className="flex-shrink-0">
          {formFooter}
        </div>
      </DialogContent>
    </Dialog>
  );
}
