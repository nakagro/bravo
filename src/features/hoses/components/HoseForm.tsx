import React, { useState, useEffect } from "react";
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
  // DialogFooter, // Will be used later
  // DialogClose, // May not be needed if using default DialogContent close button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XMarkIcon, ArrowPathIcon, TrashIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

// Type definitions
type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";
type Size = "25" | "38" | "65";
type Type = "Canvas" | "Duraline";

export function HoseForm({ hoseId, onClose }: { hoseId: Id<"hoses"> | null, onClose: () => void }) {
  const hoses = useQuery(api.hoses.list, {});
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

  // Update form data when hose data loads (fixes test date display bug when filtered)
  useEffect(() => {
    if (hose) {
      setFormData({
        hoseId: hose.hoseId,
        length: hose.length,
        size: hose.size,
        type: hose.type,
        testDate: hose.testDate ? new Date(hose.testDate).toISOString().split('T')[0] : "",
        status: hose.status,
      });
    }
  }, [hose]);

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
  
  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 w-full max-w-md h-[80vh] shadow-xl flex flex-col" style={{ minHeight: '600px' }}>
        {/* Original close button SVG is removed, relying on DialogContent's default close button */}
        <DialogHeader className="mb-6 text-left flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
            {hoseId ? `Edit Hose - ${hose?.hoseId}` : 'Add New Hose'}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'comments' | 'history')} className="w-full flex flex-col flex-grow min-h-0">
          <TabsList className={`grid w-full ${hoseId ? 'grid-cols-3' : 'grid-cols-1'} mb-4 flex-shrink-0`}>
            <TabsTrigger value="details">Hose Details</TabsTrigger>
            {hoseId && (
              <>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="details" className="flex-grow overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Hose Identification</h3>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="hoseId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hose ID</Label>
                <Input
                  id="hoseId"
                  type="text"
                  value={formData.hoseId}
                  onChange={(e) => setFormData(f => ({ ...f, hoseId: e.target.value }))}
                  className="mt-1 block w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="WV0001"
                  required
                  disabled={!!hoseId}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="hoseType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(f => ({ ...f, type: value as Type }))}
                    required
                  >
                    <SelectTrigger id="hoseType" className="mt-1 w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Canvas">Canvas</SelectItem>
                      <SelectItem value="Duraline">Duraline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hoseSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Size</Label>
                  <Select
                    value={formData.size}
                    onValueChange={(value) => setFormData(f => ({ ...f, size: value as Size }))}
                    required
                  >
                    <SelectTrigger id="hoseSize" className="mt-1 w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25mm</SelectItem>
                      <SelectItem value="38">38mm</SelectItem>
                      <SelectItem value="65">65mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="lengthOption" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Length (m)</Label>
                <Select
                  value={lengthOption}
                  onValueChange={(value) => {
                    const val = value as '15' | '30' | 'other';
                    setLengthOption(val);
                    if (val === '15') {
                      setFormData(f => ({ ...f, length: 15 }));
                    } else if (val === '30') {
                      setFormData(f => ({ ...f, length: 30 }));
                    } else if (val === 'other') {
                      setFormData(f => ({ ...f, length: customLength }));
                    }
                  }}
                  required
                >
                  <SelectTrigger id="lengthOption" className="mt-1 w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select length" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15m</SelectItem>
                    <SelectItem value="30">30m</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                
                {lengthOption === 'other' && (
                  <div className="mt-2">
                    <Label htmlFor="customLength" className="sr-only">Custom Length</Label> {/* sr-only if not visually needed but good for a11y */}
                    <Input
                      id="customLength"
                      type="number"
                      value={customLength}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setCustomLength(value);
                        setFormData(f => ({ ...f, length: value }));
                      }}
                      className="block w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Custom length (m)"
                      required={lengthOption === 'other'}
                      min="1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Status & Testing</h3>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(f => ({ ...f, status: value as Status }))}
                  required
                >
                  <SelectTrigger id="status" className="mt-1 w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In date">In date</SelectItem>
                    <SelectItem value="Due for testing">Due for testing</SelectItem>
                    <SelectItem value="With district for repair">With district for repair</SelectItem>
                    <SelectItem value="Condemned">Condemned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="testDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Test Date</Label>
                <Input
                  id="testDate"
                  type="date"
                  value={formData.testDate}
                  onChange={(e) => setFormData(f => ({ ...f, testDate: e.target.value }))}
                  className="mt-1 block w-full dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                
                {/* Status Change Warning */}
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
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          statusWarning.isImprovement 
                            ? 'text-green-800 dark:text-green-200' 
                            : 'text-amber-800 dark:text-amber-200'
                        }`}>
                          Automatic Status Change
                        </p>
                        <p className={`text-sm mt-1 ${
                          statusWarning.isImprovement 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-amber-700 dark:text-amber-300'
                        }`}>
                          Changing the test date will automatically update the status from 
                          <span className="font-medium">"{statusWarning.currentStatus}"</span> to 
                          <span className="font-medium">"{statusWarning.suggestedStatus}"</span>
                          {statusWarning.isImprovement 
                            ? ' because the test date is within the last year.' 
                            : ' because the test date is more than a year old.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {hoseId && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Hose Actions</h3>
              <div className="space-y-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 justify-start w-full p-2"
                    >
                      <ArrowPathIcon className="h-5 w-5 mr-2" />
                      Mark as Replaced
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Mark Hose as Replaced</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will record that hose {hose?.hoseId} has been replaced with a new hose. This action is for historical tracking purposes only.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mb-4">
                      <Label htmlFor="replacementNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</Label>
                      <Textarea
                        id="replacementNotes"
                        value={replacementNotes}
                        onChange={(e) => setReplacementNotes(e.target.value)}
                        placeholder="Enter any notes about the replacement..."
                        className="mt-1 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setReplacementNotes('')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMarkAsReplaced}>Confirm Replace</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 justify-start w-full p-2"
                    >
                      <TrashIcon className="h-5 w-5 mr-2" />
                      Delete Hose
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure you want to delete this hose?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete hose {hose?.hoseId} and all its associated history and comments. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="deletionReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for deletion (optional)</Label>
                      <Textarea
                        id="deletionReason"
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        placeholder="Enter reason for deletion..."
                        className="mt-1 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeletionReason('')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteHose} // Changed from handleDelete to handleDeleteHose
                        className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white dark:text-gray-900"
                      >
                        Confirm Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              // className="px-4 py-2 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="px-6 py-2 bg-red-700 dark:bg-red-600 text-white hover:bg-red-800 dark:hover:bg-red-700 font-medium"
            >
              {hoseId ? "Update" : "Add"} Hose
            </Button>
          </div>
        </form>
          </TabsContent>
          {hoseId && (
            <>
              <TabsContent value="comments" className="flex-grow overflow-y-auto">
          <HoseComments hoseId={hoseId!} />
              </TabsContent>
              <TabsContent value="history" className="flex-grow overflow-y-auto">
          <div className="mt-4">
            <HoseHistory hoseId={hoseId!} />
          </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
      

    </Dialog>
  );
}
