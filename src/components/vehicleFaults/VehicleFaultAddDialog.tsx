import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { toast } from '../../hooks/use-toast';

export type VehicleType = 'Pumper' | 'Tanker' | 'FCV';
export type PriorityType = 'low' | 'medium' | 'high';

export interface AddFaultFormData {
  vehicle: VehicleType;
  shortDescription: string;
  longDescription: string;
  notes?: string;
  eamRequestNumber?: string;
  dateReported: number;
  dateLogged?: number;
  priority: PriorityType;
}

interface VehicleFaultAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddFaultFormData) => void | Promise<void>;
}

export function VehicleFaultAddDialog({ open, onOpenChange, onSubmit }: VehicleFaultAddDialogProps) {
  const [formData, setFormData] = useState({
    vehicle: '' as VehicleType,
    shortDescription: '',
    longDescription: '',
    notes: '',
    eamRequestNumber: '',
    dateReported: new Date().toISOString().split('T')[0],
    dateLogged: '',
    priority: 'medium' as PriorityType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle || !formData.shortDescription || !formData.longDescription || !formData.dateReported) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    await onSubmit({
      vehicle: formData.vehicle,
      shortDescription: formData.shortDescription,
      longDescription: formData.longDescription,
      notes: formData.notes || undefined,
      eamRequestNumber: formData.eamRequestNumber || undefined,
      dateReported: new Date(formData.dateReported).getTime(),
      dateLogged: formData.dateLogged ? new Date(formData.dateLogged).getTime() : undefined,
      priority: formData.priority,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Vehicle Fault</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
            <Select onValueChange={(value) => setFormData({ ...formData, vehicle: value as VehicleType })}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pumper">Pumper</SelectItem>
                <SelectItem value="Tanker">Tanker</SelectItem>
                <SelectItem value="FCV">FCV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateReported">Date Reported *</Label>
              <Input
                id="dateReported"
                type="date"
                value={formData.dateReported}
                onChange={(e) => setFormData({ ...formData, dateReported: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateLogged">Date Logged</Label>
              <Input
                id="dateLogged"
                type="date"
                value={formData.dateLogged}
                onChange={(e) => setFormData({ ...formData, dateLogged: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eamRequestNumber">EAM Request Number</Label>
              <Input
                id="eamRequestNumber"
                value={formData.eamRequestNumber}
                onChange={(e) => setFormData({ ...formData, eamRequestNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as PriorityType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortDescription">Short Description *</Label>
            <Input
              id="shortDescription"
              placeholder="e.g., Air leak, Electrical issue"
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="longDescription">Detailed Description *</Label>
            <Textarea
              id="longDescription"
              placeholder="Provide detailed information about the fault..."
              value={formData.longDescription}
              onChange={(e) => setFormData({ ...formData, longDescription: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              Report Fault
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
