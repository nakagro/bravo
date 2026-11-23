import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  DoorOpen,
  Eye,
  Lock,
  LockOpen,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Siren,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate } from "@/lib/dateFormat";
import { statusToneClasses, type StatusTone } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

type AreaStatus = "armed" | "disarmed" | "alarm" | "exitDelay" | "entryDelay";
type DoorStatus = "secured" | "unlocked" | "open" | "heldOpen" | "forced" | "offline";
type CommandAction =
  | "arm"
  | "arm_stay"
  | "disarm"
  | "pulse"
  | "unlock"
  | "lock"
  | "open_roller"
  | "disarm_and_open_roller";

interface AccessArea {
  id: string;
  name: string;
  status: AreaStatus;
  changedAt: number;
  changedBy?: string;
  canControl: boolean;
}

interface AccessDoor {
  id: string;
  name: string;
  kind: "door" | "roller";
  status: DoorStatus;
  changedAt: number;
  canControl: boolean;
  supportsHold: boolean;
  unlockedUntil?: number;
}

interface AccessSite {
  id: string;
  name: string;
  panel: "inception" | "challenger";
  panelLabel: string;
  writesEnabled: boolean;
  bridgeVersion?: string;
  lastSeenAt: number;
  areas: AccessArea[];
  doors: AccessDoor[];
}

interface AccessEvent {
  id: string;
  siteId: string;
  at: number;
  text: string;
  who?: string;
  source: "panel" | "bravo";
}

const STALE_AFTER_MS = 2 * 60 * 1000;

const AREA_INFO: Record<AreaStatus, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  armed: { label: "Armed", tone: "success", icon: ShieldCheck },
  disarmed: { label: "Disarmed", tone: "warning", icon: ShieldOff },
  alarm: { label: "Alarm", tone: "danger", icon: Siren },
  exitDelay: { label: "Exit delay", tone: "info", icon: ShieldCheck },
  entryDelay: { label: "Entry delay", tone: "info", icon: ShieldAlert },
};

const DOOR_INFO: Record<DoorStatus, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  secured: { label: "Secured", tone: "neutral", icon: Lock },
  unlocked: { label: "Unlocked", tone: "warning", icon: LockOpen },
  open: { label: "Open", tone: "info", icon: DoorOpen },
  heldOpen: { label: "Held open", tone: "danger", icon: DoorOpen },
  forced: { label: "Forced", tone: "danger", icon: ShieldAlert },
  offline: { label: "Offline", tone: "warning", icon: WifiOff },
};

function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(ms);
}

function siteSummary(site: AccessSite): { label: string; tone: StatusTone; icon: LucideIcon } {
  if (site.areas.length === 0) return { label: "Connected", tone: "neutral", icon: ShieldCheck };
  if (site.areas.some((a) => a.status === "alarm")) return AREA_INFO.alarm;
  const armed = site.areas.filter((a) => a.status === "armed").length;
  if (armed === site.areas.length) return AREA_INFO.armed;
  if (armed === 0) return AREA_INFO.disarmed;
  return { label: "Partly armed", tone: "warning", icon: ShieldAlert };
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message.replace(/^\[CONVEX[^\]]*\]\s*/i, "").replace(/^Uncaught Error:\s*/i, "");
  }
  return "Command failed";
}

