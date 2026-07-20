import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Tags, Trash2 } from "lucide-react";
import { tapeColorOptions, tapeColorSwatchClasses, TapeColor } from "../types";

function TapeSwatch({ color }: { color: TapeColor }) {
  return (
    <span
      className={`inline-block h-5 w-5 rounded-full flex-shrink-0 ${tapeColorSwatchClasses[color]}`}
      title={color}
    />
  );
}

export function HoseTapeColors() {
  const mappings = useQuery(api.hoseTapeColors.list);
  const upsert = useMutation(api.hoseTapeColors.upsert);
  const remove = useMutation(api.hoseTapeColors.remove);

  const currentYear = new Date().getFullYear();
  const [newYear, setNewYear] = useState<string>(String(currentYear));
  const [newColor, setNewColor] = useState<TapeColor>("Red");
  const [isSaving, setIsSaving] = useState(false);

  const handleColorChange = async (year: number, color: TapeColor) => {
    try {
      await upsert({ year, color });
      toast.success(`${year} tape colour set to ${color}`);
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
    if (mappings?.some((m) => m.year === year)) {
      toast.error(`${year} already has a tape colour set`);
      return;
    }

    setIsSaving(true);
    try {
      await upsert({ year, color: newColor });
      toast.success(`${year} tape colour set to ${newColor}`);
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
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            <span className="text-base sm:text-lg">Test Tape Colours</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No tape colours set yet.
            </p>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping) => (
                <div
                  key={mapping._id}
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100 w-16">
                    {mapping.year}
                  </span>
                  <TapeSwatch color={mapping.color} />
                  <Select
                    value={mapping.color}
                    onValueChange={(value) =>
                      handleColorChange(mapping.year, value as TapeColor)
                    }
                  >
                    <SelectTrigger className="flex-1 max-w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tapeColorOptions.map((color) => (
                        <SelectItem key={color} value={color}>
                          <span className="flex items-center gap-2">
                            <TapeSwatch color={color} />
                            {color}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-gray-400 hover:text-red-600"
                    onClick={() => handleRemove(mapping._id, mapping.year)}
                    title="Remove mapping"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3 pt-2 border-t border-border">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Year
              </label>
              <Input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Colour
              </label>
              <Select
                value={newColor}
                onValueChange={(value) => setNewColor(value as TapeColor)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tapeColorOptions.map((color) => (
                    <SelectItem key={color} value={color}>
                      <span className="flex items-center gap-2">
                        <TapeSwatch color={color} />
                        {color}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={isSaving}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
