import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { toastError } from "@/lib/errors";
import { ago, type Site } from "../model";

interface ControlsSettingsProps {
  open: boolean;
  onClose: () => void;
  sites: Site[];
  now: number;
}

/**
 * Admins' per-station switch for remote control. Off is the emergency stop, so
 * it happens on the tap (and cancels anything queued); on asks first.
 */
export function ControlsSettings({ open, onClose, sites, now }: ControlsSettingsProps) {
  const setSiteControls = useMutation(api.accessControl.setSiteControls);
  const [confirmOn, setConfirmOn] = useState<Site | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const turnOff = async (site: Site) => {
    setBusy(site.id);
    try {
      await setSiteControls({ siteId: site.id, enabled: false });
      toast.success(`Remote control turned off for ${site.name}`);
    } catch (err) {
      toastError(err, "Could not turn remote control off");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={open}
        onClose={onClose}
        title="Remote control"
        drawerHeight="h-auto max-h-[90vh]"
        footer={
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            When a station is off, members see its status but can't arm, disarm or open anything from BRAVO.
            Turning it off cancels anything still waiting to be sent.
          </p>
          {sites.map((site) => (
            <Field key={site.id} orientation="horizontal" className="rounded-xl border border-border px-3 py-3">
              <FieldContent className="min-w-0">
                <FieldLabel htmlFor={`controls-${site.id}`}>{site.name}</FieldLabel>
                <FieldDescription className="text-xs">
                  {site.controlsChangedBy && site.controlsChangedAt
                    ? `${site.controlsEnabled ? "On" : "Off"} · ${site.controlsChangedBy}, ${ago(site.controlsChangedAt, now)}`
                    : "Off until turned on"}
                </FieldDescription>
              </FieldContent>
              <Switch
                id={`controls-${site.id}`}
                checked={site.controlsEnabled}
                disabled={busy === site.id}
                onCheckedChange={(on) => (on ? setConfirmOn(site) : void turnOff(site))}
              />
            </Field>
          ))}
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={confirmOn !== null}
        onOpenChange={(o) => !o && setConfirmOn(null)}
        title={`Turn on remote control for ${confirmOn?.name ?? "this station"}?`}
        description="Members with access to Access Control will be able to arm, disarm and open doors at this station from BRAVO."
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
