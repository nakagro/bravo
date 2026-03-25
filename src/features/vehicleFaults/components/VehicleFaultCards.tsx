import { Badge } from "@/components/ui/badge";
import { Id } from "../../../../convex/_generated/dataModel";
import { statusConfig, priorityConfig } from "../types";
import type { VehicleFault } from "../types";

interface VehicleFaultCardsProps {
  faults: VehicleFault[];
  onFaultClick: (faultId: Id<"vehicleFaults">) => void;
}

export function VehicleFaultCards({ faults, onFaultClick }: VehicleFaultCardsProps) {
  if (!faults || faults.length === 0) return null;

  return (
    <div className="space-y-3">
      {faults.map((fault) => {
        const status = statusConfig[fault.status];
        const priority = priorityConfig[fault.priority];
        const StatusIcon = status.icon;

        return (
          <div
            key={fault._id}
            className={`p-4 border-l-4 rounded-r-md cursor-pointer transition-colors ${status.bgColor} ${status.hoverBgColor} ${status.borderColor}`}
            onClick={() => onFaultClick(fault._id)}
          >
            <div className="space-y-2">
              {/* Header with vehicle and status */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base text-gray-900 dark:text-white">
                    {fault.vehicle}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${priority.dotColor}`} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {priority.label}
                    </span>
                  </div>
                </div>
                <Badge className={`${status.color} border text-xs px-2 py-0.5 flex-shrink-0 hover:bg-transparent pointer-events-none`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h3 className="font-medium text-sm leading-tight text-gray-900 dark:text-white">
                  {fault.shortDescription}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                  {fault.longDescription}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                <span>{new Date(fault.dateReported).toLocaleDateString()}</span>
                <span>{fault.reportedByUser?.name || "Unknown"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
