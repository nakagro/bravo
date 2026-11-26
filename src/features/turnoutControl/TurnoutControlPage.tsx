import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Loader2,
  MapPin,
  Play,
  RotateCcw,
  Search,
  Sliders,
  Square,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
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

interface QuickAddress {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

const QUICK_ADDRESSES: QuickAddress[] = [
  {
    label: "Main Station",
    address: "Wyndham Vale Fire Station, 85 Manor Lakes Blvd, Wyndham Vale",
    latitude: -37.87186,
    longitude: 144.609538,
  },
  {
    label: "Satellite Station",
    address: "Wyndham Vale Satellite Station, Werribee",
    latitude: -37.89685,
    longitude: 144.623158,
  },
  {
    label: "45 Ison Rd",
    address: "45 Ison Rd, Werribee",
    latitude: -37.89123,
    longitude: 144.62346,
  },
];

interface DrillTemplate {
  label: string;
  buildMessage: (address: string) => string;
}

const DRILL_TEMPLATES: DrillTemplate[] = [
  {
    label: "Structure Fire",
    buildMessage: (addr) =>
      `ALERT WYDV1 G&SC1 STRUCTURE FIRE ${(addr || "45 ISON RD WERRIBEE").toUpperCase()} WYDVP1 WYDVT1 FGD15`,
  },
  {
    label: "Grass & Scrub",
    buildMessage: (addr) =>
      `ALERT WYDV1 G&SC1 GRASS & SCRUB FIRE ${(addr || "45 ISON RD WERRIBEE").toUpperCase()} WYDVT1 WYDVFC FGD15`,
  },
  {
    label: "MVA",
    buildMessage: (addr) =>
      `ALERT WYDV1 INC1 MOTOR VEHICLE ACCIDENT ${(addr || "45 ISON RD WERRIBEE").toUpperCase()} WYDVP1 FGD15`,
  },
  {
    label: "Alarm",
    buildMessage: (addr) =>
      `ALERT WYDV1 ALAR1 FIRE ALARM ${(addr || "45 ISON RD WERRIBEE").toUpperCase()} WYDVP1 FGD15`,
  },
];

interface AddressSuggestion {
  shortAddress: string;
  label: string;
  latitude: number;
  longitude: number;
}

interface HeightsDraft {
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
        label: "Started",
        className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      };
    case "stopSimulation":
      return {
        label: "Ended",
        className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
      };
    case "expireSimulation":
      return {
        label: "Expired",
        className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
      };
    case "resetOverrides":
      return {
        label: "Reset",
        className: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
      };
    default:
      return {
        label: "Display",
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
  const searchAddress = useAction(api.turnoutControl.searchAddress);

  const [now, setNow] = useState(() => Date.now());
  const [busyOverrides, setBusyOverrides] = useState(false);
  const [busySim, setBusySim] = useState(false);

  // Training simulator form state
  const [address, setAddress] = useState("");
  const [messageText, setMessageText] = useState("");
  const [lastAutoTemplate, setLastAutoTemplate] = useState<string | null>(null);
  const [ttlMinutes, setTtlMinutes] = useState<TtlOption>(15);
  const [playAudio, setPlayAudio] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [showCustomCoords, setShowCustomCoords] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [audioConfirmOpen, setAudioConfirmOpen] = useState(false);

  // Address lookup state
  const [searchingAddr, setSearchingAddr] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchSeqRef = useRef(0);
  const skipNextSearchRef = useRef(false);

  // Advanced header height sliders (kept collapsed unless overridden)
  const [heightsDraft, setHeightsDraft] = useState<HeightsDraft>({
    headerHeightSingle: undefined,
    headerHeightDouble: undefined,
    headerHeightTriple: undefined,
  });
  const [heightsOpen, setHeightsOpen] = useState(false);
  const [showAllAudit, setShowAllAudit] = useState(false);

  const hasActiveSim = Boolean(state?.activeSimulation);
  useEffect(() => {
    const ms = hasActiveSim ? 1_000 : 15_000;
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [hasActiveSim]);

  const serverRevision = state?.revision ?? 0;
  const serverOverrides = state?.overrides;
  useEffect(() => {
    if (!serverOverrides) return;
    setHeightsDraft({
      headerHeightSingle: serverOverrides.headerHeightSingle,
      headerHeightDouble: serverOverrides.headerHeightDouble,
      headerHeightTriple: serverOverrides.headerHeightTriple,
    });
    if (
      serverOverrides.headerHeightSingle !== undefined ||
      serverOverrides.headerHeightDouble !== undefined ||
      serverOverrides.headerHeightTriple !== undefined
    ) {
      setHeightsOpen(true);
    }
  }, [serverRevision, serverOverrides]);

  // Debounced address search as user types (skip when programmatically filled).
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const q = address.trim();
    if (q.length < 4) {
      setSuggestions([]);
      setSearchingAddr(false);
      return;
    }
    const seq = ++searchSeqRef.current;
    const timer = setTimeout(async () => {
      setSearchingAddr(true);
      try {
        const results = await searchAddress({ query: q });
        if (searchSeqRef.current === seq) {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch {
        if (searchSeqRef.current === seq) {
          setSuggestions([]);
        }
      } finally {
        if (searchSeqRef.current === seq) {
          setSearchingAddr(false);
        }
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [address, searchAddress]);

  const heightsDirty = useMemo(() => {
    if (!serverOverrides) return false;
    return (
      heightsDraft.headerHeightSingle !== serverOverrides.headerHeightSingle ||
      heightsDraft.headerHeightDouble !== serverOverrides.headerHeightDouble ||
      heightsDraft.headerHeightTriple !== serverOverrides.headerHeightTriple
    );
  }, [heightsDraft, serverOverrides]);

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

  const applyAddressChoice = (nextAddress: string, coords: { latitude: number; longitude: number }) => {
    skipNextSearchRef.current = true;
    setAddress(nextAddress);
    setPinnedCoords(coords);
    setLatInput(coords.latitude.toFixed(5));
    setLngInput(coords.longitude.toFixed(5));
    setSuggestions([]);
    setShowSuggestions(false);

    // If the user has not typed a custom message yet, keep the template synced to the chosen address.
    if (!messageText.trim() || lastAutoTemplate !== null) {
      const tpl =
        DRILL_TEMPLATES.find((t) => t.label === lastAutoTemplate) ?? DRILL_TEMPLATES[0];
      setMessageText(tpl.buildMessage(nextAddress));
      setLastAutoTemplate(tpl.label);
    }
  };

  const applyDrillTemplate = (tpl: DrillTemplate) => {
    setMessageText(tpl.buildMessage(address.trim()));
    setLastAutoTemplate(tpl.label);
  };

  const handleManualAddressLookup = async () => {
    const q = address.trim();
    if (q.length < 3) {
      toast.error("Type at least 3 characters to search an address.");
      return;
    }
    const seq = ++searchSeqRef.current;
    setSearchingAddr(true);
    try {
      const results = await searchAddress({ query: q });
      if (searchSeqRef.current === seq) {
        setSuggestions(results);
        setShowSuggestions(true);
        if (results.length === 0) {
          toast.info("No matching local addresses found. You can still start with the typed address.");
        }
      }
    } catch (err) {
      toastError(err, "Address lookup failed");
    } finally {
      if (searchSeqRef.current === seq) {
        setSearchingAddr(false);
      }
    }
  };

  const resolveCoordinates = (): { latitude: number; longitude: number } | undefined | null => {
    if (showCustomCoords) {
      const latTrim = latInput.trim();
      const lngTrim = lngInput.trim();
      if (!latTrim && !lngTrim) return undefined;
      if (!latTrim || !lngTrim) {
        toast.error("Enter both latitude and longitude, or clear both.");
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
    }
    return pinnedCoords ?? undefined;
  };

  const executeStartSimulation = async () => {
    const coords = resolveCoordinates();
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
        `Training drill started (${ttlMinutes}m${playAudio ? ", alert tone ON" : ", silent"})`,
      );
    } catch (err) {
      toastError(err, "Could not start training drill");
      throw err;
    } finally {
      setBusySim(false);
    }
  };

  const handleSimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !messageText.trim()) {
      toast.error("Pick or enter an address and pager message.");
      return;
    }
    const coords = resolveCoordinates();
    if (coords === null) return;

    if (playAudio) {
      setAudioConfirmOpen(true);
      return;
    }
    try {
      await executeStartSimulation();
    } catch {
      // Already toasted.
    }
  };

  const handleStopSimulation = async () => {
    setBusySim(true);
    try {
      const res = await stopSimulation({});
      if (res.wasActive) {
        toast.success("Training drill ended");
      } else {
        toast.info("No active drill to end");
      }
    } catch (err) {
      toastError(err, "Could not end training drill");
    } finally {
      setBusySim(false);
    }
  };

  // Immediate save helper for 1-tap display toggles (Idle Screen & Multi-Job).
  const patchDisplayOverrides = async (
    patch: Partial<{
      isIdleScreenDisabled: boolean | undefined;
      forceMultiJobCount: MultiJobOption | undefined;
      headerHeightSingle: number | undefined;
      headerHeightDouble: number | undefined;
      headerHeightTriple: number | undefined;
    }>,
    successMessage: string,
  ) => {
    setBusyOverrides(true);
    try {
      const merged = {
        ...state.overrides,
        ...patch,
      };
      const payload = {
        ...(merged.isIdleScreenDisabled ? { isIdleScreenDisabled: true } : {}),
        ...(merged.forceMultiJobCount === 2 || merged.forceMultiJobCount === 3
          ? { forceMultiJobCount: merged.forceMultiJobCount }
          : {}),
        ...(merged.headerHeightSingle !== undefined
          ? { headerHeightSingle: merged.headerHeightSingle }
          : {}),
        ...(merged.headerHeightDouble !== undefined
          ? { headerHeightDouble: merged.headerHeightDouble }
          : {}),
        ...(merged.headerHeightTriple !== undefined
          ? { headerHeightTriple: merged.headerHeightTriple }
          : {}),
      };
      await updateOverrides({ overrides: payload });
      toast.success(successMessage);
    } catch (err) {
      toastError(err, "Could not update display setting");
    } finally {
      setBusyOverrides(false);
    }
  };

  const handleResetOverrides = async () => {
    setBusyOverrides(true);
    try {
      await resetOverrides({});
      toast.success("Display settings reset to defaults");
    } catch (err) {
      toastError(err, "Could not reset display settings");
    } finally {
      setBusyOverrides(false);
    }
  };

  const idleDisabled = state.overrides.isIdleScreenDisabled === true;
  const activeMultiJob: MultiJobOption = state.overrides.forceMultiJobCount ?? 0;
  const visibleAudit = showAllAudit ? state.recentAudit : state.recentAudit.slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-10" data-component="TurnoutControlPage">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Turnout Control</h1>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            hubOnline
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
          )}
        >
          {hubOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {state.hubStatus ? (
            <span>{hubOnline ? "Hub online" : `Hub stale (${formatAge(state.hubStatus.lastSyncAt, now)})`}</span>
          ) : (
            <span>Hub offline</span>
          )}
        </div>
      </div>

      {/* Active Training Drill Banner */}
      {activeSim && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 shadow-sm dark:bg-amber-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
                  <AlertTriangle className="size-3.5" />
                  For Training Purposes Only
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                  <Clock className="size-3.5" />
                  {simExpiredLocally
                    ? "Expiring..."
                    : `${formatRemaining(activeSim.expiresAt, now)} left`}
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

              <p className="break-words rounded-md bg-white/80 p-2 font-mono text-xs text-gray-900 dark:bg-black/30 dark:text-amber-100">
                {activeSim.messageText}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                <span className="inline-flex items-center gap-1 font-medium">
                  <MapPin className="size-3.5" />
                  {activeSim.address}
                </span>
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
              {busySim ? "Ending..." : "End Drill"}
            </Button>
          </div>
        </div>
      )}

      {/* Persistent Idle-Screen-Disabled Banner */}
      {idleDisabled && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/60 bg-amber-50/80 px-4 py-3 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-950 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Idle screen is disabled on TURNOUT01</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busyOverrides}
            onClick={() =>
              patchDisplayOverrides(
                { isIdleScreenDisabled: undefined },
                "Idle screen re-enabled",
              )
            }
            className="shrink-0"
          >
            Re-enable Idle Screen
          </Button>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left (wider): Training Drill Simulator */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-7">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Training Job Simulator</h2>
            {!activeSim && (
              <span className="text-xs font-medium text-muted-foreground">Idle</span>
            )}
          </div>

          <form onSubmit={handleSimSubmit} className="space-y-4">
            {/* Step 1: Quick Address + Live Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sim-address">Address</Label>
                {pinnedCoords ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="size-3.5" /> Map pin ready
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Search or tap a quick location</span>
                )}
              </div>

              <div className="relative">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      id="sim-address"
                      maxLength={SIM_ADDRESS_MAX}
                      placeholder="Search street or suburb (e.g. 45 Ison Rd Werribee)"
                      value={address}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setPinnedCoords(null);
                      }}
                      disabled={busySim}
                      className="pr-8"
                    />
                    {address && (
                      <button
                        type="button"
                        aria-label="Clear address"
                        onClick={() => {
                          skipNextSearchRef.current = true;
                          setAddress("");
                          setPinnedCoords(null);
                          setSuggestions([]);
                          setShowSuggestions(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Look up address"
                    disabled={busySim || searchingAddr || address.trim().length < 3}
                    onClick={handleManualAddressLookup}
                    className="shrink-0"
                  >
                    {searchingAddr ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </Button>
                </div>

                {/* Autocomplete results */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                    <ul className="divide-y divide-border">
                      {suggestions.map((s) => (
                        <li key={`${s.latitude},${s.longitude},${s.shortAddress}`}>
                          <button
                            type="button"
                            onClick={() =>
                              applyAddressChoice(s.shortAddress, {
                                latitude: s.latitude,
                                longitude: s.longitude,
                              })
                            }
                            className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                          >
                            <MapPin className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {s.shortAddress}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {s.label}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 1-tap Quick Locations */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ADDRESSES.map((loc) => {
                  const selected = address === loc.address;
                  return (
                    <button
                      key={loc.label}
                      type="button"
                      disabled={busySim}
                      onClick={() =>
                        applyAddressChoice(loc.address, {
                          latitude: loc.latitude,
                          longitude: loc.longitude,
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted",
                      )}
                    >
                      <MapPin className="size-3 text-amber-600 dark:text-amber-400" />
                      {loc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Pager Message + Quick Drill Type Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sim-message">Pager Message</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {messageText.length}/{SIM_MESSAGE_MAX}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DRILL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    disabled={busySim}
                    onClick={() => applyDrillTemplate(tpl)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                      lastAutoTemplate === tpl.label
                        ? "border-amber-500/70 bg-amber-100/80 text-amber-950 dark:bg-amber-900/30 dark:text-amber-100"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <Textarea
                id="sim-message"
                rows={3}
                maxLength={SIM_MESSAGE_MAX}
                placeholder="Tap a drill type above or enter a custom pager message"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  setLastAutoTemplate(null);
                }}
                disabled={busySim}
                className="font-mono text-xs"
              />
            </div>

            {/* Step 3: Duration + Alert Tone */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Auto-clear after</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TTL_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={busySim}
                      onClick={() => setTtlMinutes(mins)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-semibold tabular-nums transition-colors",
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

              <div className="space-y-1.5">
                <Label htmlFor="sim-audio">Alert tone</Label>
                <div className="flex h-[38px] items-center justify-between rounded-lg border border-border bg-muted/30 px-3">
                  <span className="text-xs font-medium text-foreground">
                    {playAudio ? "Plays on station speakers" : "Silent (default)"}
                  </span>
                  <Switch
                    id="sim-audio"
                    checked={playAudio}
                    onCheckedChange={setPlayAudio}
                    disabled={busySim}
                  />
                </div>
              </div>
            </div>

            {/* Optional manual coordinates */}
            <div>
              <button
                type="button"
                onClick={() => setShowCustomCoords((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showCustomCoords ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                Manual coordinates
              </button>
              {showCustomCoords && (
                <div className="mt-2 grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
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
                  ? "Replace Active Drill"
                  : "Start Training Drill"}
            </Button>
          </form>
        </section>

        {/* Right: Display Controls (Instant Toggles + Collapsible Heights) */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-5">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Sliders className="size-4 text-muted-foreground" />
              Display Controls
            </h2>
            {hasAnyRemoteOverride && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyOverrides}
                onClick={handleResetOverrides}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {/* Instant Toggle: Disable Idle Screen */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="override-idle" className="cursor-pointer text-sm font-medium">
                  Disable Idle Screen
                </Label>
                <p className="text-xs text-muted-foreground">
                  Keep turnout screen open past 30 min.
                </p>
              </div>
              <Switch
                id="override-idle"
                checked={idleDisabled}
                disabled={busyOverrides}
                onCheckedChange={(checked) =>
                  patchDisplayOverrides(
                    { isIdleScreenDisabled: checked ? true : undefined },
                    checked ? "Idle screen disabled" : "Idle screen re-enabled",
                  )
                }
              />
            </div>

            {/* Instant Selector: Force Multi-Job Layout */}
            <div className="space-y-1.5">
              <Label>Multi-Job Layout</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { value: 0, label: "Auto" },
                    { value: 2, label: "Double" },
                    { value: 3, label: "Triple" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busyOverrides}
                    onClick={() =>
                      patchDisplayOverrides(
                        { forceMultiJobCount: opt.value === 0 ? undefined : opt.value },
                        opt.value === 0
                          ? "Multi-job layout set to Auto"
                          : `Multi-job layout forced to ${opt.label}`,
                      )
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                      activeMultiJob === opt.value
                        ? "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapsible Header Heights */}
            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setHeightsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-foreground hover:bg-muted/40"
              >
                <span>Header Height %</span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  {state.overrides.headerHeightSingle !== undefined ||
                  state.overrides.headerHeightDouble !== undefined ||
                  state.overrides.headerHeightTriple !== undefined
                    ? "Custom"
                    : "Defaults"}
                  {heightsOpen ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </span>
              </button>

              {heightsOpen && (
                <div className="space-y-3 border-t border-border p-3.5">
                  {(
                    [
                      {
                        key: "headerHeightSingle",
                        label: "Single",
                        fallback: DEFAULT_HEADER.single,
                      },
                      {
                        key: "headerHeightDouble",
                        label: "Double",
                        fallback: DEFAULT_HEADER.double,
                      },
                      {
                        key: "headerHeightTriple",
                        label: "Triple",
                        fallback: DEFAULT_HEADER.triple,
                      },
                    ] as const
                  ).map(({ key, label, fallback }) => {
                    const rawValue = heightsDraft[key];
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
                                onClick={() =>
                                  setHeightsDraft((prev) => ({ ...prev, [key]: undefined }))
                                }
                                className="text-[11px] text-amber-700 hover:underline dark:text-amber-300"
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
                            setHeightsDraft((prev) => ({
                              ...prev,
                              [key]: Number(e.target.value),
                            }))
                          }
                          className="h-2 w-full cursor-pointer accent-amber-600"
                        />
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    size="sm"
                    disabled={busyOverrides || !heightsDirty}
                    onClick={() =>
                      patchDisplayOverrides(
                        {
                          headerHeightSingle: heightsDraft.headerHeightSingle,
                          headerHeightDouble: heightsDraft.headerHeightDouble,
                          headerHeightTriple: heightsDraft.headerHeightTriple,
                        },
                        "Header heights updated",
                      )
                    }
                    className="w-full"
                  >
                    {busyOverrides ? "Saving..." : "Apply Heights"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Compact Recent Activity */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="size-4 text-muted-foreground" />
            Recent Activity
          </h2>
          {state.recentAudit.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllAudit((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showAllAudit ? "Show less" : `Show all (${state.recentAudit.length})`}
            </button>
          )}
        </div>

        {visibleAudit.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleAudit.map((entry) => {
              const badge = actionBadge(entry.action);
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                    <span className="text-foreground">{entry.summary}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground tabular-nums">
                    <span>{entry.actorName}</span>
                    <span>·</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Subtle 1-line Safety Footnote */}
      <p className="text-center text-xs text-muted-foreground">
        Real emergencies always override training drills. No printing, alerts, or job metrics are
        triggered.
      </p>

      {/* Extra confirmation when alert audio is opted in */}
      <ConfirmDialog
        open={audioConfirmOpen}
        onOpenChange={setAudioConfirmOpen}
        title="Start drill with station alert tone?"
        description="This will play the alert tone on TURNOUT01 when the drill starts. Real emergencies still override immediately."
        confirmLabel="Start With Audio"
        onConfirm={executeStartSimulation}
      />
    </div>
  );
}
