import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { KitItemRows } from "../features/memberRecords/components/KitRegisterEditor";

interface MemberKitSetPageProps {
  /** The `/kit/new` and `/kit/:setId/edit` name-and-description form. */
  mode?: "view" | "form";
}

function BackToKit() {
  return (
    <Link
      to="/member-records?tab=kit"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      Kit
    </Link>
  );
}

/**
 * A kit set: its name-and-description form, or the list of items inside it.
 * Both are URL-addressable, so browser and Android Back work at every level.
 * That is the whole point of replacing the stacked dialogs.
 */
function MemberKitSetPage({ mode = "view" }: MemberKitSetPageProps) {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();

  const defs = useQuery(api.memberKit.getKitDefinitions, { includeArchived: true });
  const counts = useQuery(api.memberKitAdmin.getItemEntryCounts, {});
  const createSet = useMutation(api.memberKitAdmin.createSet);
  const updateSet = useMutation(api.memberKitAdmin.updateSet);
  const reorderItems = useMutation(api.memberKitAdmin.reorderItems);

  const isNew = setId === undefined;
  const set = defs?.sets.find((candidate) => candidate._id === setId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (set) {
      setName(set.name);
      setDescription(set.description ?? "");
    }
  }, [set]);

  if (mode === "form") {
    const submit = async (event: React.FormEvent) => {
      event.preventDefault();
      setSaving(true);
      setError(null);
      try {
        if (isNew) {
          const created = await createSet({
            name,
            description: description.trim() || undefined,
          });
          navigate(`/member-records/kit/${created}`, { replace: true });
        } else {
          await updateSet({
            setId: setId as Id<"memberKitSets">,
            name,
            description: description.trim() || null,
          });
          navigate(`/member-records/kit/${setId}`, { replace: true });
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save");
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-3" data-component="MemberKitSetForm">
        <BackToKit />
        <h1 className="text-2xl font-bold">{isNew ? "New kit set" : "Edit kit set"}</h1>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="set-name">Name</Label>
            <Input
              id="set-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Structural PPC"
              required
              aria-invalid={error !== null}
              aria-describedby={error ? "set-error" : undefined}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-description">Description</Label>
            <Textarea
              id="set-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Optional: what this set is for"
            />
          </div>
          {error && (
            <p id="set-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => navigate("/member-records?tab=kit")}
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
      </div>
    );
  }

  if (defs === undefined) {
    return (
      <div className="space-y-2" aria-label="Loading kit set">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="space-y-3">
        <BackToKit />
        <p className="text-sm text-muted-foreground">This kit set no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-component="MemberKitSetPage">
      <BackToKit />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{set.name}</h1>
          {set.description && (
            <p className="text-sm text-muted-foreground">{set.description}</p>
          )}
        </div>
        <Button asChild variant="outline" className="min-h-11 shrink-0">
          <Link to={`/member-records/kit/items/new?set=${set._id}`}>
            <Plus className="mr-1 size-4" aria-hidden="true" />
            Add item
          </Link>
        </Button>
      </div>

      {set.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items in this set yet.</p>
      ) : (
        <KitItemRows
          items={set.items}
          allIds={set.items.map((item) => item._id)}
          countFor={(itemId) => counts?.find((c) => c.itemId === itemId)?.count ?? 0}
          onReorder={(ids) =>
            reorderItems({
              setId: set._id,
              itemIds: ids as Id<"memberKitItems">[],
            }).catch((caught: unknown) =>
              toast.error(caught instanceof Error ? caught.message : "Could not reorder"),
            )
          }
          onNavigate={navigate}
        />
      )}
    </div>
  );
}

export default MemberKitSetPage;
