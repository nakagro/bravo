import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { type Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { cn } from "@/lib/utils";
import {
  LoaderCircle,
  Palette,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import {
  defaultStripeColor,
  defaultTapeColor,
  getTapeColorStyle,
  type TapeColor,
} from "../types";

type TapeEditor = {
  mode: "add" | "edit";
  year: string;
  color: TapeColor;
};

function TapeSwatch({
  color,
  className = "h-12 w-full",
}: {
  color: TapeColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block shrink-0 rounded-md border border-border shadow-sm",
        className,
      )}
      style={getTapeColorStyle(color)}
      aria-hidden="true"
    />
  );
}

function TapeColorEditor({
  editor,
  onYearChange,
  onColorChange,
  onSubmit,
}: {
  editor: TapeEditor;
  onYearChange: (year: string) => void;
  onColorChange: (color: TapeColor) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isStriped = editor.color.secondary !== undefined;

  return (
    <form
      id="tape-colour-form"
      onSubmit={onSubmit}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Preview</span>
        <TapeSwatch color={editor.color} className="h-20 w-full" />
        <p className="text-sm text-muted-foreground">
          This is how the tape will appear on hose cards and details.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tape-year">Test Year</Label>
        <Input
          id="tape-year"
          name="tapeYear"
          type="number"
          inputMode="numeric"
          autoComplete="off"
          min={1900}
          max={2200}
          required
          value={editor.year}
          disabled={editor.mode === "edit"}
          onChange={(event) => onYearChange(event.target.value)}
          className="h-11 text-base"
        />
        {editor.mode === "edit" ? (
          <p className="text-sm text-muted-foreground">
            Create a new entry to assign tape to a different year.
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Tape Style</legend>
        <ToggleGroup
          type="single"
          value={isStriped ? "striped" : "solid"}
          onValueChange={(style) => {
            if (style === "solid") {
              onColorChange({ primary: editor.color.primary });
            } else if (style === "striped") {
              onColorChange({
                primary: editor.color.primary,
                secondary: editor.color.secondary ?? defaultStripeColor,
              });
            }
          }}
          variant="outline"
          aria-label="Tape style"
          className="grid grid-cols-2"
        >
          <ToggleGroupItem value="solid" className="h-11 touch-manipulation">
            Solid
          </ToggleGroupItem>
          <ToggleGroupItem value="striped" className="h-11 touch-manipulation">
            Striped
          </ToggleGroupItem>
        </ToggleGroup>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Tape Colours</legend>
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="primary-tape-colour">Primary Colour</Label>
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {editor.color.primary}
            </span>
          </div>
          <Input
            id="primary-tape-colour"
            name="primaryTapeColour"
            type="color"
            autoComplete="off"
            value={editor.color.primary}
            onChange={(event) =>
              onColorChange({
                ...editor.color,
                primary: event.target.value,
              })
            }
            className="h-12 w-full cursor-pointer touch-manipulation p-1"
          />
        </div>

        {editor.color.secondary ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="secondary-tape-colour">Stripe Colour</Label>
              <span className="font-mono text-xs uppercase text-muted-foreground">
                {editor.color.secondary}
              </span>
            </div>
            <Input
              id="secondary-tape-colour"
              name="secondaryTapeColour"
              type="color"
              autoComplete="off"
              value={editor.color.secondary}
              onChange={(event) =>
                onColorChange({
                  ...editor.color,
                  secondary: event.target.value,
                })
              }
              className="h-12 w-full cursor-pointer touch-manipulation p-1"
            />
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

export function HoseTapeColors() {
  const mappings = useQuery(api.hoseTapeColors.list);
  const upsert = useMutation(api.hoseTapeColors.upsert);
  const remove = useMutation(api.hoseTapeColors.remove);

  const [editor, setEditor] = useState<TapeEditor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openAddEditor = () => {
    const usedYears = new Set(mappings?.map((mapping) => mapping.year));
    let suggestedYear = new Date().getFullYear();
    while (usedYears.has(suggestedYear)) suggestedYear += 1;

    setEditor({
      mode: "add",
      year: String(suggestedYear),
      color: defaultTapeColor,
    });
  };

  const openEditEditor = (year: number, color: TapeColor) => {
    setEditor({ mode: "edit", year: String(year), color });
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || isSaving) return;

    const year = Number.parseInt(editor.year, 10);
    if (!year || year < 1900 || year > 2200) {
      toast.error("Enter a year between 1900 and 2200");
      return;
    }
    if (
      editor.mode === "add" &&
      mappings?.some((mapping) => mapping.year === year)
    ) {
      toast.error(`${year} already has a tape colour`);
      return;
    }

    setIsSaving(true);
    try {
      await upsert({ year, color: editor.color });
      toast.success(
        editor.mode === "add"
          ? `${year} tape colour added`
          : `${year} tape colour updated`,
      );
      setEditor(null);
    } catch (error) {
      console.error("Error saving tape colour:", error);
      toast.error("Could not save the tape colour. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id: Id<"hoseTapeColors">, year: number) => {
    try {
      await remove({ id });
      toast.success(`Removed the tape colour for ${year}`);
    } catch (error) {
      console.error("Error removing tape colour:", error);
      toast.error("Could not remove the tape colour. Try again.");
    }
  };

  if (!mappings) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 sm:col-span-2 lg:col-span-3" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  return (
    <section
      className="flex flex-col gap-5"
      aria-labelledby="tape-colours-title"
    >
      <Card>
        <CardHeader className="gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg bg-muted p-2.5">
              <Tags className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle>
                <h2 id="tape-colours-title" className="text-pretty text-lg">
                  Test Tape Colours
                </h2>
              </CardTitle>
              <CardDescription className="mt-1 text-pretty">
                Assign the solid or striped electrical tape used for each test
                year.
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={openAddEditor}
            className="h-11 w-full touch-manipulation sm:w-auto"
          >
            <Plus data-icon="inline-start" />
            Add Tape Year
          </Button>
        </CardHeader>
      </Card>

      {mappings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Palette className="size-7" aria-hidden="true" />
            </div>
            <div className="flex max-w-md flex-col gap-1">
              <h3 className="font-semibold">No Tape Years Yet</h3>
              <p className="text-sm text-muted-foreground">
                Add a test year and choose the tape used on hose couplings.
              </p>
            </div>
            <Button onClick={openAddEditor} className="h-11 touch-manipulation">
              <Plus data-icon="inline-start" />
              Add First Tape Year
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mappings.map((mapping) => {
            const pattern = mapping.color.secondary ? "Striped" : "Solid";

            return (
              <Card key={mapping._id} className="overflow-hidden shadow-sm">
                <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-3">
                  <CardTitle>
                    <h3 className="text-xl tabular-nums">{mapping.year}</h3>
                  </CardTitle>
                  <Badge variant="secondary">{pattern}</Badge>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <TapeSwatch color={mapping.color} />
                </CardContent>
                <CardFooter className="gap-2 p-4 pt-0">
                  <Button
                    variant="outline"
                    className="h-10 flex-1 touch-manipulation"
                    onClick={() => openEditEditor(mapping.year, mapping.color)}
                  >
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Button>
                  <DeleteConfirmDialog
                    title={`Remove ${mapping.year} Tape Colour?`}
                    description="Hoses tested in this year will no longer display a tape colour."
                    confirmLabel="Remove Tape Colour"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 touch-manipulation"
                        aria-label={`Remove tape colour for ${mapping.year}`}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    }
                    onConfirm={() =>
                      void handleRemove(mapping._id, mapping.year)
                    }
                  />
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {editor ? (
        <ResponsiveModal
          open
          onClose={() => {
            if (!isSaving) setEditor(null);
          }}
          title={
            editor.mode === "add"
              ? "Add Test Tape Colour"
              : `Edit ${editor.year} Tape Colour`
          }
          drawerHeight="h-[88vh]"
          maxWidth="sm:max-w-md"
          footer={
            <div className="flex gap-3 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 touch-manipulation"
                disabled={isSaving}
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="tape-colour-form"
                className="h-11 flex-1 touch-manipulation"
                disabled={isSaving}
              >
                {isSaving ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {isSaving ? "Saving…" : "Save Tape Colour"}
              </Button>
            </div>
          }
        >
          <TapeColorEditor
            editor={editor}
            onYearChange={(year) =>
              setEditor((current) => (current ? { ...current, year } : current))
            }
            onColorChange={(color) =>
              setEditor((current) =>
                current ? { ...current, color } : current,
              )
            }
            onSubmit={(event) => void handleSave(event)}
          />
        </ResponsiveModal>
      ) : null}
    </section>
  );
}
