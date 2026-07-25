import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { KitTracks } from "../types";

export interface KitCardEntry {
  itemId: string;
  itemName: string;
  tracks: KitTracks;
  display?: string;
}

interface KitSetCardProps {
  title: string;
  recorded: number;
  total: number;
  entries: KitCardEntry[];
  /** Where tapping the card goes: the set editor for this scope. */
  to: string;
}

/**
 * One kit set as read-first text, not a wall of inputs. Used unchanged for the
 * "Individual items" group: it takes a title, a count and item/value pairs, and
 * doesn't know which it is.
 */
export function KitSetCard({ title, recorded, total, entries, to }: KitSetCardProps) {
  const nothingRecorded = recorded === 0;

  return (
    <Link
      to={to}
      aria-label={`${title}, ${recorded} of ${total} items recorded. Edit.`}
      className="block rounded-lg border border-border bg-background transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {recorded}/{total}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="border-t border-border px-3 py-2.5">
        {nothingRecorded ? (
          // An empty kit list stays short rather than showing eighteen em dashes.
          <p className="text-sm text-muted-foreground">Nothing recorded yet</p>
        ) : (
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
            {entries.map((entry) => (
              <div key={entry.itemId} className="contents">
                <dt className="min-w-0 truncate text-muted-foreground">{entry.itemName}</dt>
                <dd
                  className={
                    entry.display
                      ? `min-w-0 font-medium [overflow-wrap:anywhere] ${
                          entry.tracks === "serial" ? "font-mono" : ""
                        }`
                      : "text-muted-foreground/60"
                  }
                >
                  {entry.display ?? "Not recorded"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Link>
  );
}
