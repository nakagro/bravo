import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { toastError } from "@/lib/errors";
import { ago, type Area, type Door, type Site } from "../model";

interface ControlsSettingsProps {
  open: boolean;
  onClose: () => void;
  sites: Site[];
  activeSiteId?: string;
  now: number;
}

function targetControlHint(target: Pick<Area | Door, "canControl" | "bridgeCanControl" | "controlOverride">): string {
  if (target.controlOverride === true && !target.bridgeCanControl) {
    return "On in BRAVO · bridge reports view-only";
  }
  if (target.controlOverride === false && target.bridgeCanControl) {
    return "Off in BRAVO · view-only";
  }
  if (target.controlOverride === true) {
    return "On in BRAVO";
  }
  if (target.controlOverride === false) {
    return "Off in BRAVO";
  }
  return target.canControl ? "On · bridge default" : "View-only · bridge default";
}

/**
 * Managers' per-station and per-door/area switches for remote control.
 * Station off is the emergency stop, so it happens on the tap (and cancels
 * anything queued); turning a station on asks first. Individual area and door
 * toggles override the bridge's `canControl` flag directly inside BRAVO.
 */
export function ControlsSettings({ open, onClose, sites, activeSiteId, now }: ControlsSettingsProps) {
  const setSiteControls = useMutation(api.accessControl.setSiteControls);
  const setTargetControl = useMutation(api.accessControl.setTargetControl);
  const resetSiteTargetControls = useMutation(api.accessControl.resetSiteTargetControls);

  const [selectedSiteId, setSelectedSiteId] = useState<string>(activeSiteId || sites[0]?.id || "");
  const [confirmOn, setConfirmOn] = useState<Site | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (activeSiteId && sites.some((s) => s.id === activeSiteId)) {
        setSelectedSiteId(activeSiteId);
      } else if (sites[0]) {
        setSelectedSiteId(sites[0].id);
      }
    }
  }, [open, activeSiteId, sites]);

  const currentSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0];

  const turnOffSite = async (site: Site) => {
    const key = `site:${site.id}`;
    setBusyKey(key);
    try {
      await setSiteControls({ siteId: site.id, enabled: false });
      toast.success(`Remote control turned off for ${site.name}`);
    } catch (err) {
      toastError(err, "Could not turn remote control off");
    } finally {
      setBusyKey(null);
    }
  };

  const toggleTarget = async (
    site: Site,
    targetKind: "area" | "door",
    target: Area | Door,
    enabled: boolean,
  ) => {
    const key = `${site.id}:${targetKind}:${target.id}`;
    setBusyKey(key);
    try {
      await setTargetControl({
        siteId: site.id,
        targetKind,
        targetId: target.id,
        enabled,
      });
      toast.success(`${target.name} control turned ${enabled ? "on" : "off"}`);
    } catch (err) {
      toastError(err, `Could not update ${target.name}`);
    } finally {
      setBusyKey(null);
    }
  };

  const resetOverrides = async (site: Site) => {
    const key = `reset:${site.id}`;
    setBusyKey(key);
    try {
      await resetSiteTargetControls({ siteId: site.id });
      toast.success(`Reset ${site.name} controls to bridge defaults`);
    } catch (err) {
      toastError(err, "Could not reset controls");
    } finally {
      setBusyKey(null);
    }
  };

  const hasOverrides = currentSite
    ? currentSite.areas.some((a) => a.controlOverride !== undefined) ||
      currentSite.doors.some((d) => d.controlOverride !== undefined)
    : false;

  return (
    <>
      <ResponsiveModal
        open={open}
        onClose={onClose}
        title="Remote control"
        drawerHeight="h-auto max-h-[90vh]"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            {currentSite && hasOverrides ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busyKey === `reset:${currentSite.id}`}
                onClick={() => void resetOverrides(currentSite)}
              >
                <RotateCcw className="size-3.5" />
                Reset overrides
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {sites.length > 1 && currentSite && (
            <SegmentedTabs
              ariaLabel="Station settings"
              value={currentSite.id}
              onChange={setSelectedSiteId}
              segments={sites.map((s) => ({
                key: s.id,
                label: s.name.replace(/ Station$/, ""),
              }))}
            />
          )}

          {currentSite && (
            <>
              {/* Master station toggle */}
              <div className="space-y-2">
                <Field orientation="horizontal" className="rounded-xl border border-border px-3 py-3">
                  <FieldContent className="min-w-0">
                    <FieldLabel htmlFor={`controls-${currentSite.id}`}>{currentSite.name}</FieldLabel>
                    <FieldDescription className="text-xs">
                      {currentSite.controlsChangedBy && currentSite.controlsChangedAt
                        ? `${currentSite.controlsEnabled ? "On" : "Off"} · ${currentSite.controlsChangedBy}, ${ago(currentSite.controlsChangedAt, now)}`
                        : "Off until turned on"}
                    </FieldDescription>
                    {currentSite.bravoWritesDisabled && (
                      <FieldDescription className="text-xs font-medium text-foreground">
                        Switched off on the BRAVO server. This switch has no effect until that is lifted.
                      </FieldDescription>
                    )}
                  </FieldContent>
                  <Switch
                    id={`controls-${currentSite.id}`}
                    checked={currentSite.controlsEnabled}
                    disabled={busyKey === `site:${currentSite.id}`}
                    onCheckedChange={(on) => (on ? setConfirmOn(currentSite) : void turnOffSite(currentSite))}
                  />
                </Field>
                <p className="px-1 text-xs text-muted-foreground">
                  {currentSite.controlsEnabled
                    ? "Turning this off stops all remote actions for this station immediately and cancels anything queued."
                    : "Station remote control is currently off. Changes to areas and doors below are saved and take effect once turned on."}
                </p>
              </div>

              {/* Per-area switches */}
              {currentSite.areas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Alarm areas
                  </h3>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {currentSite.areas.map((area) => {
                      const key = `${currentSite.id}:area:${area.id}`;
                      return (
                        <Field key={area.id} orientation="horizontal" className="px-3 py-2.5">
                          <FieldContent className="min-w-0">
                            <FieldLabel htmlFor={`area-ctrl-${area.id}`} className="text-sm font-medium">
                              {area.name}
                            </FieldLabel>
                            <FieldDescription className="text-xs">
                              {targetControlHint(area)}
                            </FieldDescription>
                          </FieldContent>
                          <Switch
                            id={`area-ctrl-${area.id}`}
                            checked={area.canControl}
                            disabled={busyKey === key}
                            onCheckedChange={(on) => void toggleTarget(currentSite, "area", area, on)}
                          />
                        </Field>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-door switches */}
              {currentSite.doors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Doors
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {currentSite.doors.filter((d) => d.canControl).length} of {currentSite.doors.length} controllable
                    </span>
                  </div>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {currentSite.doors.map((door) => {
                      const key = `${currentSite.id}:door:${door.id}`;
                      return (
                        <Field key={door.id} orientation="horizontal" className="px-3 py-2.5">
                          <FieldContent className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FieldLabel htmlFor={`door-ctrl-${door.id}`} className="truncate text-sm font-medium">
                                {door.name}
                              </FieldLabel>
                              {door.kind === "roller" && (
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  Roller
                                </Badge>
                              )}
                            </div>
                            <FieldDescription className="text-xs">
                              {targetControlHint(door)}
                            </FieldDescription>
                          </FieldContent>
                          <Switch
                            id={`door-ctrl-${door.id}`}
                            checked={door.canControl}
                            disabled={busyKey === key}
                            onCheckedChange={(on) => void toggleTarget(currentSite, "door", door, on)}
                          />
                        </Field>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={confirmOn !== null}
        onOpenChange={(o) => !o && setConfirmOn(null)}
        title={`Turn on remote control for ${confirmOn?.name ?? "this station"}?`}
        description="Members with access to Access Control will be able to arm, disarm and open enabled doors at this station from BRAVO."
        confirmLabel="Turn on"
        onConfirm={async () => {
          if (!confirmOn) return;
          try {
            await setSiteControls({ siteId: confirmOn.id, enabled: true });
          } catch (err) {
            toastError(err, "Could not turn remote control on");
            throw err;
          }
        }}
      />
    </>
  );
}
