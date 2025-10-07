import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { KeyItems } from "./KeyItems";
import { KeyHistory } from "./KeyHistory";

export function KeyForm({ 
  keyId, 
  onClose 
}: { 
  keyId: Id<"keys"> | null, 
  onClose: () => void 
}) {
  const existingKey = useQuery(api.keys.get, keyId ? { id: keyId } : "skip");
  
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
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {keyId ? "Edit Key" : "Add New Key"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 scrollbar-custom">
          <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="pegNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Peg Number *
              </label>
              <input
                type="text"
                id="pegNumber"
                name="pegNumber"
                value={formData.pegNumber}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.pegNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                } rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white`}
              />
              {errors.pegNumber && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.pegNumber}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Site Name *
              </label>
              <input
                type="text"
                id="siteName"
                name="siteName"
                value={formData.siteName}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.siteName ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                } rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white`}
              />
              {errors.siteName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.siteName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Address *
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${
                  errors.address ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                } rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white`}
              />
              {errors.address && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
              )}
            </div>
            
            <h3 className="text-md font-medium text-gray-900 dark:text-white mt-6 mb-3">Contact Information</h3>
            
            <div>
              <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact Name
              </label>
              <input
                type="text"
                id="contactName"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact Email
              </label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact Phone
              </label>
              <input
                type="tel"
                id="contactPhone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <h3 className="text-md font-medium text-gray-900 dark:text-white mt-6 mb-3">Notes</h3>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                General Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add any notes about this key here..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            

          </div>
          
          <div className="mt-6 flex justify-between items-center">
            {keyId && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to delete this key? This will also delete all associated key items.")) {
                    try {
                      await removeKey({ id: keyId });
                      toast.success("Key deleted successfully");
                      onClose();
                    } catch (error: any) {
                      toast.error(error.message || "Failed to delete key");
                      console.error(error);
                    }
                  }
                }}
                className="px-4 py-2 border border-red-300 dark:border-red-600 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete Key
              </button>
            )}
            <div className="flex space-x-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </button>
            </div>
          </div>
        </form>
        
        {/* Key Items section - only show when editing an existing key */}
        {keyId && (
          <div className="px-4 pb-4">
            <KeyItems keyId={keyId} />
          </div>
        )}
        
        {/* Key History section - only show when editing an existing key */}
        {keyId && (
          <div className="px-4 pb-4">
            <KeyHistory keyId={keyId} />
          </div>
        )}

      </div>
    </div>
    </div>
  );
}
