import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Clock3, FileClock, Pencil, Plus, RefreshCw, Search, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const actionConfig = {
  hose_created: { label: "Hose created", icon: Plus, className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  hose_updated: { label: "Hose updated", icon: Pencil, className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  hose_replaced: { label: "Hose replaced", icon: RefreshCw, className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  hose_deleted: { label: "Hose deleted", icon: Trash2, className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  status_change: { label: "Status changed", icon: RefreshCw, className: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" },
  size_change: { label: "Size changed", icon: Pencil, className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  length_change: { label: "Length changed", icon: Pencil, className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  type_change: { label: "Type changed", icon: Pencil, className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  test_date_change: { label: "Test date changed", icon: Clock3, className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
} as const;

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && value > 1_000_000_000_000) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value);
  }
  return String(value);
}

function formatField(field: string) {
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function HoseAuditTrail() {
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const recentChanges = useQuery(api.hoseAuditTrail.getRecentChanges, { limit: visibleLimit });

  const filteredChanges = useMemo(() => {
    if (!recentChanges) return [];
    const query = searchTerm.trim().toLocaleLowerCase();
    return recentChanges.filter((entry) => {
      if (actionFilter !== "all" && entry.changeType !== actionFilter) return false;
      if (!query) return true;
      return [
        entry.hoseIdString,
        entry.userName,
        entry.userEmail,
        entry.field,
        entry.changeType,
        entry.notes,
        formatValue(entry.oldValue),
        formatValue(entry.newValue),
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [actionFilter, recentChanges, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <FileClock aria-hidden="true" className="size-6 text-muted-foreground" />
            Audit trail
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Search recent changes across all hose records.</p>
        </div>
        {recentChanges && <Badge variant="secondary">{filteredChanges.length} shown</Badge>}
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="space-y-2">
          <Label htmlFor="audit-search">Search changes</Label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-search"
              name="auditSearch"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Hose ID, user, field, or value…"
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 bg-background pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-action-filter">Change type</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger id="audit-action-filter" className="min-h-11 bg-background">
              <SelectValue placeholder="All changes" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All changes</SelectItem>
                {Object.entries(actionConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>{config.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {recentChanges === undefined ? (
        <div className="space-y-3" aria-label="Loading audit trail">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" />)}
        </div>
      ) : filteredChanges.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileClock aria-hidden="true" className="mx-auto mb-4 size-12 text-muted-foreground/50" />
            <p className="font-medium">No matching changes</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or change type.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredChanges.map((entry) => {
            const config = actionConfig[entry.changeType as keyof typeof actionConfig] ?? {
              label: formatField(entry.changeType),
              icon: Pencil,
              className: "bg-muted text-muted-foreground",
            };
            const ActionIcon = config.icon;
            return (
              <article key={entry._id} className="rounded-lg border bg-card p-4 [content-visibility:auto]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <ActionIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>
                    <span className="font-semibold">{entry.hoseIdString || "Unknown hose"}</span>
                  </div>
                  <time dateTime={new Date(entry.timestamp).toISOString()} className="text-xs text-muted-foreground">
                    {dateFormatter.format(entry.timestamp)}
                  </time>
                </div>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
                  <span className="font-medium text-muted-foreground">{formatField(entry.field)}</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="max-w-full break-words rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{formatValue(entry.oldValue)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                    <span className="max-w-full break-words rounded bg-green-50 px-2 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">{formatValue(entry.newValue)}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <UserRound aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span className="break-all">{entry.userName || entry.userEmail || "Unknown user"}</span>
                </div>
                {entry.notes && <p className="mt-3 break-words rounded-md bg-muted/50 p-2 text-sm">{entry.notes}</p>}
              </article>
            );
          })}
        </div>
      )}

      {recentChanges && recentChanges.length === visibleLimit && visibleLimit < 100 && (
        <div className="text-center">
          <Button type="button" variant="outline" onClick={() => setVisibleLimit((limit) => Math.min(limit + 20, 100))} className="min-h-11 touch-manipulation">
            Load 20 older changes
          </Button>
        </div>
      )}
    </div>
  );
}
