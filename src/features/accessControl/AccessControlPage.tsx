import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Settings, Siren, WifiOff } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { statusToneClasses, statusToneDotClasses } from "@/lib/statusTone";
import { cn } from "@/lib/utils";
import { attentionItems, isStale, siteSummary } from "./model";
import { useAccessCommands } from "./useAccessCommands";
import { ControlsSettings } from "./components/ControlsSettings";
import { StationView } from "./components/StationView";

const SITE_KEY = "bravo:accessControl:site";

function readSavedSite(): string {
  try {
    return localStorage.getItem(SITE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Live alarm and door status for each station, and its remote controls. Built
 * for a phone: one station at a time, the alarm state as the headline, doors
 * as large tiles, and every action confirmed (doors by press and hold).
 */
export function AccessControlPage() {
  const dashboard = useQuery(api.accessControl.getDashboard);
  const [now, setNow] = useState(() => Date.now());
  const [chosenSite, setChosenSite] = useState(readSavedSite);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const sites = useMemo(() => dashboard?.sites ?? [], [dashboard]);
  const events = useMemo(() => dashboard?.events ?? [], [dashboard]);
  const { progress, run } = useAccessCommands(dashboard?.recentCommands ?? []);

  const siteId = sites.some((s) => s.id === chosenSite) ? chosenSite : (sites[0]?.id ?? "");
  const chooseSite = (id: string) => {
    setChosenSite(id);
    try {
      localStorage.setItem(SITE_KEY, id);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const attention = useMemo(() => attentionItems(sites), [sites]);

  if (dashboard === undefined) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  const several = sites.length > 1;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8" data-component="AccessControlPage">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Control</h1>
        {dashboard.canManageControls && sites.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Remote control settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-5" />
          </Button>
        )}
      </div>

      {/* Alarms and forced doors anywhere, whichever station is open. */}
      {attention.map((item) => (
        <button
          key={item.text}
          type="button"
          onClick={() => chooseSite(item.siteId)}
          className={cn(
            "flex min-h-12 w-full touch-manipulation items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold",
            statusToneClasses.danger,
          )}
        >
          <Siren className="size-5 shrink-0" />
          {item.text}
        </button>
      ))}

      {sites.length === 0 ? (
        <EmptyState
          icon={<WifiOff />}
          title="No stations reporting yet"
          description="Status appears here once a station's bridge checks in."
        />
      ) : (
        <>
          {several && (
            <SegmentedTabs
              className="lg:hidden"
              ariaLabel="Station"
              value={siteId}
              onChange={chooseSite}
              segments={sites.map((s) => {
                const summary = siteSummary(s);
                return {
                  key: s.id,
                  label: s.name.replace(/ Station$/, ""),
                  adornment: (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        isStale(s, now) ? statusToneDotClasses.neutral : statusToneDotClasses[summary.tone],
                      )}
                    />
                  ),
                };
              })}
            />
          )}

          <div className={cn("grid gap-6", several && "lg:grid-cols-2")}>
            {sites.map((site) => (
              <div key={site.id} className={cn("min-w-0", several && site.id !== siteId && "hidden lg:block")}>
                <StationView
                  site={site}
                  events={events.filter((e) => e.siteId === site.id)}
                  now={now}
                  progress={progress}
                  run={run}
                  showName={!several}
                  showNameOnDesktop={several}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {dashboard.canManageControls && (
        <ControlsSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} sites={sites} now={now} />
      )}
    </div>
  );
}
