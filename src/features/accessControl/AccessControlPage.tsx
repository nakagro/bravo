import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  DoorClosed,
  DoorOpen,
  Eye,
  FlaskConical,
  Lock,
  LockOpen,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Siren,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/dateFormat";
import type { StatusTone } from "@/lib/statusTone";
import { cn } from "@/lib/utils";
import {
  buildMockEvents,
  buildMockSites,
  PULSE_MS,
  STALE_AFTER_MS,
  type AccessArea,
  type AccessDoor,
  type AccessEvent,
  type AccessSite,
  type AreaStatus,
  type DoorStatus,
} from "./mockSites";

// Mock only: every action resolves locally after a short fake round trip.
const MOCK_ME = "You";
const fakeRoundTrip = () => new Promise((r) => setTimeout(r, 700));

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
  return formatDateTime(ms);
}

function siteSummary(site: AccessSite): { label: string; tone: StatusTone; icon: LucideIcon } {
  if (site.areas.some((a) => a.status === "alarm")) return AREA_INFO.alarm;
  const armed = site.areas.filter((a) => a.status === "armed").length;
  if (armed === site.areas.length) return AREA_INFO.armed;
  if (armed === 0) return AREA_INFO.disarmed;
  return { label: "Partly armed", tone: "warning", icon: ShieldAlert };
}

function summaryDotClass(tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "danger":
      return "bg-red-500";
    case "info":
      return "bg-blue-500";
    default:
      return "bg-muted-foreground";
  }
}

