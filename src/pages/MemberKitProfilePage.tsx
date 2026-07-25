import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  KitCompleteness,
  MemberKitHeader,
  formatKitDate,
} from "../features/memberRecords/components/MemberKitHeader";
import { KitSetCard } from "../features/memberRecords/components/KitSetCard";
import { KitSetEditor } from "../features/memberRecords/components/KitSetEditor";

interface MemberKitProfilePageProps {
  /** Rendered behind the addressable set-editor routes. */
  editing?: boolean;
}

/**
 * A real page rather than a drawer, following `/events/:eventId` and
 * `/inventory/run/:runId`. Reads as a profile with kit cards; the only inputs
 * live in the set editor, which is a nested addressable route on top of it.
 */
function MemberKitProfilePage({ editing = false }: MemberKitProfilePageProps) {
  const { userId, setId } = useParams<{ userId: string; setId: string }>();
  const navigate = useNavigate();

  const memberId = userId as Id<"users">;
  const summary = useQuery(api.memberKit.getMemberKitSummary, { userId: memberId });

  const basePath = `/member-records/${memberId}`;
  // "individual" is the standalone group's slug; a real id addresses a set.
  const editingSetId: Id<"memberKitSets"> | null | undefined = !editing
    ? undefined
    : setId === "individual"
      ? null
      : (setId as Id<"memberKitSets">);

  if (summary === undefined) {
    return (
      <div className="space-y-3" aria-label="Loading member record">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (summary === null) {
    return (
      <EmptyState
        icon={<Package className="size-8 text-red-600 dark:text-red-400" />}
        title="Member not found"
        description="This member may have been removed."
      />
    );
  }

  const hasKit = summary.itemCount > 0;

  return (
    <div className="space-y-3" data-component="MemberKitProfilePage">
      <Link
        to="/member-records"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Member Records
      </Link>

      <MemberKitHeader
        name={summary.member.name}
        memberNumber={summary.member.memberNumber}
        rank={summary.member.rank}
        latestActivity={summary.latestActivity}
      />

      {hasKit && (
        <KitCompleteness recorded={summary.recordedCount} total={summary.itemCount} />
      )}

      {!hasKit ? (
        <EmptyState
          icon={<Package className="size-8 text-red-600 dark:text-red-400" />}
          title="No kit defined yet"
          description="Kit sets and individual items are set up on the Kit tab."
        />
      ) : (
        <>
          {summary.sets.map((set) => (
            <KitSetCard
              key={set.setId}
              title={set.name}
              recorded={set.recordedCount}
              total={set.itemCount}
              entries={set.entries}
              to={`${basePath}/set/${set.setId}`}
            />
          ))}

          {/* Standalone items read as rows in one card, not a card each. */}
          {summary.standalone.itemCount > 0 && (
            <KitSetCard
              title="Individual items"
              recorded={summary.standalone.recordedCount}
              total={summary.standalone.itemCount}
              entries={summary.standalone.entries}
              to={`${basePath}/set/individual`}
            />
          )}
        </>
      )}

      <Link
        to={`${basePath}/history`}
        className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="min-w-0 flex-1">
          <span className="font-medium">Change history</span>
          <span className="block text-xs text-muted-foreground">
            {summary.latestActivity
              ? `Last change ${formatKitDate(summary.latestActivity.changedAt)}`
              : "No changes yet"}
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      {editingSetId !== undefined && (
        <KitSetEditor
          key={setId}
          userId={memberId}
          setId={editingSetId}
          onClose={() => navigate(basePath)}
        />
      )}
    </div>
  );
}

export default MemberKitProfilePage;
