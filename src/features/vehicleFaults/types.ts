import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

// --- Status ---

export type StatusType = "pending_dmo" | "pending_wydv" | "resolved";

export const statusConfig = {
  pending_dmo: {
    label: "Pending - DMO",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    hoverBgColor: "hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
    borderColor: "border-yellow-400 dark:border-yellow-500",
    icon: Clock,
  },
  pending_wydv: {
    label: "Pending - WYDV",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    hoverBgColor: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
    borderColor: "border-blue-400 dark:border-blue-500",
    icon: AlertTriangle,
  },
  resolved: {
    label: "Resolved",
    color: "bg-green-100 text-green-800 border-green-200",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    hoverBgColor: "hover:bg-green-100 dark:hover:bg-green-900/30",
    borderColor: "border-green-400 dark:border-green-500",
    icon: CheckCircle,
  },
} as const;

// --- Priority ---

export type PriorityType = "low" | "medium" | "high";

export const priorityConfig = {
  low: {
    label: "Low",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    dotColor: "bg-gray-400",
  },
  medium: {
    label: "Medium",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    dotColor: "bg-orange-400",
  },
  high: {
    label: "High",
    color: "bg-red-100 text-red-700 border-red-200",
    dotColor: "bg-red-500",
  },
} as const;

// --- Fault type ---

export type VehicleFault = {
  _id: Id<"vehicleFaults">;
  _creationTime: number;
  vehicle: string;
  shortDescription: string;
  longDescription: string;
  status: StatusType;
  priority: PriorityType;
  dateReported: number;
  dateLogged?: number;
  eamRequestNumber?: string;
  reportedByUser?: {
    _id: Id<"users">;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
  updatedByUser?: {
    _id: Id<"users">;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
  notes?: string;
  reportedBy: Id<"users">;
  updatedBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
};

// --- Tab config ---

export const tabConfig = [
  { key: "faults" as const, label: "Faults" },
  { key: "audit" as const, label: "Audit" },
];

export type TabKey = (typeof tabConfig)[number]["key"];

// --- Field name mapping for audit/history ---

export const fieldNameMap: Record<string, string> = {
  dateReported: "Date Reported",
  dateLogged: "Date Logged",
  vehicle: "Vehicle",
  shortDescription: "Short Description",
  longDescription: "Long Description",
  eamRequestNumber: "EAM Request Number",
  priority: "Priority",
  status: "Status",
  notes: "Notes",
  created: "Created",
  deleted: "Deleted",
};
