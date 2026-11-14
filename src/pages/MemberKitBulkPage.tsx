import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { KitValue, kitValuesEqual } from "../features/memberRecords/types";
import { KitItemControl } from "../features/memberRecords/components/KitItemControl";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";

type Draft = Record<string, KitValue | null>;

/**
 * "Fill in for all members" for one item. Drafts live in a keyed map outside the
 * rows so they survive scrolling and filtering, and nothing is saved on blur:
 * one explicit Save at the end.
 */
function MemberKitBulkPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const data = useQuery(api.memberKit.getItemEntriesForAllMembers, {
    itemId: itemId as Id<"memberKitItems">,
  });
  const saveEntries = useMutation(api.memberKit.setKitItemEntries);

  const [draft, setDraft] = useState<Draft>({});
  const [search, setSearch] = useState("");
  const [unrecordedOnly, setUnrecordedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = data?.item.setId
    ? `/member-records/kit/${data.item.setId}`
    : "/member-records?tab=kit";

  const saved = useMemo(() => {
    const map: Draft = {};
    for (const member of data?.members ?? []) map[member.userId] = member.value ?? null;
    return map;
  }, [data]);

  const changedIds = useMemo(
    () =>
      Object.keys(draft).filter((userId) => !kitValuesEqual(draft[userId], saved[userId] ?? null)),
    [draft, saved],
  );

  const guard = useDirtyDraftGuard(changedIds.length > 0, () => navigate(back));

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.members ?? []).filter((member) => {
      if (query && !member.name.toLowerCase().includes(query)) return false;
      // Filter on the saved value, so typing a draft doesn't make a row vanish.
      if (unrecordedOnly && (saved[member.userId] ?? null) !== null) return false;
      return true;
    });
  }, [data, search, unrecordedOnly, saved]);

  if (data === undefined) {
    return (
      <div className="space-y-2" aria-label="Loading members">
        <Skeleton className="h-8 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (data === null) {
    return <p className="text-sm text-muted-foreground">This item no longer exists.</p>;
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveEntries({
        itemId: data.item._id,
        entries: changedIds.map((userId) => ({
          userId: userId as Id<"users">,
          value: draft[userId],
        })),
      });
      guard.release();
      toast.success(`Saved ${changedIds.length} change${changedIds.length === 1 ? "" : "s"}`);
      setDraft({});
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pb-28" data-component="MemberKitBulkPage">
      <Link
        to={back}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{data.item.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.setName ? `${data.setName} · ` : ""}Fill in for all members
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="min-h-11 bg-background pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="unrecorded-only"
          checked={unrecordedOnly}
          onCheckedChange={setUnrecordedOnly}
        />
        <Label htmlFor="unrecorded-only" className="text-sm">
          Not recorded only
        </Label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="space-y-2" style={{ contentVisibility: "auto", containIntrinsicSize: "120px" }}>
        {visible.map((member) => {
          const value =
            member.userId in draft ? draft[member.userId] : (saved[member.userId] ?? null);
          return (
            <li
              key={member.userId}
              className="space-y-2 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <p className="truncate text-sm font-medium">{member.name}</p>
              <KitItemControl
                item={data.item}
                value={value}
                onChange={(next) => setDraft((prev) => ({ ...prev, [member.userId]: next }))}
                compact
              />
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No members match.</p>
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background p-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-3xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => {
              if (guard.requestClose()) navigate(back);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={changedIds.length === 0 || saving}
            aria-busy={saving}
            className="min-h-11 w-full bg-red-700 text-white hover:bg-red-800 sm:w-auto dark:bg-red-600 dark:hover:bg-red-700"
            onClick={handleSave}
          >
            {saving
              ? "Saving…"
              : `Save ${changedIds.length} change${changedIds.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        tone="destructive"
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description={`${changedIds.length} change${
          changedIds.length === 1 ? "" : "s"
        } have not been saved. Leaving now will lose them.`}
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </div>
  );
}

export default MemberKitBulkPage;
