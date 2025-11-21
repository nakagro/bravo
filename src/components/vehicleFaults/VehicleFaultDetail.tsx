import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as ConfirmDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as ConfirmDialogHeader,
  AlertDialogTitle as ConfirmDialogTitle,
} from '../ui/alert-dialog';
import {
  ArrowLeft,
  Edit,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  X,
  Save,
  Trash2,
  Settings,
  MessageSquare,
  Truck
} from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { Id } from '../../../convex/_generated/dataModel';
import { VehicleFaultComments } from './VehicleFaultComments';

type VehicleType = 'Pumper' | 'Tanker' | 'FCV';
type StatusType = 'pending_dmo' | 'pending_wydv' | 'resolved';
type PriorityType = 'low' | 'medium' | 'high';

const statusConfig = {
  pending_dmo: {
    label: 'Pending - DMO',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    hoverBgColor: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
    borderColor: 'border-yellow-400 dark:border-yellow-500',
    icon: Clock,
  },
  pending_wydv: {
    label: 'Pending - WYDV',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    hoverBgColor: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
    borderColor: 'border-blue-400 dark:border-blue-500',
    icon: AlertTriangle,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-800 border-green-200',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    hoverBgColor: 'hover:bg-green-100 dark:hover:bg-green-900/30',
    borderColor: 'border-green-400 dark:border-green-500',
    icon: CheckCircle,
  },
};

const priorityConfig = {
  low: {
    label: 'Low',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dotColor: 'bg-gray-400',
  },
  medium: {
    label: 'Medium',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-400',
  },
  high: {
    label: 'High',
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
  },
} as const;


interface VehicleFaultDetailProps {
  faultId: Id<'vehicleFaults'>;
  onClose: () => void;
  onUpdate?: () => void;
}

