import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronLeft, MoreVertical, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { KIT_TRACKS, KitSizeChart, KitTracks, generateSizeRange } from "../features/memberRecords/types";
import { KitSortableList, movedIds } from "../features/memberRecords/components/KitSortableList";

const NO_SET = "__standalone__";

function reportError(caught: unknown) {
  toast.error(caught instanceof Error ? caught.message : "Something went wrong");
}

/**
 * One item, everything about it on one screen: details, where it belongs, and,
 * for sized items, its size charts inline. This replaces `FieldDialog` handing
 * off to `BrandsDialog` handing off to its own internal list/form mode.
 */
function MemberKitItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = itemId === undefined || itemId === "new";
  const defs = useQuery(api.memberKit.getKitDefinitions, { includeArchived: true });
  const counts = useQuery(api.memberKitAdmin.getItemEntryCounts, {});

  const createItem = useMutation(api.memberKitAdmin.createItem);
  const updateItem = useMutation(api.memberKitAdmin.updateItem);
  const deleteItem = useMutation(api.memberKitAdmin.deleteItem);
  const moveItem = useMutation(api.memberKitAdmin.moveItem);

  const allItems = [...(defs?.sets.flatMap((set) => set.items) ?? []), ...(defs?.standalone ?? [])];
  const item = isNew ? undefined : allItems.find((candidate) => candidate._id === itemId);

  const recordedCount = counts?.find((entry) => entry.itemId === itemId)?.count ?? 0;
  const typeLocked = recordedCount > 0;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tracks, setTracks] = useState<KitTracks>("size");
  const [options, setOptions] = useState<string[]>([]);
  const [belongsTo, setBelongsTo] = useState<string>(searchParams.get("set") ?? NO_SET);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setDescription(item.description ?? "");
    setTracks(item.tracks);
    setOptions(item.options ?? []);
    setBelongsTo(item.setId ?? NO_SET);
  }, [item]);

  if (!isNew && defs === undefined) {
    return (
      <div className="space-y-2" aria-label="Loading item">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const back = item?.setId
    ? `/member-records/kit/${item.setId}`
    : "/member-records?tab=kit";

  if (!isNew && !item) {
    return (
      <div className="space-y-3">
        <Link to="/member-records?tab=kit" className="text-sm text-muted-foreground">
          Kit
        </Link>
        <p className="text-sm text-muted-foreground">This item no longer exists.</p>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const setId = belongsTo === NO_SET ? undefined : (belongsTo as Id<"memberKitSets">);
      if (isNew) {
        const created = await createItem({
          setId,
          name,
          tracks,
          description: description.trim() || undefined,
          options: tracks === "choice" ? options : undefined,
        });
        navigate(`/member-records/kit/items/${created}`, { replace: true });
      } else {
        await updateItem({
          itemId: item!._id,
          name,
          description: description.trim() || null,
          tracks: typeLocked ? undefined : tracks,
          options: tracks === "choice" ? options : undefined,
        });
        // Scope changes go through moveItem, which resequences both sides.
        if ((item!.setId ?? NO_SET) !== belongsTo) {
          await moveItem({
            itemId: item!._id,
            setId: belongsTo === NO_SET ? null : (belongsTo as Id<"memberKitSets">),
          });
        }
        toast.success("Item saved");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-component="MemberKitItemPage">
      <Link
        to={back}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Link>

      <h1 className="text-2xl font-bold">{isNew ? "New item" : item!.name}</h1>

      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-base font-semibold">Details</h2>

        <div className="space-y-1.5">
          <Label htmlFor="item-name">Name</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jacket"
            required
            className="min-h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-description">Description</Label>
          <Textarea
            id="item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Optional: helper text shown under the control"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-belongs">Belongs to</Label>
          <Select value={belongsTo} onValueChange={setBelongsTo}>
            <SelectTrigger id="item-belongs" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SET}>Individual item</SelectItem>
              {(defs?.sets ?? []).map((set) => (
                <SelectItem key={set._id} value={set._id}>
                  {set.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-tracks">Tracks</Label>
          <Select
            value={tracks}
            onValueChange={(next) => setTracks(next as KitTracks)}
            disabled={typeLocked}
          >
            <SelectTrigger id="item-tracks" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIT_TRACKS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {typeLocked
              ? `${recordedCount} value(s) are recorded, so this cannot change. Archive this item and add a new one instead.`
              : KIT_TRACKS.find((option) => option.value === tracks)?.hint}
          </p>
        </div>

        {tracks === "choice" && <OptionsEditor options={options} onChange={setOptions} />}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => navigate(back)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || name.trim() === ""}
            aria-busy={saving}
            className="min-h-11 w-full bg-red-700 text-white hover:bg-red-800 sm:w-auto dark:bg-red-600 dark:hover:bg-red-700"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      {/* Size charts belong on this screen, not behind another dialog. */}
      {!isNew && item!.tracks === "size" && (
        <SizeChartsSection itemId={item!._id} charts={item!.charts} />
      )}

      {!isNew && (
        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-base font-semibold">Danger zone</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                updateItem({ itemId: item!._id, isArchived: !item!.isArchived }).catch(
                  reportError,
                )
              }
            >
              {item!.isArchived ? "Restore item" : "Archive item"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete item
            </Button>
          </div>
          <DeleteConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={`Delete ${item!.name}?`}
            description={`"${item!.name}" and its ${recordedCount} recorded entr${
              recordedCount === 1 ? "y" : "ies"
            } will be deleted. Archive it instead to keep the entries.`}
            onConfirm={() => {
              setConfirmDelete(false);
              deleteItem({ itemId: item!._id })
                .then(() => navigate(back))
                .catch(reportError);
            }}
          />
        </section>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed || options.includes(trimmed)) return;
    onChange([...options, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="item-option">Options</Label>
      <div className="flex gap-2">
        <Input
          id="item-option"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add an option"
          className="min-h-11"
        />
        <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={add}>
          Add
        </Button>
      </div>
      {options.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {options.map((option) => (
            <li
              key={option}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-sm"
            >
              {option}
              <button
                type="button"
                aria-label={`Remove ${option}`}
                onClick={() => onChange(options.filter((entry) => entry !== option))}
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SizeChartsSection({
  itemId,
  charts,
}: {
  itemId: Id<"memberKitItems">;
  charts: KitSizeChart[];
}) {
  const createChart = useMutation(api.memberKitAdmin.createChart);
  const updateChart = useMutation(api.memberKitAdmin.updateChart);
  const deleteChart = useMutation(api.memberKitAdmin.deleteChart);
  const reorderCharts = useMutation(api.memberKitAdmin.reorderCharts);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<KitSizeChart | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KitSizeChart | null>(null);

  const chartIds = charts.map((chart) => chart._id);

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Size charts</h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
        >
          <Plus className="mr-1 size-4" aria-hidden="true" />
          Add chart
        </Button>
      </div>

      {charts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No size charts yet. A sized item needs at least one before it can be recorded.
        </p>
      ) : (
        <KitSortableList
          items={charts}
          getId={(chart) => chart._id}
          getLabel={(chart) => chart.name}
          onReorder={(ids) =>
            reorderCharts({
              itemId,
              chartIds: ids as Id<"memberKitSizeCharts">[],
            }).catch(reportError)
          }
          renderRow={(chart) => (
            <div className="min-w-0 px-1 py-1">
              <p className="truncate font-medium">{chart.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {chart.sizes.length} sizes · {chart.sizes.join(", ")}
              </p>
            </div>
          )}
          renderActions={(chart, index, total) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0">
                  <MoreVertical className="size-4" aria-hidden="true" />
                  <span className="sr-only">Actions for {chart.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setAdding(false);
                    setEditing(chart);
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === 0}
                  onSelect={() =>
                    reorderCharts({
                      itemId,
                      chartIds: movedIds(chartIds, index, -1) as Id<"memberKitSizeCharts">[],
                    }).catch(reportError)
                  }
                >
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === total - 1}
                  onSelect={() =>
                    reorderCharts({
                      itemId,
                      chartIds: movedIds(chartIds, index, 1) as Id<"memberKitSizeCharts">[],
                    }).catch(reportError)
                  }
                >
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => setPendingDelete(chart)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      )}

      {(adding || editing) && (
        <ChartForm
          key={editing?._id ?? "new"}
          chart={editing}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSubmit={async (name, sizes) => {
            if (editing) await updateChart({ chartId: editing._id, name, sizes });
            else await createChart({ itemId, name, sizes });
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "chart"}?`}
        description="Members recorded against this chart will have their size cleared. The change is kept in their history."
        onConfirm={() => {
          if (!pendingDelete) return;
          const chartId = pendingDelete._id;
          setPendingDelete(null);
          deleteChart({ chartId }).catch(reportError);
        }}
      />
    </section>
  );
}

function ChartForm({
  chart,
  onCancel,
  onSubmit,
}: {
  chart: KitSizeChart | null;
  onCancel: () => void;
  onSubmit: (name: string, sizes: string[]) => Promise<void>;
}) {
  const [name, setName] = useState(chart?.name ?? "");
  const [sizes, setSizes] = useState<string[]>(chart?.sizes ?? []);
  const [sizeDraft, setSizeDraft] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [step, setStep] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSize = () => {
    const trimmed = sizeDraft.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    setSizes([...sizes, trimmed]);
    setSizeDraft("");
  };

  const generate = () => {
    const generated = generateSizeRange(Number(from), Number(to), Number(step));
    if (generated.length === 0) {
      setError("That range doesn't produce any sizes. Check from, to and step.");
      return;
    }
    setError(null);
    setSizes([...new Set([...sizes, ...generated])]);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <h3 className="text-sm font-semibold">{chart ? `Edit ${chart.name}` : "New size chart"}</h3>

      <div className="space-y-1.5">
        <Label htmlFor="chart-name">Brand or model</Label>
        <Input
          id="chart-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Stewart &amp; Heaton"
          className="min-h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="chart-size">Sizes</Label>
        <div className="flex gap-2">
          <Input
            id="chart-size"
            value={sizeDraft}
            onChange={(event) => setSizeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSize();
              }
            }}
            placeholder="Add a size"
            className="min-h-11"
          />
          <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={addSize}>
            Add
          </Button>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-muted-foreground">
          Or generate a numeric range
        </legend>
        <div className="flex flex-wrap gap-2">
          <Input
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            inputMode="decimal"
            placeholder="From"
            aria-label="Range from"
            className="min-h-11 w-24"
          />
          <Input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            inputMode="decimal"
            placeholder="To"
            aria-label="Range to"
            className="min-h-11 w-24"
          />
          <Input
            value={step}
            onChange={(event) => setStep(event.target.value)}
            inputMode="decimal"
            placeholder="Step"
            aria-label="Range step"
            className="min-h-11 w-24"
          />
          <Button type="button" variant="outline" className="min-h-11" onClick={generate}>
            Generate
          </Button>
        </div>
      </fieldset>

      {sizes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {sizes.map((size) => (
            <li
              key={size}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-background px-3 text-sm"
            >
              {size}
              <button
                type="button"
                aria-label={`Remove size ${size}`}
                onClick={() => setSizes(sizes.filter((entry) => entry !== size))}
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving || name.trim() === "" || sizes.length === 0}
          aria-busy={saving}
          className="min-h-11 w-full bg-red-700 text-white hover:bg-red-800 sm:w-auto dark:bg-red-600 dark:hover:bg-red-700"
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onSubmit(name, sizes);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not save");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save chart"}
        </Button>
      </div>
    </div>
  );
}

export default MemberKitItemPage;
