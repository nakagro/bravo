import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  DoorOpen,
  LockOpen,
  Power,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Siren,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusToneClasses, statusToneDotClasses } from "@/lib/statusTone";
import { cn } from "@/lib/utils";
import {
  AREA_LABEL,
  DOOR_LABEL,
  ago,
  isStale,
  latestAreaChange,
  mergeActivity,
  openDoors,
  siteSummary,
  soleArmedArea,
  splitDoors,
  unavailableReason,
  type AccessEvent,
  type Area,
  type Door,
  type Site,
  type SiteSummary,
} from "../model";
import { progressKey, type CommandParams, type Progress } from "../useAccessCommands";
import { ActionSheet, SheetWarning, type SheetAction } from "./ActionSheet";
import { DOOR_ICON, DoorTile, ProgressLine } from "./DoorTile";

type Run = (
  key: string,
  steps: Array<{ params: CommandParams; workingText: string }>,
  doneText: string,
) => Promise<boolean>;

const SUMMARY_ICON: Record<SiteSummary["kind"], LucideIcon> = {
  alarm: Siren,
  armed: ShieldCheck,
  partly: ShieldAlert,
  disarmed: ShieldOff,
  arming: ShieldCheck,
  none: ShieldCheck,
};

const ACTIVITY_PREVIEW = 4;

type Sheet =
  | { kind: "area"; area: Area; action: "arm" | "disarm" }
  | { kind: "unlock"; door: Door }
  | { kind: "roller"; door: Door }
  | { kind: "keepUnlocked"; door: Door };

interface StationViewProps {
  site: Site;
  events: AccessEvent[];
  now: number;
  progress: Record<string, Progress>;
  run: Run;
  /** Show the station's name as a heading: always for a single station... */
  showName: boolean;
  /** ...or only on desktop, where both stations sit side by side and the switcher is hidden. */
  showNameOnDesktop?: boolean;
}

/** Wants disarming: armed, mid-alarm, or counting down. */
const isOn = (a: Area) => a.status !== "disarmed";

