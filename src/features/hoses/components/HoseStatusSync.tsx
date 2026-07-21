import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, TriangleAlert } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function statusClass(status: string) {
  if (status === "In date") return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (status === "Due for testing") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

export function HoseStatusSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const hosesNeedingUpdate = useQuery(api.hoseStatusSync.getHosesNeedingStatusUpdate);
  const syncAllStatuses = useMutation(api.hoseStatusSync.syncAllHoseStatuses);

  const handleSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncAllStatuses();
      if (result.updated > 0) {
        toast.success(`Updated ${result.updated} hose${result.updated === 1 ? "" : "s"}`);
      } else {
        toast.info("All hose statuses are already up to date");
      }
    } catch (error) {
      console.error("Error syncing hose statuses:", error);
      toast.error("Failed to sync hose statuses");
    } finally {
      setIsSyncing(false);
    }
  };

  if (hosesNeedingUpdate === undefined) {
    return (
      <Card aria-label="Loading status sync">
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const count = hosesNeedingUpdate.length;

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw aria-hidden="true" className="size-5" />
            Status sync
          </CardTitle>
          <CardDescription>Review date-based status corrections before applying them.</CardDescription>
        </div>

        {count > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="min-h-11 w-full touch-manipulation sm:w-auto">
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Sync {count} {count === 1 ? "hose" : "hoses"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apply {count} status {count === 1 ? "change" : "changes"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This updates each listed hose to the suggested status based on its test date.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSyncing}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSyncAll} disabled={isSyncing}>
                  {isSyncing && <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
                  {isSyncing ? "Syncing…" : "Apply changes"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {count === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto mb-4 size-12 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-medium">All statuses are up to date</h3>
            <p className="mt-2 text-sm text-muted-foreground">No date-based corrections are currently required.</p>
          </div>
        ) : (
          <>
            <Alert>
              <TriangleAlert aria-hidden="true" className="size-4" />
              <AlertTitle>Review required</AlertTitle>
              <AlertDescription>{count} {count === 1 ? "hose has" : "hoses have"} a status that does not match its test date.</AlertDescription>
            </Alert>

            <div className="space-y-3">
              {hosesNeedingUpdate.map((hose) => (
                <div key={hose._id} className="rounded-lg border p-4 [content-visibility:auto]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{hose.hoseId}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock3 aria-hidden="true" className="size-4" />
                        Tested {dateFormatter.format(hose.testDate)} · {hose.daysSinceTest} days ago
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2" aria-label={`Status changes from ${hose.currentStatus} to ${hose.suggestedStatus}`}>
                      <Badge className={cn("text-xs", statusClass(hose.currentStatus))}>{hose.currentStatus}</Badge>
                      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                      <Badge className={cn("text-xs", statusClass(hose.suggestedStatus))}>{hose.suggestedStatus}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Accordion type="single" collapsible>
          <AccordionItem value="rules">
            <AccordionTrigger>How status sync works</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Hoses tested within the last 365 days are marked In date.</li>
                <li>Hoses tested more than 365 days ago are marked Due for testing.</li>
                <li>With district for repair and Condemned remain manually managed.</li>
                <li>Changing a test date can also update its managed status.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
