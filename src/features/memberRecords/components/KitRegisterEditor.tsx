import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronRight, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { KIT_TRACKS_LABELS, KitItemDef, KitSetDef } from "../types";
import { KitSortableList, movedIds } from "./KitSortableList";

/**
 * The Kit tab. Two sections, kit sets and the standalone items, so an officer
 * is never pushed into inventing a one-item set to record a pager. They reorder
 * independently and never merge into each other.
 */
export function KitRegisterEditor() {
  const defs = useQuery(api.memberKit.getKitDefinitions, { includeArchived: true });
  const counts = useQuery(api.memberKitAdmin.getItemEntryCounts, {});

  const reorderSets = useMutation(api.memberKitAdmin.reorderSets);
  const reorderItems = useMutation(api.memberKitAdmin.reorderItems);
  const deleteSet = useMutation(api.memberKitAdmin.deleteSet);

  const [pendingDelete, setPendingDelete] = useState<KitSetDef | null>(null);
  const navigate = useNavigate();

  const countFor = (itemId: string) =>
    counts?.find((entry) => entry.itemId === itemId)?.count ?? 0;

  if (defs === undefined) {
    return (
      <div className="space-y-2" aria-label="Loading kit register">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const run = (promise: Promise<unknown>) =>
    promise.catch((error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Something went wrong"),
    );

  const setIds = defs.sets.map((set) => set._id);
  const looseIds = defs.standalone.map((item) => item._id);

  const deleteDescription = (set: KitSetDef) => {
    const entries = set.items.reduce((sum, item) => sum + countFor(item._id), 0);
    return `"${set.name}" and its ${set.items.length} item(s) will be deleted, along with ${entries} recorded entr${
      entries === 1 ? "y" : "ies"
    }. To keep an item, use "Move to…" on it first to make it an individual item.`;
  };

  return (
    <div className="space-y-6" data-component="KitRegisterEditor">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Kit sets</h2>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/member-records/kit/new">
              <Plus className="mr-1 size-4" aria-hidden="true" />
              Add kit set
            </Link>
          </Button>
        </div>

        {defs.sets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No kit sets yet.</p>
        ) : (
          <KitSortableList
            items={defs.sets}
            getId={(set) => set._id}
            getLabel={(set) => set.name}
            onReorder={(ids) =>
              run(reorderSets({ setIds: ids as Id<"memberKitSets">[] }))
            }
            renderRow={(set) => (
              <Link
                to={`/member-records/kit/${set._id}`}
                className="flex min-h-11 items-center gap-2 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{set.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {set.items.length} {set.items.length === 1 ? "item" : "items"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            )}
            renderActions={(set, index, total) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-11 shrink-0">
                    <MoreVertical className="size-4" aria-hidden="true" />
                    <span className="sr-only">Actions for {set.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/member-records/kit/${set._id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === 0}
                    onSelect={() =>
                      run(
                        reorderSets({
                          setIds: movedIds(setIds, index, -1) as Id<"memberKitSets">[],
                        }),
                      )
                    }
                  >
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === total - 1}
                    onSelect={() =>
                      run(
                        reorderSets({
                          setIds: movedIds(setIds, index, 1) as Id<"memberKitSets">[],
                        }),
                      )
                    }
                  >
                    Move down
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => setPendingDelete(set)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Individual items</h2>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/member-records/kit/items/new">
              <Plus className="mr-1 size-4" aria-hidden="true" />
              Add item
            </Link>
          </Button>
        </div>

        {defs.standalone.length === 0 ? (
          <p className="text-sm text-muted-foreground">No individual items yet.</p>
        ) : (
          <KitItemRows
            items={defs.standalone}
            allIds={looseIds}
            countFor={countFor}
            onReorder={(ids) =>
              run(reorderItems({ setId: null, itemIds: ids as Id<"memberKitItems">[] }))
            }
            onNavigate={navigate}
          />
        )}
      </section>

      <ConfirmDialog
        confirmLabel="Delete"
        tone="destructive"
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "kit set"}?`}
        description={pendingDelete ? deleteDescription(pendingDelete) : ""}
        onConfirm={() => {
          if (!pendingDelete) return;
          const setId = pendingDelete._id;
          setPendingDelete(null);
          run(deleteSet({ setId }));
        }}
      />
    </div>
  );
}

interface KitItemRowsProps {
  items: KitItemDef[];
  allIds: string[];
  countFor: (itemId: string) => number;
  onReorder: (ids: string[]) => void;
  onNavigate: (to: string) => void;
}

/**
 * The two-line item row shared by the Kit tab's standalone section and the set
 * page: name plus type badge on one line, a short secondary line, one overflow
 * menu. This replaces the old row that crammed every option and chart name in.
 */
export function KitItemRows({
  items,
  allIds,
  countFor,
  onReorder,
  onNavigate,
}: KitItemRowsProps) {
  const updateItem = useMutation(api.memberKitAdmin.updateItem);
  const deleteItem = useMutation(api.memberKitAdmin.deleteItem);
  const moveItem = useMutation(api.memberKitAdmin.moveItem);
  const defs = useQuery(api.memberKit.getKitDefinitions, {});

  const [pendingDelete, setPendingDelete] = useState<KitItemDef | null>(null);
  const [movingItem, setMovingItem] = useState<KitItemDef | null>(null);

  const run = (promise: Promise<unknown>) =>
    promise.catch((error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Something went wrong"),
    );

  const secondary = (item: KitItemDef) => {
    const parts = [KIT_TRACKS_LABELS[item.tracks]];
    const count = countFor(item._id);
    if (count > 0) parts.push(`${count} recorded`);
    if (item.isArchived) parts.push("Archived");
    return parts.join(" · ");
  };

  return (
    <>
      <KitSortableList
        items={items}
        getId={(item) => item._id}
        getLabel={(item) => item.name}
        onReorder={onReorder}
        renderRow={(item) => (
          <Link
            to={`/member-records/kit/items/${item._id}`}
            className="flex min-h-11 items-center gap-2 rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate font-medium ${
                  item.isArchived ? "text-muted-foreground" : ""
                }`}
              >
                {item.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {secondary(item)}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
        renderActions={(item, index, total) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 shrink-0">
                <MoreVertical className="size-4" aria-hidden="true" />
                <span className="sr-only">Actions for {item.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onNavigate(`/member-records/kit/items/${item._id}`)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={item.isArchived}
                onSelect={() => onNavigate(`/member-records/kit/items/${item._id}/all`)}
              >
                Fill in for all members
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMovingItem(item)}>Move to…</DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === 0}
                onSelect={() => onReorder(movedIds(allIds, index, -1))}
              >
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === total - 1}
                onSelect={() => onReorder(movedIds(allIds, index, 1))}
              >
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(updateItem({ itemId: item._id, isArchived: !item.isArchived }))
                }
              >
                {item.isArchived ? "Restore" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setPendingDelete(item)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {/* "Belongs to" as one flat list, not a dialog opened from another dialog. */}
      {movingItem && (
        <ResponsiveModal
          open
          onClose={() => setMovingItem(null)}
          title={`Move ${movingItem.name} to…`}
        >
          <ul className="space-y-2 pb-4">
            <li>
              <Button
                variant="outline"
                className="min-h-11 w-full justify-start"
                disabled={movingItem.setId === undefined}
                onClick={() => {
                  run(moveItem({ itemId: movingItem._id, setId: null }));
                  setMovingItem(null);
                }}
              >
                Individual item
              </Button>
            </li>
            {(defs?.sets ?? []).map((set) => (
              <li key={set._id}>
                <Button
                  variant="outline"
                  className="min-h-11 w-full justify-start"
                  disabled={movingItem.setId === set._id}
                  onClick={() => {
                    run(moveItem({ itemId: movingItem._id, setId: set._id }));
                    setMovingItem(null);
                  }}
                >
                  {set.name}
                </Button>
              </li>
            ))}
          </ul>
        </ResponsiveModal>
      )}

      <ConfirmDialog
        confirmLabel="Delete"
        tone="destructive"
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "item"}?`}
        description={
          pendingDelete
            ? `"${pendingDelete.name}" and its ${countFor(
                pendingDelete._id,
              )} recorded entr${countFor(pendingDelete._id) === 1 ? "y" : "ies"} will be deleted. Archive it instead to keep the entries.`
            : ""
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          const itemId = pendingDelete._id;
          setPendingDelete(null);
          run(deleteItem({ itemId }));
        }}
      />
    </>
  );
}
