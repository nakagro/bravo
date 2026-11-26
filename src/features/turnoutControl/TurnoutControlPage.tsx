import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  MapPin,
  Monitor,
  Play,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Square,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toastError } from "@/lib/errors";
import { cn } from "@/lib/utils";

const HEADER_MIN = 10;
const HEADER_MAX = 60;
const DEFAULT_HEADER = {
  single: 35,
  double: 35,
  triple: 40,
} as const;

const SIM_MESSAGE_MAX = 500;
const SIM_ADDRESS_MAX = 200;
const TTL_OPTIONS = [15, 30, 60] as const;
type TtlOption = (typeof TTL_OPTIONS)[number];
type MultiJobOption = 0 | 2 | 3;

const HUB_STALE_AFTER_MS = 5 * 60 * 1000;

interface OverridesDraft {
  isIdleScreenDisabled: boolean;
  forceMultiJobCount: MultiJobOption;
  headerHeightSingle: number | undefined;
  headerHeightDouble: number | undefined;
  headerHeightTriple: number | undefined;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRemaining(expiresAt: number, now: number): string {
  const diffSec = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatAge(ts: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function actionBadge(action: string): { label: string; className: string } {
  switch (action) {
    case "startSimulation":
      return {
        label: "Sim Started",
        className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      };
    case "stopSimulation":
      return {
        label: "Sim Ended",
        className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
      };
    case "expireSimulation":
      return {
        label: "Auto-Expired",
        className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
      };
    case "resetOverrides":
      return {
        label: "Reset",
        className: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
      };
    default:
      return {
        label: "Overrides",
        className: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
      };
  }
}

export function TurnoutControlPage() {
  const state = useQuery(api.turnoutControl.getState, {});
  const updateOverrides = useMutation(api.turnoutControl.updateOverrides);
  const resetOverrides = useMutation(api.turnoutControl.resetOverrides);
  const startSimulation = useMutation(api.turnoutControl.startSimulation);
  const stopSimulation = useMutation(api.turnoutControl.stopSimulation);

  const [now, setNow] = useState(() => Date.now());
  const [busyOverrides, setBusyOverrides] = useState(false);
  const [busySim, setBusySim] = useState(false);

  // Display overrides form state
  const [draft, setDraft] = useState<OverridesDraft>({
    isIdleScreenDisabled: false,
    forceMultiJobCount: 0,
    headerHeightSingle: undefined,
    headerHeightDouble: undefined,
    headerHeightTriple: undefined,
  });

  // Training simulator form state
  const [messageText, setMessageText] = useState("");
  const [address, setAddress] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState<TtlOption>(15);
  const [playAudio, setPlayAudio] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [audioConfirmOpen, setAudioConfirmOpen] = useState(false);

  // Tick every second while a simulation is running, else every 15s for hub age.
  const hasActiveSim = Boolean(state?.activeSimulation);
  useEffect(() => {
    const ms = hasActiveSim ? 1_000 : 15_000;
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [hasActiveSim]);

  // Sync draft whenever server revision changes.
  const serverRevision = state?.revision ?? 0;
  const serverOverrides = state?.overrides;
  useEffect(() => {
    if (!serverOverrides) return;
    setDraft({
      isIdleScreenDisabled: serverOverrides.isIdleScreenDisabled ?? false,
      forceMultiJobCount: serverOverrides.forceMultiJobCount ?? 0,
      headerHeightSingle: serverOverrides.headerHeightSingle,
      headerHeightDouble: serverOverrides.headerHeightDouble,
      headerHeightTriple: serverOverrides.headerHeightTriple,
    });
  }, [serverRevision, serverOverrides]);

  const overridesDirty = useMemo(() => {
    if (!serverOverrides) return false;
    return (
      draft.isIdleScreenDisabled !== (serverOverrides.isIdleScreenDisabled ?? false) ||
      draft.forceMultiJobCount !== (serverOverrides.forceMultiJobCount ?? 0) ||
      draft.headerHeightSingle !== serverOverrides.headerHeightSingle ||
      draft.headerHeightDouble !== serverOverrides.headerHeightDouble ||
      draft.headerHeightTriple !== serverOverrides.headerHeightTriple
    );
  }, [draft, serverOverrides]);

  const hasAnyRemoteOverride = useMemo(() => {
    if (!serverOverrides) return false;
    return (
      serverOverrides.isIdleScreenDisabled !== undefined ||
      serverOverrides.forceMultiJobCount !== undefined ||
      serverOverrides.headerHeightSingle !== undefined ||
      serverOverrides.headerHeightDouble !== undefined ||
      serverOverrides.headerHeightTriple !== undefined
    );
  }, [serverOverrides]);

  if (state === undefined) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (state === null) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-sm text-muted-foreground">
        You do not have access to Turnout Control.
      </div>
    );
  }

  const activeSim = state.activeSimulation;
  const simExpiredLocally = activeSim ? activeSim.expiresAt <= now : false;
  const hubOnline =
    state.hubStatus !== null && now - state.hubStatus.lastSyncAt < HUB_STALE_AFTER_MS;

  const parseCoordinates = (): { latitude: number; longitude: number } | undefined | null => {
    const latTrim = latInput.trim();
    const lngTrim = lngInput.trim();
    if (!latTrim && !lngTrim) return undefined;
    if (!latTrim || !lngTrim) {
      toast.error("Enter both latitude and longitude, or leave both blank for default coordinates.");
      return null;
    }
    const latitude = Number(latTrim);
    const longitude = Number(lngTrim);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      toast.error("Coordinates must be valid numbers (lat -90..90, lng -180..180).");
      return null;
    }
    return { latitude, longitude };
  };

  const executeStartSimulation = async () => {
    const coords = parseCoordinates();
    if (coords === null) return;

    setBusySim(true);
    try {
      await startSimulation({
        messageText,
        address,
        ...(coords ? { coordinates: coords } : {}),
        ttlMinutes,
        playAudio,
      });
      toast.success(
        `Training simulation started (${ttlMinutes}m auto-expire${playAudio ? ", audio ON" : ", silent"})`,
      );
    } catch (err) {
      toastError(err, "Could not start training simulation");
      throw err;
    } finally {
      setBusySim(false);
    }
  };

  const handleSimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !address.trim()) {
      toast.error("Enter both a pager message and an incident address.");
      return;
    }
    const coords = parseCoordinates();
    if (coords === null) return;

