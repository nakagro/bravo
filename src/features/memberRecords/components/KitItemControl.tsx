import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/shared/DatePicker";
import { Id } from "../../../../convex/_generated/dataModel";
import { KitItemDef, KitValue, isSizeValue } from "../types";
import { KitChoiceChips } from "./KitChoiceChips";

interface KitItemControlProps {
  item: KitItemDef;
  value: KitValue | null;
  onChange: (value: KitValue | null) => void;
  /** Compact layout for the bulk screen's one-row-per-member list. */
  compact?: boolean;
}

/** Chips stay scannable up to a handful of options; beyond that, a Select. */
const CHIP_LIMIT = 5;
const CHART_CHIP_LIMIT = 3;

/**
 * The one control per item type. Every type has an obvious way back to
 * *Not recorded*, and none of them commit on blur; the set and bulk screens
 * save explicitly.
 */
export function KitItemControl({ item, value, onChange, compact = false }: KitItemControlProps) {
  switch (item.tracks) {
    case "size":
      return <SizeControl item={item} value={value} onChange={onChange} compact={compact} />;
    case "held":
      return (
        <KitChoiceChips
          label={item.name}
          options={[
            { value: "true", label: "Issued" },
            { value: "false", label: "Not issued" },
          ]}
          value={typeof value === "boolean" ? String(value) : null}
          onChange={(next) => onChange(next === null ? null : next === "true")}
          clearable
          wide
        />
      );
    case "choice": {
      const options = item.options ?? [];
      const current = typeof value === "string" ? value : null;
      if (options.length <= CHIP_LIMIT) {
        return (
          <KitChoiceChips
            label={item.name}
            options={options.map((option) => ({ value: option, label: option }))}
            value={current}
            onChange={onChange}
            clearable
            wide
          />
        );
      }
      return (
        <Select
          value={current ?? ""}
          onValueChange={(next) => onChange(next === "" ? null : next)}
        >
          <SelectTrigger className="min-h-11" aria-label={item.name}>
            <SelectValue placeholder="Not recorded" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "date":
      return (
        <div className="space-y-2">
          <DatePicker
            value={typeof value === "string" ? value : ""}
            onChange={(next) => onChange(next === "" ? null : next)}
            placeholder="Not recorded"
          />
          {typeof value === "string" && value !== "" && (
            <ClearButton onClear={() => onChange(null)} />
          )}
        </div>
      );
    case "serial":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : event.target.value)
          }
          inputMode="text"
          placeholder="Not recorded"
          aria-label={item.name}
          className="min-h-11 font-mono"
        />
      );
    case "note":
      return (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : event.target.value)
          }
          rows={compact ? 2 : 3}
          placeholder="Not recorded"
          aria-label={item.name}
        />
      );
  }
}

function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClear}
      className="h-11 px-2 text-sm text-muted-foreground hover:text-foreground"
    >
      Clear
    </Button>
  );
}

/**
 * The flagship control: chart, then a wrap of tappable size chips. One tap,
 * rather than opening a Select and scrolling.
 */
function SizeControl({ item, value, onChange, compact }: KitItemControlProps) {
  const charts = item.charts;
  const recordedChartId = isSizeValue(value) ? value.chartId : null;
  const recordedSize = isSizeValue(value) ? value.size : null;

  // A chart can be chosen before a size, and a value only exists once both are.
  // Hold the pending chart locally, defaulting to the only chart when there is
  // just one so a single-supplier item is a single tap.
  const [chartId, setChartId] = useState<Id<"memberKitSizeCharts"> | null>(
    recordedChartId ?? (charts.length === 1 ? charts[0]._id : null),
  );
  const [announcement, setAnnouncement] = useState("");

  // Follow the stored value when it names a chart; the guard keeps a purely
  // local pick (chart chosen, size not yet) from being clobbered.
  useEffect(() => {
    if (recordedChartId && recordedChartId !== chartId) setChartId(recordedChartId);
  }, [recordedChartId, chartId]);

  const activeChart = useMemo(
    () => charts.find((chart) => chart._id === chartId) ?? null,
    [charts, chartId],
  );

  /** A single unnamed chart is just "this item's sizes", with no brand to pick. */
  const unbranded = charts.length === 1 && !charts[0].name;

  if (charts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No size charts defined for this item yet.
      </p>
    );
  }

  const selectChart = (nextId: Id<"memberKitSizeCharts">) => {
    const next = charts.find((chart) => chart._id === nextId);
    setChartId(nextId);
    if (!next) return;

    if (recordedSize === null) {
      setAnnouncement("");
      return;
    }
    // Carrying the size over when the new chart has it is the whole point:
    // switching brand used to silently wipe a recorded size.
    if (next.sizes.includes(recordedSize)) {
      onChange({ chartId: nextId, size: recordedSize });
      setAnnouncement(
        `Size ${recordedSize} carried over to ${next.name ?? "the new size list"}.`,
      );
    } else {
      onChange(null);
      setAnnouncement(
        `${next.name ?? "That size list"} has no size ${recordedSize}, so the size was cleared.`,
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* One unnamed chart means the item only comes in one make (braces, say),
          so there is nothing to choose: show the sizes on their own. */}
      {!unbranded && (
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Brand</span>
        {charts.length <= CHART_CHIP_LIMIT ? (
          <KitChoiceChips
            label={`${item.name} brand`}
            options={charts.map((chart) => ({
              value: chart._id,
              label: chart.name ?? "Standard",
            }))}
            value={chartId}
            onChange={(next) => next && selectChart(next as Id<"memberKitSizeCharts">)}
            wide
          />
        ) : (
          <Select
            value={chartId ?? ""}
            onValueChange={(next) => selectChart(next as Id<"memberKitSizeCharts">)}
          >
            <SelectTrigger className="min-h-11" aria-label={`${item.name} brand`}>
              <SelectValue placeholder="Choose a brand" />
            </SelectTrigger>
            <SelectContent>
              {charts.map((chart) => (
                <SelectItem key={chart._id} value={chart._id}>
                  {chart.name ?? "Standard"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      )}

      {activeChart && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Size</span>
          <KitChoiceChips
            label={`${item.name} size`}
            options={activeChart.sizes.map((size) => ({ value: size, label: size }))}
            value={recordedChartId === activeChart._id ? recordedSize : null}
            onChange={(size) =>
              onChange(size === null ? null : { chartId: activeChart._id, size })
            }
            clearable
            className={compact ? "gap-1.5" : undefined}
          />
        </div>
      )}

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {announcement}
      </p>
    </div>
  );
}