export function AccessControlPage() {
  const [sites, setSites] = useState<AccessSite[]>(() => buildMockSites());
  const [events, setEvents] = useState<AccessEvent[]>(() => buildMockEvents());
  const [now, setNow] = useState(Date.now());
  const [activeSiteId, setActiveSiteId] = useState<string>("main");
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const t = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      // Keep live mock sites fresh so Main Station does not go stale while browsing.
      // Satellite Station starts stale intentionally and stays stale.
      setSites((prev) =>
        prev.map((s) => (tick - s.lastSeenAt < STALE_AFTER_MS ? { ...s, lastSeenAt: tick } : s)),
      );
    }, 5_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const timers = pulseTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const log = (siteId: string, text: string) =>
    setEvents((prev) => [{ id: crypto.randomUUID(), siteId, at: Date.now(), text, who: MOCK_ME }, ...prev]);

  const patchSite = (siteId: string, fn: (s: AccessSite) => AccessSite) =>
    setSites((prev) => prev.map((s) => (s.id === siteId ? fn(s) : s)));

  const setArea = async (site: AccessSite, area: AccessArea, status: AreaStatus) => {
    await fakeRoundTrip();
    const ts = Date.now();
    patchSite(site.id, (s) => ({
      ...s,
      lastSeenAt: ts,
      areas: s.areas.map((a) => (a.id === area.id ? { ...a, status, changedAt: ts, changedBy: MOCK_ME } : a)),
    }));
    const verb = status === "armed" ? "armed" : "disarmed";
    log(site.id, `${area.name} ${verb}`);
    toast.success(`${site.name}: ${area.name} ${verb}`);
  };

  const setDoor = (siteId: string, doorId: string, status: DoorStatus) =>
    patchSite(siteId, (s) => ({
      ...s,
      doors: s.doors.map((d) => (d.id === doorId ? { ...d, status, changedAt: Date.now() } : d)),
    }));

  const clearPulseTimer = (key: string) => {
    const existing = pulseTimers.current.get(key);
    if (existing) {
      clearTimeout(existing);
      pulseTimers.current.delete(key);
    }
  };

  const pulseDoor = async (site: AccessSite, door: AccessDoor) => {
    const key = `${site.id}:${door.id}`;
    clearPulseTimer(key);
    await fakeRoundTrip();
    setDoor(site.id, door.id, "unlocked");
    log(site.id, `${door.name} unlocked (${PULSE_MS / 1000}s)`);
    toast.success(`${door.name} unlocked for ${PULSE_MS / 1000} seconds`);
    const timer = setTimeout(() => {
      pulseTimers.current.delete(key);
      setDoor(site.id, door.id, "secured");
    }, PULSE_MS);
    pulseTimers.current.set(key, timer);
  };

  const toggleHold = async (site: AccessSite, door: AccessDoor) => {
    clearPulseTimer(`${site.id}:${door.id}`);
    await fakeRoundTrip();
    const next = door.status === "unlocked" ? "secured" : "unlocked";
    setDoor(site.id, door.id, next);
    log(site.id, next === "unlocked" ? `${door.name} held open` : `${door.name} locked`);
    toast.success(next === "unlocked" ? `${door.name} held open` : `${door.name} locked`);
  };

  return (
    <div className="space-y-4 pb-6" data-component="AccessControlPage">
      {/* Compact header + unobtrusive mock notice */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Control</h1>
          <Badge tone="info">Mock</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
          <span>Sample data only. Not connected to the station panels.</span>
        </div>
      </div>

      {/* Mobile glance strip: shows both sites' status above the fold and switches active card */}
      <div className="grid grid-cols-2 gap-2.5 lg:hidden" role="tablist" aria-label="Stations">
        {sites.map((site) => {
          const summary = siteSummary(site);
          const stale = now - site.lastSeenAt > STALE_AFTER_MS;
          const selected = site.id === activeSiteId;
          return (
            <button
              key={site.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveSiteId(site.id)}
              className={cn(
                "min-w-0 rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-primary/60 bg-card shadow-sm ring-1 ring-primary/25"
                  : "border-border bg-card/50 text-muted-foreground hover:bg-card",
              )}
            >
              <div className="truncate text-sm font-semibold text-foreground">{site.name}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                <span className={cn("size-2 shrink-0 rounded-full", summaryDotClass(summary.tone))} />
                <span className="truncate font-medium text-foreground">{summary.label}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {stale ? (
                  <>
                    <WifiOff className="size-3 shrink-0 text-amber-500" />
                    <span className="truncate text-amber-600 dark:text-amber-400">Offline {ago(site.lastSeenAt, now)}</span>
                  </>
                ) : (
                  <>
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>Live</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Site cards: selected site on mobile, both side-by-side on desktop */}
      <div className="grid gap-4 lg:grid-cols-2">
        {sites.map((site) => (
          <div key={site.id} className={cn("min-w-0", site.id !== activeSiteId && "hidden lg:block")}>
            <SiteCard
              site={site}
              now={now}
              events={events.filter((e) => e.siteId === site.id).slice(0, 5)}
              onSetArea={setArea}
              onPulse={pulseDoor}
              onToggleHold={toggleHold}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SiteCardProps {
  site: AccessSite;
  now: number;
  events: AccessEvent[];
  onSetArea: (site: AccessSite, area: AccessArea, status: AreaStatus) => Promise<void>;
  onPulse: (site: AccessSite, door: AccessDoor) => Promise<void>;
  onToggleHold: (site: AccessSite, door: AccessDoor) => Promise<void>;
}

function SiteCard({ site, now, events, onSetArea, onPulse, onToggleHold }: SiteCardProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const summary = useMemo(() => siteSummary(site), [site]);
  const stale = now - site.lastSeenAt > STALE_AFTER_MS;
  const SummaryIcon = summary.icon;
  const latestEvent = events[0];

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{site.name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{site.panelLabel}</span>
              {!stale && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              )}
            </div>
          </div>
          <Badge tone={summary.tone} className="shrink-0 gap-1.5 px-2.5 py-1 text-xs">
            <SummaryIcon className="size-3.5" />
            {summary.label}
          </Badge>
        </div>

        {stale && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <WifiOff className="size-3.5 shrink-0" />
            <span>No update since {ago(site.lastSeenAt, now)}. Controls disabled.</span>
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
              return (
                <li key={area.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{area.name}</span>
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {ago(area.changedAt, now)}
                      {area.changedBy ? ` · ${area.changedBy}` : ""}
                    </p>
                  </div>
                  <ConfirmDialog
                    title={`${armed ? "Disarm" : "Arm"} ${site.name}: ${area.name}?`}
                    description={
                      armed
                        ? "The area will be disarmed straight away."
                        : "Make sure nobody is inside. The exit delay starts once it is armed."
                    }
                    confirmLabel={armed ? "Disarm" : "Arm"}
                    tone={armed ? "destructive" : "default"}
                    onConfirm={() => onSetArea(site, area, armed ? "disarmed" : "armed")}
                    trigger={
                      <Button variant="outline" size="sm" className="h-9 shrink-0 px-3 sm:h-8" disabled={stale}>
                        {armed ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                        {armed ? "Disarm" : "Arm"}
                      </Button>
                    }
                  />
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
                door={door}
                now={now}
                disabled={stale}
                onPulse={() => onPulse(site, door)}
                onToggleHold={() => onToggleHold(site, door)}
              />
            ))}
          </ul>
        </section>

        {/* Collapsible recent activity: shows latest event inline without adding vertical noise */}
        <section className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setActivityOpen((open) => !open)}
            aria-expanded={activityOpen}
            className="flex w-full items-center justify-between gap-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
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
  door: AccessDoor;
  now: number;
  disabled: boolean;
  onPulse: () => Promise<void>;
  onToggleHold: () => Promise<void>;
}

function DoorRow({ door, now, disabled, onPulse, onToggleHold }: DoorRowProps) {
  const [busy, setBusy] = useState<"pulse" | "hold" | null>(null);
  const info = DOOR_INFO[door.status];
  const Icon = info.icon;
  const held = door.status === "unlocked";
  const highlightIcon = door.status === "open"
    ? "text-blue-500 dark:text-blue-400"
    : door.status === "unlocked"
      ? "text-amber-500 dark:text-amber-400"
      : door.status === "forced" || door.status === "heldOpen"
        ? "text-red-500 dark:text-red-400"
        : "text-muted-foreground";

  const run = async (kind: "pulse" | "hold", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center justify-between gap-2.5 sm:justify-start">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={cn("size-4 shrink-0", highlightIcon)} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-foreground">{door.name}</span>
              <Badge tone={info.tone}>{info.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{ago(door.changedAt, now)}</p>
          </div>
        </div>
        {!door.canControl && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground sm:hidden">
            <Eye className="size-3.5" />
            View only
          </span>
        )}
      </div>

      {door.canControl ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            size="sm"
            className="h-9 sm:h-8"
            loading={busy === "pulse"}
            disabled={disabled || busy !== null || held}
            onClick={() => run("pulse", onPulse)}
          >
            <DoorClosed className="size-3.5" />
            Unlock
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 sm:h-8"
            loading={busy === "hold"}
            disabled={disabled || busy !== null}
            onClick={() => run("hold", onToggleHold)}
          >
            {held ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            {held ? "Lock" : "Hold open"}
          </Button>
        </div>
      ) : (
        <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Eye className="size-3.5" />
          View only
        </span>
      )}
    </li>
  );
}
