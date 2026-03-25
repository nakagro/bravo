import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { statusConfig, priorityConfig } from "../types";
import type { StatusType, PriorityType } from "../types";
import { VehicleFaultAttachments } from "./VehicleFaultAttachments";

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
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";

interface VehicleFaultFormProps {
  faultId?: Id<"vehicleFaults">; // undefined = create mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function VehicleFaultForm({
  faultId,
  open,
  onOpenChange,
  onSaved,
}: VehicleFaultFormProps) {
  const isMobile = useIsMobile();
  const isEdit = !!faultId;

  const fault = useQuery(
    api.vehicleFaults.getVehicleFault,
    faultId ? { faultId } : "skip"
  );
  const vehicleTypes = useQuery(api.vehicleFaultVehicleTypes.getVehicleTypes);
  const createFault = useMutation(api.vehicleFaults.createVehicleFault);
  const updateFault = useMutation(api.vehicleFaults.updateVehicleFault);

  const [formData, setFormData] = useState({
    vehicle: "",
    shortDescription: "",
    longDescription: "",
    notes: "",
    eamRequestNumber: "",
    dateReported: new Date().toISOString().split("T")[0],
    dateLogged: "",
    priority: "medium" as PriorityType,
    status: "pending_dmo" as StatusType,
  });
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (fault && isEdit) {
      setFormData({
        vehicle: fault.vehicle,
        shortDescription: fault.shortDescription,
        longDescription: fault.longDescription,
        notes: fault.notes || "",
        eamRequestNumber: fault.eamRequestNumber || "",
        dateReported: new Date(fault.dateReported).toISOString().split("T")[0],
        dateLogged: fault.dateLogged
          ? new Date(fault.dateLogged).toISOString().split("T")[0]
          : "",
        priority: fault.priority,
        status: fault.status,
      });
    }
  }, [fault, isEdit]);

  // Reset form when opening in create mode
  useEffect(() => {
    if (open && !isEdit) {
      setFormData({
        vehicle: "",
        shortDescription: "",
        longDescription: "",
        notes: "",
        eamRequestNumber: "",
        dateReported: new Date().toISOString().split("T")[0],
        dateLogged: "",
        priority: "medium",
        status: "pending_dmo",
      });
    }
  }, [open, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicle || !formData.shortDescription || !formData.longDescription || !formData.dateReported) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && faultId) {
        const updatePayload: any = {
          faultId,
          vehicle: formData.vehicle,
          shortDescription: formData.shortDescription,
          longDescription: formData.longDescription,
          eamRequestNumber: formData.eamRequestNumber || undefined,
          status: formData.status,
          priority: formData.priority,
          notes: formData.notes || undefined,
        };

        // Auto-set dateLogged when moving to pending_wydv
        if (formData.status === "pending_wydv" && !fault?.dateLogged) {
          updatePayload.dateLogged = Date.now();
        }

        await updateFault(updatePayload);
        toast.success("Fault updated");
      } else {
        await createFault({
          dateReported: new Date(formData.dateReported).getTime(),
          dateLogged: formData.dateLogged
            ? new Date(formData.dateLogged).getTime()
            : undefined,
          vehicle: formData.vehicle,
          shortDescription: formData.shortDescription,
          longDescription: formData.longDescription,
          eamRequestNumber: formData.eamRequestNumber || undefined,
          priority: formData.priority,
          notes: formData.notes || undefined,
        });
        toast.success("Fault reported");
      }

      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error(isEdit ? "Failed to update fault" : "Failed to report fault");
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
      {/* Vehicle + Priority row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vehicle *</Label>
          <Select
            value={formData.vehicle}
            onValueChange={(v) => setFormData({ ...formData, vehicle: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes?.map((vt) => (
                <SelectItem key={vt._id} value={vt.name}>
                  {vt.name}
                </SelectItem>
              ))}
              {/* Fallback if vehicle types not loaded or current value is custom */}
              {!vehicleTypes?.length && (
                <>
                  <SelectItem value="Pumper">Pumper</SelectItem>
                  <SelectItem value="Tanker">Tanker</SelectItem>
                  <SelectItem value="FCV">FCV</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority *</Label>
          <Select
            value={formData.priority}
            onValueChange={(v) =>
              setFormData({ ...formData, priority: v as PriorityType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status (edit only) + EAM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isEdit && (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) =>
                setFormData({ ...formData, status: v as StatusType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>EAM Request Number</Label>
          <Input
            value={formData.eamRequestNumber}
            onChange={(e) =>
              setFormData({ ...formData, eamRequestNumber: e.target.value })
            }
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date Reported *</Label>
          <Input
            type="date"
            value={formData.dateReported}
            onChange={(e) =>
              setFormData({ ...formData, dateReported: e.target.value })
            }
          />
        </div>
        {!isEdit && (
          <div className="space-y-2">
            <Label>Date Logged</Label>
            <Input
              type="date"
              value={formData.dateLogged}
              onChange={(e) =>
                setFormData({ ...formData, dateLogged: e.target.value })
              }
            />
          </div>
        )}
      </div>

      {/* Descriptions */}
      <div className="space-y-2">
        <Label>Short Description *</Label>
        <Input
          placeholder="e.g., Air leak, Electrical issue"
          value={formData.shortDescription}
          onChange={(e) =>
            setFormData({ ...formData, shortDescription: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Detailed Description *</Label>
        <Textarea
          placeholder="Provide detailed information about the fault..."
          value={formData.longDescription}
          onChange={(e) =>
            setFormData({ ...formData, longDescription: e.target.value })
          }
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label>Additional Notes</Label>
        <Textarea
          placeholder="Any additional information..."
          value={formData.notes}
          onChange={(e) =>
            setFormData({ ...formData, notes: e.target.value })
          }
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Attachments in edit mode */}
      {isEdit && faultId && (
        <VehicleFaultAttachments faultId={faultId} mode="edit" />
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 pb-4">
        <Button type="submit" className="flex-1 gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Report Fault"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[92vh] flex flex-col border-gray-700">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "Edit Fault" : "Report Vehicle Fault"}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Fault" : "Report Vehicle Fault"}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