export function StationView({ site, events, now, progress, run, showName, showNameOnDesktop }: StationViewProps) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [allActivity, setAllActivity] = useState(false);

  const summary = siteSummary(site);
  const SummaryIcon = SUMMARY_ICON[summary.kind];
  const reason = unavailableReason(site, now);
  const available = reason === null;
  const stale = isStale(site, now);
  const latest = latestAreaChange(site);
  const { controllable, notable, quiet } = splitDoors(site);
  const activity = useMemo(() => mergeActivity(events, site), [events, site]);
  const shownActivity = allActivity ? activity : activity.slice(0, ACTIVITY_PREVIEW);
  const singleArea = site.areas.length === 1 ? site.areas[0] : null;

  // ---- commands ---------------------------------------------------------------

  const areaCommand = (area: Area, action: "arm" | "disarm") =>
    run(
      progressKey(site.id, area.id),
      [
        {
          params: { siteId: site.id, targetKind: "area", targetId: area.id, action },
          workingText: action === "arm" ? "Arming…" : "Disarming…",
        },
      ],
      action === "arm" ? `${area.name} armed` : `${area.name} disarmed`,
    );

  const unlock = (door: Door, disarmFirst?: Area) =>
    run(
      progressKey(site.id, door.id),
      [
        ...(disarmFirst
          ? [
              {
                params: { siteId: site.id, targetKind: "area" as const, targetId: disarmFirst.id, action: "disarm" as const },
                workingText: "Disarming…",
              },
            ]
          : []),
        {
          params: { siteId: site.id, targetKind: "door", targetId: door.id, action: "pulse" },
          workingText: "Unlocking…",
        },
      ],
      disarmFirst ? "Disarmed and unlocked" : "Unlocked",
    );

  const doorCommand = (door: Door, action: "unlock" | "lock", done: string, working: string) =>
    run(
      progressKey(site.id, door.id),
      [{ params: { siteId: site.id, targetKind: "door", targetId: door.id, action }, workingText: working }],
      done,
    );

  const openRoller = (door: Door, armed: boolean) =>
    run(
      progressKey(site.id, door.id),
      [
        {
          params: {
            siteId: site.id,
            targetKind: "roller",
            targetId: door.id,
            action: armed ? "disarm_and_open_roller" : "open_roller",
          },
          workingText: armed ? "Disarming and opening…" : "Opening…",
        },
      ],
      "Opening",
    );

  /** After a completed hold: straight through, unless the station is armed. */
  const onHoldUnlock = (door: Door) => {
    if (soleArmedArea(site)) setSheet({ kind: "unlock", door });
    else void unlock(door);
  };

  // ---- render ------------------------------------------------------------------

  return (
    <div className="min-w-0 space-y-4">
      {(showName || showNameOnDesktop) && (
        <h2 className={cn("text-lg font-semibold text-foreground", !showName && "hidden lg:block")}>{site.name}</h2>
      )}

      {/* Status: the one thing to read at a glance. */}
      <section aria-label="Alarm" className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", statusToneClasses[summary.tone])}>
            <SummaryIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold leading-tight text-foreground">{summary.label}</div>
            {latest && (
              <p className="truncate text-sm text-muted-foreground">
                {site.areas.length > 1 ? `${latest.name} ${AREA_LABEL[latest.status].label.toLowerCase()}` : "Changed"}
                {latest.changedBy ? ` by ${latest.changedBy}` : ""} · {ago(latest.changedAt, now)}
              </p>
            )}
          </div>
        </div>

        {reason && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            {stale ? <WifiOff className="size-4 shrink-0" /> : <Power className="size-4 shrink-0" />}
            {reason}
          </p>
        )}

        {singleArea ? (
          available &&
          singleArea.canControl && (
            <div className="mt-4">
              <AreaAction
                area={singleArea}
                progress={progress[progressKey(site.id, singleArea.id)]}
                large
                onAction={(action) => setSheet({ kind: "area", area: singleArea, action })}
              />
            </div>
          )
        ) : (
          site.areas.length > 1 && (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {site.areas.map((area) => {
                const info = AREA_LABEL[area.status];
                return (
                  <li key={area.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", statusToneDotClasses[info.tone])} />
                      <span className="truncate font-medium text-foreground">{area.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">{info.label}</span>
                    </div>
                    {available && area.canControl && (
                      <div className="w-28 shrink-0">
                        <AreaAction
                          area={area}
                          progress={progress[progressKey(site.id, area.id)]}
                          onAction={(action) => setSheet({ kind: "area", area, action })}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>

      {/* Doors */}
      {site.doors.length > 0 && (
        <section aria-label="Doors" className="space-y-2.5">
          <h3 className="px-1 text-sm font-semibold text-foreground">Doors</h3>

          {controllable.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {controllable.map((door) => (
                <DoorTile
                  key={door.id}
                  door={door}
                  now={now}
                  available={available}
                  progress={progress[progressKey(site.id, door.id)]}
                  onUnlock={() => onHoldUnlock(door)}
                  onConfirm={(kind) => setSheet({ kind, door })}
                  onLock={() => void doorCommand(door, "lock", "Locked", "Locking…")}
                />
              ))}
            </div>
          )}

          {notable.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {notable.map((door) => (
                <DoorRow key={door.id} door={door} now={now} />
              ))}
            </ul>
          )}

          {quiet.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <button
                type="button"
                aria-expanded={othersOpen}
                onClick={() => setOthersOpen((o) => !o)}
                className="flex min-h-12 w-full touch-manipulation items-center justify-between gap-2 px-3 text-left text-sm"
              >
                <span className="text-muted-foreground">
                  {quiet.length} {notable.length > 0 || controllable.length > 0 ? "other " : ""}
                  {quiet.length === 1 ? "door" : "doors"} · {quiet.length === 1 ? "secured" : "all secured"}
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", othersOpen && "rotate-180")} />
              </button>
              {othersOpen && (
                <ul className="divide-y divide-border border-t border-border">
                  {quiet.map((door) => (
                    <DoorRow key={door.id} door={door} now={now} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* Recent activity */}
      <section aria-label="Recent activity" className="space-y-2">
        <h3 className="px-1 text-sm font-semibold text-foreground">Recent</h3>
        {activity.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Nothing recent.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {shownActivity.map((item) => (
                <li key={item.id} className="px-3 py-2.5">
                  <div className="text-sm text-foreground">{item.text}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[item.who, ago(item.at, now), item.relocked ? "locked again" : null].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
            {activity.length > ACTIVITY_PREVIEW && (
              <button
                type="button"
                onClick={() => setAllActivity((a) => !a)}
                className="min-h-11 w-full touch-manipulation border-t border-border text-sm font-medium text-primary"
              >
                {allActivity ? "Show less" : `Show ${activity.length - ACTIVITY_PREVIEW} more`}
              </button>
            )}
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", stale ? "bg-muted-foreground/60" : "animate-pulse bg-green-500")} />
        {stale ? `Last update ${ago(site.lastSeenAt, now)}` : `Live · updated ${ago(site.lastSeenAt, now)}`}
      </p>

      <StationSheet sheet={sheet} site={site} onClose={() => setSheet(null)}>
        {{
          arm: (area) => void areaCommand(area, "arm"),
          disarm: (area) => void areaCommand(area, "disarm"),
          unlock: (door, disarmFirst) => void unlock(door, disarmFirst),
          roller: (door, armed) => void openRoller(door, armed),
          keepUnlocked: (door) => void doorCommand(door, "unlock", "Kept unlocked", "Unlocking…"),
        }}
      </StationSheet>
    </div>
  );
}

/** Arm or Disarm for one area, or its progress. */
function AreaAction({
  area,
  progress,
  large,
  onAction,
}: {
  area: Area;
  progress?: Progress;
  large?: boolean;
  onAction: (action: "arm" | "disarm") => void;
}) {
  if (progress) return <ProgressLine progress={progress} className={large ? "min-h-12" : "min-h-10 text-xs"} />;
  const on = isOn(area);
  const Icon = on ? ShieldOff : ShieldCheck;
  return (
    <Button
      variant={large ? "default" : "outline"}
      className={cn("w-full touch-manipulation", large ? "h-12 text-base" : "h-10")}
      onClick={() => onAction(on ? "disarm" : "arm")}
    >
      <Icon className="size-4" />
      {/* The only button on the card reads "Disarm station", not just "Disarm". */}
      {on ? "Disarm" : "Arm"}
      {large ? ` ${area.name.toLowerCase()}` : ""}
    </Button>
  );
}

function DoorRow({ door, now }: { door: Door; now: number }) {
  const info = DOOR_LABEL[door.status];
  const Icon = DOOR_ICON[door.status];
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <span className="min-w-0 truncate text-foreground">{door.name}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">{ago(door.changedAt, now)}</span>
        <Badge tone={info.tone} className="gap-1">
          <Icon className="size-3" />
          {info.label}
        </Badge>
      </span>
    </li>
  );
}

interface SheetHandlers {
  arm: (area: Area) => void;
  disarm: (area: Area) => void;
  unlock: (door: Door, disarmFirst?: Area) => void;
  roller: (door: Door, armed: boolean) => void;
  keepUnlocked: (door: Door) => void;
}

/** The confirmation for whatever was tapped, with the warnings that apply. */
function StationSheet({
  sheet,
  site,
  onClose,
  children: on,
}: {
  sheet: Sheet | null;
  site: Site;
  onClose: () => void;
  children: SheetHandlers;
}) {
  // Keep the last content while the drawer animates closed.
  const [last, setLast] = useState<Sheet | null>(sheet);
  if (sheet && sheet !== last) setLast(sheet);
  const current = sheet ?? last;
  if (!current) return null;

  let title = "";
  let body: ReactNode = null;
  let actions: SheetAction[] = [];

  if (current.kind === "area") {
    const { area, action } = current;
    if (action === "arm") {
      const open = openDoors(site);
      title = `Arm ${area.name.toLowerCase()}?`;
      body = (
        <>
          <p>Check nobody is inside and the doors are closed.</p>
          {open.length > 0 && (
            <SheetWarning>
              {open.map((d) => d.name).join(", ")} {open.length === 1 ? "is" : "are"} open.
            </SheetWarning>
          )}
        </>
      );
      actions = [{ label: "Arm", icon: <ShieldCheck className="size-4" />, onSelect: () => on.arm(area) }];
    } else {
      title = `Disarm ${area.name.toLowerCase()}?`;
      body = <p>The alarm turns off straight away.</p>;
      actions = [{ label: "Disarm", icon: <ShieldOff className="size-4" />, onSelect: () => on.disarm(area) }];
    }
  } else if (current.kind === "unlock") {
    const { door } = current;
    const armed = soleArmedArea(site);
    title = `Unlock ${door.name}?`;
    if (armed) {
      body = (
        <SheetWarning>
          The station is armed. Unlocking won't turn the alarm off, and anyone who walks in will set it off.
        </SheetWarning>
      );
      actions = armed.canControl
        ? [
            { label: "Disarm and unlock", icon: <ShieldOff className="size-4" />, onSelect: () => on.unlock(door, armed) },
            { label: "Unlock only", icon: <LockOpen className="size-4" />, variant: "outline", onSelect: () => on.unlock(door) },
          ]
        : [{ label: "Unlock anyway", icon: <LockOpen className="size-4" />, onSelect: () => on.unlock(door) }];
    } else {
      body = <p>The door unlatches for a moment, then locks again.</p>;
      actions = [{ label: "Unlock", icon: <LockOpen className="size-4" />, onSelect: () => on.unlock(door) }];
    }
  } else if (current.kind === "roller") {
    const { door } = current;
    const armed = site.areas.some((a) => a.status === "armed");
    title = `Open ${door.name}?`;
    body = (
      <>
        <p>Make sure the doorway is clear. It can't be closed from BRAVO.</p>
        {armed && <SheetWarning>The station is armed. It will be disarmed first.</SheetWarning>}
      </>
    );
    actions = [
      {
        label: armed ? "Disarm and open" : "Open",
        icon: <DoorOpen className="size-4" />,
        onSelect: () => on.roller(door, armed),
      },
    ];
  } else {
    const { door } = current;
    title = `Keep ${door.name} unlocked?`;
    body = <p>It stays unlocked until someone locks it, here or on site.</p>;
    actions = [{ label: "Keep unlocked", icon: <LockOpen className="size-4" />, onSelect: () => on.keepUnlocked(door) }];
  }

  return (
    <ActionSheet open={sheet !== null} onClose={onClose} title={title} actions={actions}>
      {body}
    </ActionSheet>
  );
}