export function AccessControlPage() {
  const dashboard = useQuery(api.accessControl.getDashboard);
  const requestCommand = useMutation(api.accessControl.requestCommand);
  const [now, setNow] = useState(Date.now());
  const [activeSiteId, setActiveSiteId] = useState<string>("");
  const watchedCommands = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const sites = useMemo(() => dashboard?.sites ?? [], [dashboard]);
  const events = useMemo(() => dashboard?.events ?? [], [dashboard]);
  const recentCommands = useMemo(() => dashboard?.recentCommands ?? [], [dashboard]);

  const effectiveSiteId = useMemo(() => {
    if (sites.length === 0) return "";
    if (sites.some((s) => s.id === activeSiteId)) return activeSiteId;
    return sites[0].id;
  }, [sites, activeSiteId]);

  // Surface bridge completion results as toasts for commands queued in this tab.
  useEffect(() => {
    for (const cmd of recentCommands) {
      const label = watchedCommands.current.get(cmd.id);
      if (!label) continue;
      if (cmd.status === "succeeded") {
        watchedCommands.current.delete(cmd.id);
        toast.success(cmd.message || `${label}: done`);
      } else if (cmd.status === "failed" || cmd.status === "expired") {
        watchedCommands.current.delete(cmd.id);
        toast.error(cmd.message || `${label}: ${cmd.status}`);
      }
    }
  }, [recentCommands]);

  const inFlightKeys = useMemo(() => {
    const set = new Set<string>();
    for (const cmd of recentCommands) {
      if ((cmd.status === "pending" || cmd.status === "executing") && now <= cmd.expiresAt + 5_000) {
        set.add(`${cmd.siteId}:${cmd.targetId}`);
      }
    }
    return set;
  }, [recentCommands, now]);

  const sendCommand = async (
    params: {
      siteId: string;
      targetKind: "area" | "door" | "roller";
      targetId: string;
      action: CommandAction;
      pulseMs?: number;
    },
    label: string,
  ) => {
    try {
      const res = await requestCommand(params);
      watchedCommands.current.set(res.commandId, label);
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  if (dashboard === undefined) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner className="size-7 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6" data-component="AccessControlPage">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live station security status and remote controls via local site bridges.
        </p>
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <WifiOff className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No stations reporting yet</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Waiting for a local station bridge to push its first status update.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile glance strip: shows site status above the fold and switches active card */}
          {sites.length > 1 && (
            <div className="grid grid-cols-2 gap-2.5 lg:hidden" aria-label="Stations">
              {sites.map((site) => {
                const summary = siteSummary(site);
                const stale = now - site.lastSeenAt > STALE_AFTER_MS;
                const selected = site.id === effectiveSiteId;
                return (
                  <button
                    key={site.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveSiteId(site.id)}
                    className={cn(
                      "min-w-0 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-primary/60 bg-card ring-1 ring-primary/25"
                        : "border-border bg-card/40 hover:bg-card",
                    )}
                  >
                    <div className="truncate text-sm font-semibold text-foreground">{site.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={summary.tone}>{summary.label}</Badge>
                      {stale && <WifiOff className="size-3.5 text-muted-foreground" aria-label="Offline" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Site cards: selected site on mobile, both side-by-side on desktop */}
          <div className={cn("grid gap-4", sites.length > 1 && "lg:grid-cols-2")}>
            {sites.map((site) => (
              <div
                key={site.id}
                className={cn("min-w-0", sites.length > 1 && site.id !== effectiveSiteId && "hidden lg:block")}
              >
                <SiteCard
                  site={site}
                  now={now}
                  events={events.filter((e) => e.siteId === site.id).slice(0, 8)}
                  inFlightKeys={inFlightKeys}
                  onSendCommand={sendCommand}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface SiteCardProps {
  site: AccessSite;
  now: number;
  events: AccessEvent[];
  inFlightKeys: Set<string>;
  onSendCommand: (
    params: {
      siteId: string;
      targetKind: "area" | "door" | "roller";
      targetId: string;
      action: CommandAction;
      pulseMs?: number;
    },
    label: string,
  ) => Promise<void>;
}

function SiteCard({ site, now, events, inFlightKeys, onSendCommand }: SiteCardProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const summary = useMemo(() => siteSummary(site), [site]);
  const stale = now - site.lastSeenAt > STALE_AFTER_MS;
  const readOnly = !site.writesEnabled;
  const controlsDisabled = stale || readOnly;
  const siteHasArmedArea = site.areas.some((a) => a.status === "armed");
  const SummaryIcon = summary.icon;
  const latestEvent = events[0];

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{site.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {site.panelLabel} · updated {ago(site.lastSeenAt, now)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {readOnly && <Badge tone="warning">Read-only</Badge>}
            <Badge tone={summary.tone} className="gap-1.5 px-2.5 py-1 text-xs">
              <SummaryIcon className="size-3.5" />
              {summary.label}
            </Badge>
          </div>
        </div>

        {stale && (
          <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", statusToneClasses.warning)}>
            <WifiOff className="size-3.5 shrink-0" />
            <span>No update since {ago(site.lastSeenAt, now)}. Controls are hidden until it reconnects.</span>
          </div>
        )}

        {!stale && readOnly && (
          <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", statusToneClasses.info)}>
            <Eye className="size-3.5 shrink-0" />
            <span>Live status only. Remote writes are disabled on this bridge.</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
        {/* Areas */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Areas</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background/40">
            {site.areas.map((area) => {
              const info = AREA_INFO[area.status];
              const armed = area.status === "armed";
              const busy = inFlightKeys.has(`${site.id}:${area.id}`);
              return (
                <li key={area.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{area.name}</div>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <Badge tone={info.tone} className="shrink-0">{info.label}</Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {ago(area.changedAt, now)}
                        {area.changedBy ? ` · ${area.changedBy}` : ""}
                      </span>
                    </div>
                  </div>
                  {controlsDisabled ? null : area.canControl ? (
                    <ConfirmDialog
                      title={`${armed ? "Disarm" : "Arm"} ${site.name}: ${area.name}?`}
                      description={
                        armed
                          ? "The area will be disarmed straight away."
                          : "Make sure nobody is inside and all doors are closed before arming."
                      }
                      confirmLabel={armed ? "Disarm" : "Arm"}
                      tone={armed ? "destructive" : "default"}
                      onConfirm={() =>
                        onSendCommand(
                          {
                            siteId: site.id,
                            targetKind: "area",
                            targetId: area.id,
                            action: armed ? "disarm" : "arm",
                          },
                          `${site.name}: ${area.name}`,
                        )
                      }
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 px-3 sm:h-8"
                          loading={busy}
                          disabled={busy}
                        >
                          {armed ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                          {armed ? "Disarm" : "Arm"}
                        </Button>
                      }
                    />
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="size-3.5" />
                      View only
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Doors */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doors</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background/40">
            {site.doors.map((door) => (
              <DoorRow
                key={door.id}
                site={site}
                door={door}
                now={now}
                siteHasArmedArea={siteHasArmedArea}
                disabled={controlsDisabled}
                busy={inFlightKeys.has(`${site.id}:${door.id}`)}
                onSendCommand={onSendCommand}
              />
            ))}
          </ul>
        </section>

        {/* Collapsible recent activity */}
        <section className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setActivityOpen((open) => !open)}
            aria-expanded={activityOpen}
            className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="min-w-0">
              <span className="font-semibold uppercase tracking-wider">Recent activity</span>
              {!activityOpen && latestEvent && (
                <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                  {latestEvent.text} · {ago(latestEvent.at, now)}
                </p>
              )}
            </div>
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", activityOpen && "rotate-180")}
            />
          </button>

          {activityOpen && (
            <div className="mt-3">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing recent.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-foreground">
                        {e.text}
                        {e.who && <span className="text-muted-foreground"> · {e.who}</span>}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{ago(e.at, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

interface DoorRowProps {
  site: AccessSite;
  door: AccessDoor;
  now: number;
  siteHasArmedArea: boolean;
  disabled: boolean;
  busy: boolean;
  onSendCommand: SiteCardProps["onSendCommand"];
}

function DoorRow({ site, door, now, siteHasArmedArea, disabled, busy, onSendCommand }: DoorRowProps) {
  const info = DOOR_INFO[door.status];
  const held = door.status === "unlocked" && !door.unlockedUntil;
  const label = held ? "Kept unlocked" : info.label;
  const isRoller = door.kind === "roller";
  const isAlreadyOpen = door.status === "open" || door.status === "heldOpen";

  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{door.name}</div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <Badge tone={info.tone} className="shrink-0">{label}</Badge>
          <span className="truncate text-xs text-muted-foreground">{ago(door.changedAt, now)}</span>
        </div>
      </div>

      {disabled ? null : !door.canControl ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Eye className="size-3.5" />
          View only
        </span>
      ) : isRoller ? (
        isAlreadyOpen ? (
          <span className="shrink-0 text-xs text-muted-foreground">Close on site</span>
        ) : (
          <ConfirmDialog
            title={
              siteHasArmedArea
                ? `Disarm ${site.name} and open ${door.name}?`
                : `Open ${site.name}: ${door.name}?`
            }
            description={
              siteHasArmedArea
                ? "This will disarm the station alarm first, verify it is disarmed, and then pulse the roller door open."
                : "This will pulse the roller door relay to open the door."
            }
            confirmLabel={siteHasArmedArea ? "Disarm and Open" : "Open"}
            tone={siteHasArmedArea ? "destructive" : "default"}
            onConfirm={() =>
              onSendCommand(
                {
                  siteId: site.id,
                  targetKind: "roller",
                  targetId: door.id,
                  action: siteHasArmedArea ? "disarm_and_open_roller" : "open_roller",
                },
                `${site.name}: ${door.name}`,
              )
            }
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="h-9 shrink-0 px-3 sm:h-8"
                loading={busy}
                disabled={busy}
              >
                <DoorOpen className="size-3.5" />
                {siteHasArmedArea ? "Disarm & Open" : "Open"}
              </Button>
            }
          />
        )
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {held && door.supportsHold ? (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 sm:h-8"
              loading={busy}
              disabled={busy}
              onClick={() =>
                onSendCommand(
                  { siteId: site.id, targetKind: "door", targetId: door.id, action: "lock" },
                  `${site.name}: ${door.name}`,
                )
              }
            >
              <Lock className="size-3.5" />
              Lock
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 sm:h-8"
              loading={busy}
              disabled={busy}
              onClick={() =>
                onSendCommand(
                  { siteId: site.id, targetKind: "door", targetId: door.id, action: "pulse" },
                  `${site.name}: ${door.name}`,
                )
              }
            >
              <DoorOpen className="size-3.5" />
              Unlock
            </Button>
          )}
          {!held && door.supportsHold && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 sm:size-8"
                  disabled={busy}
                  aria-label={`More for ${door.name}`}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    onSendCommand(
                      { siteId: site.id, targetKind: "door", targetId: door.id, action: "unlock" },
                      `${site.name}: ${door.name}`,
                    )
                  }
                >
                  <LockOpen className="size-4" />
                  Keep unlocked
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </li>
  );
}
