import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Tags, Trash2 } from "lucide-react";
import {
  defaultStripeColor,
  defaultTapeColor,
  getTapeColorStyle,
  TapeColor,
} from "../types";

function TapeSwatch({ color }: { color: TapeColor }) {
  return (
    <span
      className="inline-block h-8 w-20 shrink-0 rounded-sm border border-border shadow-sm"
      style={getTapeColorStyle(color)}
      aria-hidden="true"
    />
  );
}

function TapeColorPicker({
  idPrefix,
  value,
  onValueChange,
}: {
  idPrefix: string;
  value: TapeColor;
  onValueChange: (value: TapeColor) => void;
}) {
  const pattern = value.secondary ? "striped" : "solid";
  const primaryId = `${idPrefix}-primary`;
  const secondaryId = `${idPrefix}-secondary`;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <TapeSwatch color={value} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={primaryId} className="text-xs">
          Primary
        </Label>
        <Input
          id={primaryId}
          type="color"
          value={value.primary}
          onChange={(event) =>
            onValueChange({ ...value, primary: event.target.value })
          }
          className="size-10 cursor-pointer p-1"
        />
      </div>
      {value.secondary ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={secondaryId} className="text-xs">
            Stripe
          </Label>
          <Input
            id={secondaryId}
            type="color"
            value={value.secondary}
            onChange={(event) =>
              onValueChange({ ...value, secondary: event.target.value })
            }
            className="size-10 cursor-pointer p-1"
          />
        </div>
      ) : null}
      <ToggleGroup
        type="single"
        value={pattern}
        onValueChange={(nextPattern) => {
          if (nextPattern === "solid") {
            onValueChange({ primary: value.primary });
          } else if (nextPattern === "striped") {
            onValueChange({
              primary: value.primary,
              secondary: value.secondary ?? defaultStripeColor,
            });
          }
        }}
        variant="outline"
        size="sm"
        aria-label="Tape pattern"
      >
        <ToggleGroupItem value="solid">Solid</ToggleGroupItem>
        <ToggleGroupItem value="striped">Striped</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function HoseTapeColors() {
  const mappings = useQuery(api.hoseTapeColors.list);
  const upsert = useMutation(api.hoseTapeColors.upsert);
  const remove = useMutation(api.hoseTapeColors.remove);

  const currentYear = new Date().getFullYear();
  const [newYear, setNewYear] = useState(String(currentYear));
  const [newColor, setNewColor] = useState<TapeColor>(defaultTapeColor);
  const [isSaving, setIsSaving] = useState(false);

  const handleColorChange = async (year: number, color: TapeColor) => {
    try {
      await upsert({ year, color });
      toast.success(`${year} tape colour updated`);
    } catch (error) {
      console.error("Error updating tape colour:", error);
      toast.error("Failed to update tape colour");
    }
  };

  const handleAdd = async () => {
    const year = parseInt(newYear, 10);
    if (!year || year < 1900 || year > 2200) {
      toast.error("Enter a valid year");
      return;
    }
    if (mappings?.some((mapping) => mapping.year === year)) {
      toast.error(`${year} already has a tape colour set`);
      return;
    }

    setIsSaving(true);
    try {
      await upsert({ year, color: newColor });
      toast.success(`${year} tape colour added`);
      setNewYear(String(year + 1));
    } catch (error) {
      console.error("Error adding tape colour:", error);
      toast.error("Failed to add tape colour");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id: Id<"hoseTapeColors">, year: number) => {
    try {
      await remove({ id });
      toast.success(`Removed tape colour mapping for ${year}`);
    } catch (error) {
      console.error("Error removing tape colour:", error);
      toast.error("Failed to remove tape colour");
    }
  };

  if (!mappings) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-6">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="size-5" />
          Test Tape Colours
        </CardTitle>
        <CardDescription>
          Choose any solid colour, or combine two colours for striped tape.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mappings.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            No tape colours set yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mappings.map((mapping) => (
              <div
                key={mapping._id}
                className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
              >
                <span className="w-16 font-medium">{mapping.year}</span>
                <TapeColorPicker
                  idPrefix={mapping._id}
                  value={mapping.color}
                  onValueChange={(color) =>
                    void handleColorChange(mapping.year, color)
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:ml-auto"
                  onClick={() => void handleRemove(mapping._id, mapping.year)}
                  title="Remove mapping"
                  aria-label={`Remove tape colour for ${mapping.year}`}
                >
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col items-start gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-tape-year">Year</Label>
            <Input
              id="new-tape-year"
              type="number"
              min={1900}
              max={2200}
              value={newYear}
              onChange={(event) => setNewYear(event.target.value)}
              className="w-24"
            />
          </div>
          <TapeColorPicker
            idPrefix="new-tape"
            value={newColor}
            onValueChange={setNewColor}
          />
          <Button onClick={() => void handleAdd()} disabled={isSaving}>
            <Plus data-icon="inline-start" />
            {isSaving ? "Adding…" : "Add"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
