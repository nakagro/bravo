import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { KeyItems } from "./KeyItems";
import { KeyHistory } from "./KeyHistory";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useIsMobile } from "@/hooks/use-mobile";

export function KeyForm({ 
  keyId, 
  onClose 
}: { 
  keyId: Id<"keys"> | null, 
  onClose: () => void 
}) {
  const isMobile = useIsMobile();
  const existingKey = useQuery(api.keys.get, keyId ? { id: keyId } : "skip");
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'history'>('details');
  
  const [formData, setFormData] = useState({
    pegNumber: "",
    siteName: "",
    address: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const addKey = useMutation(api.keys.add);
  const updateKey = useMutation(api.keys.update);
  const removeKey = useMutation(api.keys.remove);
  
  // Load existing key data if editing
  useEffect(() => {
    if (existingKey) {
      setFormData({
        pegNumber: existingKey.pegNumber,
        siteName: existingKey.siteName,
        address: existingKey.address,
        contactName: existingKey.contactName || "",
        contactEmail: existingKey.contactEmail || "",
        contactPhone: existingKey.contactPhone || "",
        notes: existingKey.notes || "",
      });
    }
  }, [existingKey]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.pegNumber.trim()) {
      newErrors.pegNumber = "Peg number is required";
    }
    
    if (!formData.siteName.trim()) {
      newErrors.siteName = "Site name is required";
    }
    
    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (keyId) {
        // Update existing key
        await updateKey({
          id: keyId,
          ...formData,
        });
        toast.success("Key updated successfully");
      } else {
        // Add new key
        await addKey(formData);
        toast.success("Key added successfully");
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Form content - shared between mobile drawer and desktop dialog
  const formContent = (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'items' | 'history')} className="flex flex-col flex-1 min-h-0">
      {/* Custom tab bar with proper mobile sizing */}
      <div className={`grid w-full ${keyId ? 'grid-cols-3' : 'grid-cols-1'} gap-1 p-1 bg-muted rounded-lg flex-shrink-0`}>
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
        {keyId && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`h-11 rounded-md text-base font-medium transition-all ${
                activeTab === 'items'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Items
            </button>
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
          </>
        )}
      </div>

      <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 pb-20">
        <form id="key-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Site Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Site Information</h3>
            
            <div>
              <Label htmlFor="pegNumber" className="text-base font-medium">Peg Number *</Label>
              <Input
                id="pegNumber"
                name="pegNumber"
                value={formData.pegNumber}
                onChange={handleChange}
                className={`mt-2 h-12 text-base ${errors.pegNumber ? 'border-red-500' : ''}`}
                placeholder="e.g., A1"
              />
              {errors.pegNumber && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.pegNumber}</p>
              )}
            </div>

            <div>
              <Label htmlFor="siteName" className="text-base font-medium">Site Name *</Label>
              <Input
                id="siteName"
                name="siteName"
                value={formData.siteName}
                onChange={handleChange}
                className={`mt-2 h-12 text-base ${errors.siteName ? 'border-red-500' : ''}`}
                placeholder="e.g., Community Hall"
              />
              {errors.siteName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.siteName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address" className="text-base font-medium">Address *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={`mt-2 h-12 text-base ${errors.address ? 'border-red-500' : ''}`}
                placeholder="e.g., 123 Main Street"
              />
              {errors.address && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Information</h3>
            
            <div>
              <Label htmlFor="contactName" className="text-base font-medium">Contact Name</Label>
              <Input
                id="contactName"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                className="mt-2 h-12 text-base"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="contactEmail" className="text-base font-medium">Contact Email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange}
                className="mt-2 h-12 text-base"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="contactPhone" className="text-base font-medium">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={handleChange}
                className="mt-2 h-12 text-base"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
            
            <div>
              <Label htmlFor="notes" className="text-base font-medium">General Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="mt-2 min-h-[100px] text-base"
                placeholder="Add any notes about this key..."
              />
            </div>
          </div>

          {/* Delete Action - only for existing keys */}
          {keyId && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</h3>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-12 text-base justify-start border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <TrashIcon className="h-5 w-5 mr-3" />
                    Delete Key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{existingKey?.siteName}" and all associated key items. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          await removeKey({ id: keyId });
                          toast.success("Key deleted successfully");
                          onClose();
                        } catch (error: any) {
                          toast.error(error.message || "Failed to delete key");
                        }
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </form>
      </TabsContent>

      {keyId && (
        <>
          <TabsContent value="items" className="flex-1 overflow-y-auto mt-4">
            <KeyItems keyId={keyId} />
          </TabsContent>
          <TabsContent value="history" className="flex-1 overflow-y-auto mt-4">
            <KeyHistory keyId={keyId} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );

  // Sticky footer with action buttons
  const formFooter = (
    <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
        Cancel
      </Button>
      <Button 
        type="submit" 
        form="key-form" 
        disabled={isSubmitting}
        className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Saving..." : (keyId ? "Update" : "Add")} Key
      </Button>
    </div>
  );

  // Mobile: Full-screen drawer sliding up from bottom
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="h-[95vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-xl font-bold">
                {keyId ? `Edit Key - ${existingKey?.pegNumber || ''}` : 'Add New Key'}
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
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-xl font-bold">
            {keyId ? `Edit Key - ${existingKey?.pegNumber || ''}` : 'Add New Key'}
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
