import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { KitValue, kitValuesEqual } from "../types";
import { KitItemControl } from "./KitItemControl";
import { useDirtyDraftGuard } from "./useDirtyDraftGuard";

interface KitSetEditorProps {
  userId: Id<"users">;
  /** `null` when editing a standalone item, which belongs to no set. */
  setId: Id<"memberKitSets"> | null;
  /**
   * Narrows the editor to one item. Standalone items are edited alone, since a
   * pager is its own thing rather than a member of some "individual" group.
   */
  itemId?: Id<"memberKitItems">;
  /** Called on a clean close and after a successful save. */
  onClose: () => void;
}

type Draft = Record<string, KitValue | null>;

/**
 * The only place inputs live: one kit set, or one standalone item, with an
 * explicit Save and a dirty guard on every exit. Replaces the 50-input
 * accordion that committed on blur.
 */
export function KitSetEditor({ userId, setId, itemId, onClose }: KitSetEditorProps) {
  const scope = useQuery(api.memberKit.getKitScopeForEntry, { userId, setId, itemId });
  const saveEntries = useMutation(api.memberKit.setKitEntries);

  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = useMemo(() => {
    const map: Draft = {};
    for (const item of scope?.items ?? []) map[item._id] = null;
    for (const entry of scope?.values ?? []) map[entry.itemId] = entry.value;
    return map;
  }, [scope]);

  const current = (itemId: string): KitValue | null =>
    itemId in draft ? draft[itemId] : (saved[itemId] ?? null);

  const changedIds = useMemo(
    () =>
      Object.keys(draft).filter((itemId) => !kitValuesEqual(draft[itemId], saved[itemId] ?? null)),
    [draft, saved],
  );
  const isDirty = changedIds.length > 0;

  const guard = useDirtyDraftGuard(isDirty, onClose);

  const handleSave = async () => {
    if (!scope || changedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await saveEntries({
        userId,
        setId,
        entries: changedIds.map((itemId) => ({
          itemId: itemId as Id<"memberKitItems">,
          value: draft[itemId],
        })),
      });
      // Release before navigating so the guard doesn't challenge our own exit.
      guard.release();
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div
      className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        onClick={() => {
          if (guard.requestClose()) onClose();
        }}
      >
        Cancel
      </Button>
      <Button
        type="button"
        className="min-h-11 w-full bg-red-700 text-white hover:bg-red-800 sm:w-auto dark:bg-red-600 dark:hover:bg-red-700"
        disabled={!isDirty || saving}
        aria-busy={saving}
        onClick={handleSave}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );

  return (
    <>
      <ResponsiveModal
        open
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title={scope?.title ?? "Kit"}
        footer={footer}
        drawerHeight="h-[85dvh]"
      >
        {scope === undefined ? (
          <div className="space-y-5" aria-label="Loading kit">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : scope === null ? (
          <p className="text-sm text-muted-foreground">This kit no longer exists.</p>
        ) : scope.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to record here yet.</p>
        ) : (
          <div className="space-y-5 pb-4">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {scope.items.map((item) => (
              <div key={item._id} className="space-y-1.5">
                <p className="text-sm font-medium">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
                <KitItemControl
                  item={item}
                  value={current(item._id)}
                  onChange={(value) => setDraft((prev) => ({ ...prev, [item._id]: value }))}
                />
              </div>
            ))}
          </div>
        )}
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description={`${changedIds.length} change${
          changedIds.length === 1 ? "" : "s"
        } have not been saved. Leaving now will lose them.`}
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}
