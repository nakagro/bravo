import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { KitHistoryList } from "../features/memberRecords/components/KitHistoryList";

/** The profile's "Change history" drill-down. */
function MemberKitHistoryPage() {
  const { userId } = useParams<{ userId: string }>();
  const memberId = userId as Id<"users">;
  const summary = useQuery(api.memberKit.getMemberKitSummary, { userId: memberId });

  return (
    <div className="space-y-3" data-component="MemberKitHistoryPage">
      <Link
        to={`/member-records/${memberId}`}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {summary?.member.name ?? "Back"}
      </Link>

      <h1 className="text-2xl font-bold">Change history</h1>

      <KitHistoryList userId={memberId} />
    </div>
  );
}

export default MemberKitHistoryPage;