    if (playAudio) {
      setAudioConfirmOpen(true);
      return;
    }
    try {
      await executeStartSimulation();
    } catch {
      // Already toasted inside executeStartSimulation.
    }
  };

  const handleStopSimulation = async () => {
    setBusySim(true);
    try {
      const res = await stopSimulation({});
      if (res.wasActive) {
        toast.success("Training simulation ended");
      } else {
        toast.info("No active simulation to end");
      }
    } catch (err) {
      toastError(err, "Could not end training simulation");
    } finally {
      setBusySim(false);
    }
  };

  const handleSaveOverrides = async () => {
    setBusyOverrides(true);
    try {
      const payload = {
        ...(draft.isIdleScreenDisabled ? { isIdleScreenDisabled: true } : {}),
        ...(draft.forceMultiJobCount !== 0 ? { forceMultiJobCount: draft.forceMultiJobCount } : {}),
        ...(draft.headerHeightSingle !== undefined
          ? { headerHeightSingle: draft.headerHeightSingle }
          : {}),
        ...(draft.headerHeightDouble !== undefined
          ? { headerHeightDouble: draft.headerHeightDouble }
          : {}),
        ...(draft.headerHeightTriple !== undefined
          ? { headerHeightTriple: draft.headerHeightTriple }
          : {}),
      };
      await updateOverrides({ overrides: payload });
      toast.success("Display overrides pushed to turnout screen");
    } catch (err) {
      toastError(err, "Could not update display overrides");
    } finally {
      setBusyOverrides(false);
    }
  };

  const handleResetOverrides = async () => {
    setBusyOverrides(true);
    try {
      await resetOverrides({});
      toast.success("Remote display overrides reset to local defaults");
    } catch (err) {
      toastError(err, "Could not reset display overrides");
    } finally {
      setBusyOverrides(false);
    }
  };

  const handleReenableIdleScreen = async () => {
    setBusyOverrides(true);
    try {
      const next = { ...state.overrides };
      delete next.isIdleScreenDisabled;
      await updateOverrides({ overrides: next });
      toast.success("Idle screen re-enabled on turnout display");
    } catch (err) {
      toastError(err, "Could not re-enable idle screen");
    } finally {
      setBusyOverrides(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10" data-component="TurnoutControlPage">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Monitor className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Turnout Control
              </h1>
              <Badge variant="outline" className="text-xs">
                Super Admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Main Station (TURNOUT01) remote display overrides &amp; training job simulator
            </p>
          </div>
        </div>

        {/* Live kiosk-hub status pill */}
        <div
          className={cn(
            "inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium sm:self-auto",
            hubOnline
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
          )}
        >
          {hubOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {state.hubStatus ? (
            <span>
              Hub {hubOnline ? "online" : "stale"} ({formatAge(state.hubStatus.lastSyncAt, now)})
            </span>
          ) : (
            <span>Hub not yet reported</span>
          )}
        </div>
      </div>

      {/* Active Training Simulation Banner */}
      {activeSim && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 shadow-sm dark:bg-amber-950/40 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
                  <AlertTriangle className="size-3.5" />
                  Training Simulation Active
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                  <Clock className="size-3.5" />
                  {simExpiredLocally
                    ? "Expiring..."
                    : `Auto-expires in ${formatRemaining(activeSim.expiresAt, now)}`}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                  {activeSim.playAudio ? (
                    <>
                      <Volume2 className="size-3.5" /> Audio ON
                    </>
                  ) : (
                    <>
                      <VolumeX className="size-3.5" /> Silent
                    </>
                  )}
                </span>
              </div>

              <p className="break-words rounded-md bg-white/80 p-2.5 font-mono text-xs text-gray-900 dark:bg-black/30 dark:text-amber-100">
                {activeSim.messageText}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                <span className="inline-flex items-center gap-1 font-medium">
                  <MapPin className="size-3.5" />
                  {activeSim.address}
                </span>
                {activeSim.coordinates ? (
                  <span className="font-mono">
                    {activeSim.coordinates.latitude.toFixed(5)},{" "}
                    {activeSim.coordinates.longitude.toFixed(5)}
                  </span>
                ) : (
                  <span>Default Werribee test map coords</span>
                )}
                <span>
                  Started by {activeSim.startedByName} at {formatDateTime(activeSim.startedAt)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={busySim}
              onClick={handleStopSimulation}
              className="w-full shrink-0 gap-2 font-semibold sm:w-auto"
            >
              <Square className="size-4 fill-current" />
              {busySim ? "Ending..." : "End Simulation"}
            </Button>
          </div>
        </div>
      )}

      {/* Persistent Idle-Screen-Disabled Warning */}
      {state.overrides.isIdleScreenDisabled && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/60 bg-amber-50/80 p-4 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-sm text-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Idle screen is currently disabled remotely</p>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                TURNOUT01 will remain on the turnout screen until you re-enable the idle screen or
                reset overrides.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busyOverrides}
            onClick={handleReenableIdleScreen}
            className="shrink-0"
          >
            Re-enable Idle Screen
          </Button>
        </div>
      )}

      {/* Safety Guardrails Strip */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="leading-relaxed">
            <span className="font-semibold text-foreground">Emergency safety:</span> Real SAS /
            PDT2000 callouts always preempt training simulations immediately. Simulations never
            trigger CUPS printing, never write to Zabbix/Loki job metrics or ntfy alerts, and
            auto-expire on schedule. The local top-left corner menu remains available offline.
          </p>
        </div>
      </div>

      {/* Main 2-column grid on desktop */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Card 1: Training Job Simulator */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Training Job Simulator</h2>
              <p className="text-xs text-muted-foreground">
                Push a clearly-badged training callout to the turnout screen with auto-expiry.
              </p>
            </div>
            {!activeSim && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Idle
              </span>
            )}
          </div>

          <form onSubmit={handleSimSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sim-message">Pager Message</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {messageText.length}/{SIM_MESSAGE_MAX}
                </span>
              </div>
              <Textarea
                id="sim-message"
                rows={4}
                maxLength={SIM_MESSAGE_MAX}
                placeholder="ALERT WYDV1 G&SC1 STRUCTURE FIRE 45 ISON RD WERRIBEE M 220 A5 WYDVP1 WYDVT1 FGD15"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={busySim}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sim-address">Incident Address</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {address.length}/{SIM_ADDRESS_MAX}
                </span>
              </div>
              <Input
                id="sim-address"
                maxLength={SIM_ADDRESS_MAX}
                placeholder="45 Ison Rd Werribee"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={busySim}
              />
            </div>

            {/* TTL Selector */}
            <div className="space-y-1.5">
              <Label>Auto-Expire Duration</Label>
              <div className="grid grid-cols-3 gap-2">
                {TTL_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={busySim}
                    onClick={() => setTtlMinutes(mins)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
                      ttlMinutes === mins
                        ? "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* Play Audio Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="sim-audio" className="cursor-pointer text-sm font-medium">
                  Play station alert tone (/6.mp3)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Off by default so drills start silently unless you explicitly opt in.
                </p>
              </div>
              <Switch
                id="sim-audio"
                checked={playAudio}
                onCheckedChange={setPlayAudio}
                disabled={busySim}
              />
            </div>

            {/* Optional Coordinates */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCoords((v) => !v)}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {showCoords
                  ? "Hide custom map coordinates"
                  : "Optional: custom map coordinates (defaults to Werribee test pin)"}
              </button>
              {showCoords && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="sim-lat" className="text-xs">
                      Latitude
                    </Label>
                    <Input
                      id="sim-lat"
                      type="number"
                      step="any"
                      placeholder="-37.89123"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      disabled={busySim}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sim-lng" className="text-xs">
                      Longitude
                    </Label>
                    <Input
                      id="sim-lng"
                      type="number"
                      step="any"
                      placeholder="144.62346"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      disabled={busySim}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={busySim || !messageText.trim() || !address.trim()}
              className="w-full gap-2 bg-amber-600 text-white hover:bg-amber-500"
            >
              <Play className="size-4 fill-current" />
              {busySim
                ? "Starting..."
                : activeSim
                  ? "Replace Active Simulation"
                  : "Start Training Simulation"}
            </Button>
          </form>
        </section>

        {/* Card 2: Display Overrides */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Sliders className="size-4 text-muted-foreground" />
                Display Overrides
              </h2>
              <p className="text-xs text-muted-foreground">
                Applied in-memory on top of TURNOUT01 local defaults. Clearing restores local
                settings.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums text-xs">
              Rev #{state.revision}
            </Badge>
          </div>

          <div className="space-y-5">
            {/* Disable Idle Screen */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="override-idle" className="cursor-pointer text-sm font-medium">
                  Disable Idle Screen
                </Label>
                <p className="text-xs text-muted-foreground">
                  Keep the turnout screen visible instead of returning to idle after 30 minutes.
                </p>
              </div>
              <Switch
                id="override-idle"
                checked={draft.isIdleScreenDisabled}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, isIdleScreenDisabled: checked }))
                }
                disabled={busyOverrides}
              />
            </div>

            {/* Force Multi-Job */}
            <div className="space-y-1.5">
              <Label>Force Multi-Job Layout</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 0, label: "Off (Auto)" },
                    { value: 2, label: "Double (2)" },
                    { value: 3, label: "Triple (3)" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busyOverrides}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, forceMultiJobCount: opt.value }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      draft.forceMultiJobCount === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Header Height Sliders */}
            <div className="space-y-3 rounded-lg border border-border p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Header Height %</span>
                <span className="text-xs text-muted-foreground">Range {HEADER_MIN}-{HEADER_MAX}%</span>
              </div>

              {(
                [
                  {
                    key: "headerHeightSingle",
                    label: "Single Job",
                    fallback: DEFAULT_HEADER.single,
                  },
                  {
                    key: "headerHeightDouble",
                    label: "Double Job",
                    fallback: DEFAULT_HEADER.double,
                  },
                  {
                    key: "headerHeightTriple",
                    label: "Triple Job",
                    fallback: DEFAULT_HEADER.triple,
                  },
                ] as const
              ).map(({ key, label, fallback }) => {
                const rawValue = draft[key];
                const isOverridden = rawValue !== undefined;
                const displayValue = rawValue ?? fallback;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor={`slider-${key}`} className="text-xs font-medium">
                        {label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                          {displayValue}%
                        </span>
                        {isOverridden ? (
                          <button
                            type="button"
                            disabled={busyOverrides}
                            onClick={() => setDraft((prev) => ({ ...prev, [key]: undefined }))}
                            className="text-[11px] text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
                          >
                            clear
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">default</span>
                        )}
                      </div>
                    </div>
                    <input
                      id={`slider-${key}`}
                      type="range"
                      min={HEADER_MIN}
                      max={HEADER_MAX}
                      step={1}
                      value={displayValue}
                      disabled={busyOverrides}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="h-2 w-full cursor-pointer accent-amber-600"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                disabled={busyOverrides || !overridesDirty}
                onClick={handleSaveOverrides}
                className="flex-1"
              >
                {busyOverrides ? "Saving..." : "Apply Overrides"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyOverrides || (!hasAnyRemoteOverride && !overridesDirty)}
                onClick={handleResetOverrides}
                className="gap-1.5"
              >
                <RotateCcw className="size-4" />
                Reset Remote Overrides
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Audit Trail */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <History className="size-4 text-muted-foreground" />
            Recent Activity
          </h2>
          {state.updatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Last updated {formatDateTime(state.updatedAt)}
              {state.updatedByName ? ` by ${state.updatedByName}` : ""}
            </span>
          )}
        </div>

        {state.recentAudit.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No turnout control changes recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {state.recentAudit.map((entry) => {
              const badge = actionBadge(entry.action);
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded px-2 py-0.5 text-[11px] font-semibold",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                    <span className="font-medium text-foreground">{entry.summary}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-muted-foreground tabular-nums">
                    <span>{entry.actorName}</span>
                    <span>·</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                    <span>·</span>
                    <span>#{entry.revision}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Extra confirmation when alert audio is opted in */}
      <ConfirmDialog
        open={audioConfirmOpen}
        onOpenChange={setAudioConfirmOpen}
        title="Start training simulation with alert audio?"
        description="This will play the station alert tone (/6.mp3) on TURNOUT01 when the training screen opens. Real emergencies will still preempt immediately."
        confirmLabel="Start With Audio"
        onConfirm={executeStartSimulation}
      />
    </div>
  );
}