export function VehicleFaultDetail({ faultId, onClose, onUpdate }: VehicleFaultDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editData, setEditData] = useState<{
    vehicle: VehicleType;
    shortDescription: string;
    longDescription: string;
    eamRequestNumber: string;
    status: StatusType;
    priority: PriorityType;
    notes: string;
    dateLogged?: number;
  } | null>(null);

  const fault = useQuery(api.vehicleFaults.getVehicleFault, { faultId });
  const updateFault = useMutation(api.vehicleFaults.updateVehicleFault);
  const deleteFault = useMutation(api.vehicleFaults.deleteVehicleFault);
  const currentUser = useQuery(api.auth.loggedInUser);

  const isAdmin = currentUser?.isAdmin;

  React.useEffect(() => {
    if (fault && !editData) {
      setEditData({
        vehicle: fault.vehicle,
        shortDescription: fault.shortDescription,
        longDescription: fault.longDescription,
        eamRequestNumber: fault.eamRequestNumber || '',
        status: fault.status,
        priority: fault.priority,
        notes: fault.notes || '',
        dateLogged: fault.dateLogged,
      });
    }
  }, [fault, editData]);

  const handleSave = async () => {
    if (!editData || !fault) return;

    try {
      const updatePayload: any = {
        faultId: fault._id,
        vehicle: editData.vehicle,
        shortDescription: editData.shortDescription,
        longDescription: editData.longDescription,
        eamRequestNumber: editData.eamRequestNumber || undefined,
        status: editData.status,
        priority: editData.priority,
        notes: editData.notes || undefined,
      };

      // If status is being changed to 'pending_wydv' and no dateLogged exists, set it
      if (editData.status === 'pending_wydv' && !fault.dateLogged) {
        updatePayload.dateLogged = Date.now();
      }

      await updateFault(updatePayload);

      toast({
        title: "Fault Updated",
        description: "Vehicle fault has been successfully updated.",
      });

      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update vehicle fault. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!fault || !isAdmin) return;
    try {
      await deleteFault({ faultId: fault._id });
      toast({
        title: "Fault Deleted",
        description: "Vehicle fault has been successfully deleted.",
      });
      setIsDeleteOpen(false);
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete vehicle fault. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!fault || !editData) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
            <DialogDescription>Loading vehicle fault details</DialogDescription>
          </DialogHeader>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const StatusIcon = statusConfig[fault.status].icon;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent hideClose className="sm:max-w-5xl max-h-[95vh] overflow-y-auto p-4">
        {/* Compact Header */}
        <DialogHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1 h-8 w-8 rounded-full"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-muted rounded">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">{fault.vehicle}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">Vehicle Fault Report</DialogDescription>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteOpen(true)}
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isEditing ? (
          /* Edit Mode - Compact Form Layout */
          <div className="space-y-4">
            {/* Basic Information - Condensed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-vehicle" className="text-sm">Vehicle</Label>
                    <Select
                      value={editData.vehicle}
                      onValueChange={(value) => setEditData({ ...editData, vehicle: value as VehicleType })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pumper">Pumper</SelectItem>
                        <SelectItem value="Tanker">Tanker</SelectItem>
                        <SelectItem value="FCV">FCV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-status" className="text-sm">Status</Label>
                    <Select
                      value={editData.status}
                      onValueChange={(value) => setEditData({ ...editData, status: value as StatusType })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([status, config]) => (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-priority" className="text-sm">Priority</Label>
                    <Select
                      value={editData.priority}
                      onValueChange={(value) => setEditData({ ...editData, priority: value as PriorityType })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityConfig).map(([priority, config]) => (
                          <SelectItem key={priority} value={priority}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-eam" className="text-sm">EAM Request</Label>
                    <Input
                      id="edit-eam"
                      className="h-9"
                      value={editData.eamRequestNumber}
                      onChange={(e) => setEditData({ ...editData, eamRequestNumber: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Descriptions - Side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Fault Description
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-short" className="text-sm">Short Description</Label>
                    <Input
                      id="edit-short"
                      className="h-9"
                      value={editData.shortDescription}
                      onChange={(e) => setEditData({ ...editData, shortDescription: e.target.value })}
                      placeholder="Brief summary"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-long" className="text-sm">Detailed Description</Label>
                    <Textarea
                      id="edit-long"
                      value={editData.longDescription}
                      onChange={(e) => setEditData({ ...editData, longDescription: e.target.value })}
                      rows={4}
                      placeholder="Detailed information about the fault..."
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Additional Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <Label htmlFor="edit-notes" className="text-sm">Notes</Label>
                    <Textarea
                      id="edit-notes"
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      rows={6}
                      placeholder="Additional notes, updates, or maintenance history..."
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1 gap-2 h-9">
                <Save className="h-3 w-3" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    vehicle: fault.vehicle,
                    shortDescription: fault.shortDescription,
                    longDescription: fault.longDescription,
                    eamRequestNumber: fault.eamRequestNumber || '',
                    status: fault.status,
                    priority: fault.priority,
                    notes: fault.notes || '',
                    dateLogged: fault.dateLogged,
                  });
                }}
                className="flex-1 h-9"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode - Compact Information Display */
          <div className="space-y-3">
            {/* Status Overview - Compact */}
            <div className={`p-4 border-l-4 rounded-r-md transition-colors ${statusConfig[fault.status].bgColor} ${statusConfig[fault.status].borderColor}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge className={`${statusConfig[fault.status].color} border text-sm px-2 py-1 hover:bg-transparent pointer-events-none`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig[fault.status].label}
                  </Badge>
                  <Badge className={`${priorityConfig[fault.priority].color} border text-sm px-2 py-1 hover:bg-transparent pointer-events-none`}>
                    {priorityConfig[fault.priority].label} Priority
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Reported {new Date(fault.dateReported).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                    year: '2-digit'
                  })}
                </div>
              </div>
            </div>

            {/* Two-column layout for better space usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Report Details - Compact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Report Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span className="font-medium">Reported by:</span>
                    <span className="text-muted-foreground">
                      {fault.reportedByUser?.firstName} {fault.reportedByUser?.lastName}
                    </span>
                  </div>

                  {fault.dateLogged && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span className="font-medium">Logged:</span>
                      <span className="text-muted-foreground">
                        {new Date(fault.dateLogged).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit'
                        })}
                      </span>
                    </div>
                  )}

                  {fault.updatedAt !== fault.createdAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      <span className="font-medium">Updated:</span>
                      <span className="text-muted-foreground">
                        {new Date(fault.updatedAt).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit'
                        })}
                      </span>
                    </div>
                  )}

                  {fault.eamRequestNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">EAM:</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {fault.eamRequestNumber}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fault Description - Compact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Fault Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium text-sm mb-1">Summary</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{fault.shortDescription}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Full-width detailed description */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Detailed Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {fault.longDescription}
                </p>
              </CardContent>
            </Card>

            {/* Notes - Only if present */}
            {fault.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Additional Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {fault.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Comments Section */}
            <VehicleFaultComments faultId={fault._id} />
          </div>
        )}
      </DialogContent>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <ConfirmDialogContent>
          <ConfirmDialogHeader>
            <ConfirmDialogTitle>Delete fault?</ConfirmDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this vehicle fault.
            </AlertDialogDescription>
          </ConfirmDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </ConfirmDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
