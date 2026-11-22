import { useEffect, useMemo, useState } from "react";
import {
  Ban, DoorClosed, DoorOpen, FlaskConical, Lock, LockOpen, RadioTower,
  ShieldAlert, ShieldCheck, ShieldOff, Siren, WifiOff, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDateTime } from "@/lib/dateFormat";
import type { StatusTone } from "@/lib/statusTone";
import {
  buildMockEvents, buildMockSites, PULSE_MS, STALE_AFTER_MS,
  type AccessArea, type AccessDoor, type AccessEvent, type AccessSite,
  type AreaStatus, type DoorStatus,
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
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDateTime(ms);
}

function siteSummary(site: AccessSite): { label: string; tone: StatusTone; icon: LucideIcon } {
  if (site.areas.some((a) => a.status === "alarm")) return AREA_INFO.alarm;
  const armed = site.areas.filter((a) => a.status === "armed").length;
  if (armed === site.areas.length) return AREA_INFO.armed;
  if (armed === 0) return AREA_INFO.disarmed;
  return { label: "Partly armed", tone: "warning", icon: ShieldAlert };
}

export function AccessControlPage() {
  const [sites, setSites] = useState<AccessSite[]>(() => buildMockSites());
  const [events, setEvents] = useState<AccessEvent[]>(() => buildMockEvents());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const log = (siteId: string, text: string) =>
    setEvents((prev) => [{ id: crypto.randomUUID(), siteId, at: Date.now(), text, who: MOCK_ME }, ...prev]);

  const patchSite = (siteId: string, fn: (s: AccessSite) => AccessSite) =>
    setSites((prev) => prev.map((s) => (s.id === siteId ? fn(s) : s)));

  const setArea = async (site: AccessSite, area: AccessArea, status: AreaStatus) => {
    await fakeRoundTrip();
    patchSite(site.id, (s) => ({
      ...s,
      lastSeenAt: Date.now(),
      areas: s.areas.map((a) => (a.id === area.id ? { ...a, status, changedAt: Date.now(), changedBy: MOCK_ME } : a)),
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

  const pulseDoor = async (site: AccessSite, door: AccessDoor) => {
    await fakeRoundTrip();
    setDoor(site.id, door.id, "unlocked");
    log(site.id, `${door.name} unlocked for ${PULSE_MS / 1000} s`);
    toast.success(`${door.name} unlocked for ${PULSE_MS / 1000} seconds`);
    setTimeout(() => setDoor(site.id, door.id, "secured"), PULSE_MS);
  };

  const toggleHold = async (site: AccessSite, door: AccessDoor) => {
    await fakeRoundTrip();
    const next = door.status === "unlocked" ? "secured" : "unlocked";
    setDoor(site.id, door.id, next);
    log(site.id, next === "unlocked" ? `${door.name} held unlocked` : `${door.name} locked`);
  };

  return (
    <div className="space-y-4" data-component="AccessControlPage">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Access Control</h1>
        <Badge tone="info">Mock</Badge>
      </div>

      <Alert>
        <FlaskConical />
        <AlertTitle>Preview with made-up data</AlertTitle>
        <AlertDescription>
          This screen is not connected to the station panels. Buttons change the screen only.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        {sites.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            now={now}
            events={events.filter((e) => e.siteId === site.id).slice(0, 5)}
            onSetArea={setArea}
            onPulse={pulseDoor}
            onToggleHold={toggleHold}
          />
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
  const summary = useMemo(() => siteSummary(site), [site]);
  const stale = now - site.lastSeenAt > STALE_AFTER_MS;
  const SummaryIcon = summary.icon;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{site.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{site.panelLabel}</p>
          </div>
          <Badge tone={summary.tone} className="gap-1 text-sm">
            <SummaryIcon className="size-4" />
            {summary.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {stale ? <WifiOff className="size-3.5 text-amber-500" /> : <RadioTower className="size-3.5 text-green-600" />}
          {stale ? `No update since ${ago(site.lastSeenAt, now)}. Status may be out of date.` : "Live"}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Areas</h3>
          <ul className="divide-y rounded-md border">
            {site.areas.map((area) => {
              const info = AREA_INFO[area.status];
              const armed = area.status === "armed";
              return (
                <li key={area.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{area.name}</span>
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {ago(area.changedAt, now)}{area.changedBy ? ` by ${area.changedBy}` : ""}
                    </p>
                  </div>
                  <ConfirmDialog
                    title={`${armed ? "Disarm" : "Arm"} ${site.name} ${area.name}?`}
                    description={armed
                      ? "The area will be disarmed straight away."
                      : "Make sure nobody is inside. The exit delay starts once it is armed."}
                    confirmLabel={armed ? "Disarm" : "Arm"}
                    tone={armed ? "destructive" : "default"}
                    onConfirm={() => onSetArea(site, area, armed ? "disarmed" : "armed")}
                    trigger={
                      <Button variant="outline" size="sm" disabled={stale}>
                        {armed ? <ShieldOff /> : <ShieldCheck />}
                        {armed ? "Disarm" : "Arm"}
                      </Button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Doors</h3>
          <ul className="divide-y rounded-md border">
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

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Recent activity</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recent.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {e.text}
                    {e.who && <span className="text-muted-foreground"> · {e.who}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(e.at, now)}</span>
                </li>
              ))}
            </ul>
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

  const run = async (kind: "pulse" | "hold", fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{door.name}</span>
            <Badge tone={info.tone}>{info.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{ago(door.changedAt, now)}</p>
        </div>
      </div>
      {door.canControl ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={busy === "pulse"}
            disabled={disabled || busy !== null || held}
            onClick={() => run("pulse", onPulse)}
          >
            <DoorClosed />
            Unlock
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={busy === "hold"}
            disabled={disabled || busy !== null}
            onClick={() => run("hold", onToggleHold)}
          >
            {held ? <Lock /> : <LockOpen />}
            {held ? "Lock" : "Hold open"}
          </Button>
        </div>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Ban className="size-3.5" />
          View only
        </span>
      )}
    </li>
  );
}
