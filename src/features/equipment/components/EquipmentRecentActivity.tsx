import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp, Settings, Package } from "lucide-react";

type TransactionType = "take" | "replenish" | "adjustment" | "initial";

const typeFilters: { value: TransactionType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "take", label: "Takes" },
  { value: "replenish", label: "Replenish" },
  { value: "adjustment", label: "Adjustments" },
];

const iconMap: Record<string, React.ReactNode> = {
  take: <ArrowDown className="h-4 w-4 text-red-500" />,
  replenish: <ArrowUp className="h-4 w-4 text-green-500" />,
  adjustment: <Settings className="h-4 w-4 text-blue-500" />,
  initial: <Package className="h-4 w-4 text-purple-500" />,
};

const labelMap: Record<string, string> = {
  take: "Taken",
  replenish: "Added",
  adjustment: "Adjusted",
  initial: "Initial",
};

export function EquipmentRecentActivity() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | null>(null);
  const [limit, setLimit] = useState(25);

  const transactions = useQuery(api.equipment.getRecentTransactions, {
    limit: limit + 1, // fetch one extra to know if there are more
    ...(typeFilter ? { type: typeFilter } : {}),
  });

  const hasMore = transactions && transactions.length > limit;
  const visibleTransactions = transactions?.slice(0, limit);

  if (!transactions) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {typeFilters.map((f) => (
          <button
            key={f.label}
            onClick={() => { setTypeFilter(f.value); setLimit(25); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              typeFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleTransactions && visibleTransactions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>No {typeFilter ? `${typeFilter} ` : ""}activity found</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visibleTransactions?.map((tx) => (
              <div
                key={tx._id}
                className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border"
              >
                <div className="mt-0.5">{iconMap[tx.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{tx.itemName}</span>
                    <Badge
                      variant={tx.type === "take" ? "destructive" : tx.type === "replenish" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {tx.quantity > 0 ? "+" : ""}{tx.quantity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {labelMap[tx.type] || tx.type} by {tx.userName} · {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
                  </p>
                  {tx.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{tx.notes}"</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-medium">{tx.newStock}</span>
                  <p className="text-xs text-muted-foreground">in stock</p>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit(prev => prev + 25)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
