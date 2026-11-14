import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ArrowDown, ArrowUp, RotateCcw, Package } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface EquipmentItemHistoryProps {
  itemId: Id<"equipmentItems">;
}

const typeConfig = {
  take: { label: "Take", icon: ArrowDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/40" },
  replenish: { label: "Replenish", icon: ArrowUp, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950/40" },
  adjustment: { label: "Adjustment", icon: RotateCcw, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40" },
  initial: { label: "Initial", icon: Package, color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
};

export function EquipmentItemHistory({ itemId }: EquipmentItemHistoryProps) {
  const transactions = useQuery(api.equipment.getItemTransactions, { itemId, limit: 30 });

  if (!transactions) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No transaction history</p>
      </div>
    );
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - ts;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffDays === 1) {
      return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString([], { day: "numeric", month: "short" }) +
      ` ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="space-y-1">
      {transactions.map((tx) => {
        const config = typeConfig[tx.type];
        const Icon = config.icon;
        const sign = tx.type === "take" ? "-" : "+";

        return (
          <div key={tx._id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <div className={`p-1.5 rounded-full ${config.bg} shrink-0 mt-0.5`}>
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {config.label}{" "}
                  <span className={config.color}>
                    {sign}{tx.quantity}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {tx.previousStock} → {tx.newStock}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{tx.userName}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</span>
              </div>
              {tx.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{tx.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
