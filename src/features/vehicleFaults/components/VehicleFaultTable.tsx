import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHeader } from "@/components/shared/SortableTableHeader";
import { Id } from "../../../../convex/_generated/dataModel";
import { statusConfig, priorityConfig } from "../types";
import type { VehicleFault } from "../types";
import { formatDate } from "@/lib/dateFormat";

type SortField = "vehicle" | "priority" | "status" | "dateReported" | "reporter" | "shortDescription";
type SortDirection = "asc" | "desc";

interface VehicleFaultTableProps {
  faults: VehicleFault[];
  onFaultClick: (faultId: Id<"vehicleFaults">) => void;
}

export function VehicleFaultTable({ faults, onFaultClick }: VehicleFaultTableProps) {
  const [sortField, setSortField] = useState<SortField>("dateReported");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedFaults = useMemo(() => {
    return [...faults].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "vehicle":
          aValue = a.vehicle;
          bValue = b.vehicle;
          break;
        case "priority": {
          const priorityOrder = { low: 1, medium: 2, high: 3 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        }
        case "status": {
          const statusOrder = { resolved: 1, pending_dmo: 2, pending_wydv: 3 };
          aValue = statusOrder[a.status];
          bValue = statusOrder[b.status];
          break;
        }
        case "dateReported":
          aValue = a.dateReported;
          bValue = b.dateReported;
          break;
        case "reporter":
          aValue = a.reportedByUser?.name || "Unknown";
          bValue = b.reportedByUser?.name || "Unknown";
          break;
        case "shortDescription":
          aValue = a.shortDescription.toLowerCase();
          bValue = b.shortDescription.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [faults, sortField, sortDirection]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHeader field="vehicle" label="Vehicle" currentField={sortField} direction={sortDirection} onSort={handleSort} className="w-[100px]" />
            <SortableTableHeader field="priority" label="Priority" currentField={sortField} direction={sortDirection} onSort={handleSort} className="w-[80px]" />
            <SortableTableHeader field="shortDescription" label="Description" currentField={sortField} direction={sortDirection} onSort={handleSort} className="min-w-[200px]" />
            <SortableTableHeader field="status" label="Status" currentField={sortField} direction={sortDirection} onSort={handleSort} className="w-[160px]" />
            <SortableTableHeader field="dateReported" label="Reported" currentField={sortField} direction={sortDirection} onSort={handleSort} className="w-[100px]" />
            <SortableTableHeader field="reporter" label="Reporter" currentField={sortField} direction={sortDirection} onSort={handleSort} className="w-[120px]" />
            <TableHead className="w-[100px]">EAM #</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFaults.map((fault) => {
            const status = statusConfig[fault.status];
            const priority = priorityConfig[fault.priority];
            const StatusIcon = status.icon;

            return (
              <TableRow
                key={fault._id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onFaultClick(fault._id)}
              >
                <TableCell className="font-medium">{fault.vehicle}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${priority.dotColor}`} />
                    <span className="text-xs font-medium">{priority.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm leading-tight">
                      {fault.shortDescription}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {fault.longDescription}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge className={`${status.color} border text-xs whitespace-nowrap inline-flex items-center`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(fault.dateReported)}
                </TableCell>
                <TableCell className="text-sm">
                  {fault.reportedByUser?.name || "Unknown"}
                </TableCell>
                <TableCell className="text-sm">
                  {fault.eamRequestNumber || "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {faults.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No faults to display
        </div>
      )}
    </div>
  );
}
