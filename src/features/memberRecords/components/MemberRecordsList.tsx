import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ChevronRight, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "../../../../convex/_generated/api";
import { formatKitDate } from "./MemberKitHeader";

const PRIORITY_RANKS: Record<string, number> = {
  Captain: 0,
  Lieutenant: 1,
};

function compareMembers(
  a: { name: string; lastName?: string; rank?: string },
  b: { name: string; lastName?: string; rank?: string },
) {
  const rankDifference =
    (PRIORITY_RANKS[a.rank ?? ""] ?? 2) - (PRIORITY_RANKS[b.rank ?? ""] ?? 2);
  if (rankDifference !== 0) return rankDifference;

  return (a.lastName || a.name).localeCompare(b.lastName || b.name, undefined, {
    sensitivity: "base",
  });
}

/** The Members tab: search, then a row per member linking to their profile. */
export function MemberRecordsList() {
  const members = useQuery(api.memberKit.listMembers);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    if (!members) return [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? members.filter(
          (member) =>
            member.name.toLowerCase().includes(query) ||
            (member.memberNumber ?? "").toLowerCase().includes(query),
        )
      : members;

    return [...filtered].sort(compareMembers);
  }, [members, search]);

  if (members === undefined) {
    return (
      <div className="space-y-2" aria-label="Loading members">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name or number"
          aria-label="Search members"
          className="min-h-11 bg-background pl-9"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {visible.length} {visible.length === 1 ? "member" : "members"}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No members match"
          description="Try a different name or member number."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((member) => (
            <li key={member._id}>
              <Link
                to={`/member-records/${member._id}`}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{member.name}</span>
                    {member.rank && (
                      <Badge variant="outline" className="shrink-0 font-normal">
                        {member.rank}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {member.recordUpdatedAt
                      ? `Updated ${formatKitDate(member.recordUpdatedAt)}`
                      : "No details recorded"}
                  </span>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
