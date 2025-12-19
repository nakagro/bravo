import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp, Settings, Package } from "lucide-react";

export function EquipmentRecentActivity() {
  const transactions = useQuery(api.equipment.getRecentTransactions, { limit: 10 });

  if (!transactions) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>No recent activity</p>
      </div>
    );
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "take":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "replenish":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "adjustment":
        return <Settings className="h-4 w-4 text-blue-500" />;
      case "initial":
        return <Package className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "take":
        return "Taken";
      case "replenish":
        return "Added";
      case "adjustment":
        return "Adjusted";
      case "initial":
        return "Initial";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx._id}
          className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border"
        >
          <div className="mt-0.5">{getTransactionIcon(tx.type)}</div>
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
              {getTransactionLabel(tx.type)} by {tx.userName} · {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
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
  );
}
