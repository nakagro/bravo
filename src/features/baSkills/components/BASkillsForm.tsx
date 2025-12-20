import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, UserPlus } from "lucide-react";

interface BASkillsFormProps {
  onSuccess?: () => void;
}

export function BASkillsForm({ onSuccess }: BASkillsFormProps) {
  const currentUser = useQuery(api.baSkills.getCurrentUser);
  const allMembers = useQuery(api.baSkills.getAllMembers);
  const createRecord = useMutation(api.baSkills.createBASkillsRecord);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [memberId, setMemberId] = useState<Id<"users"> | null>(null);
  const [dateUsed, setDateUsed] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [durationMinutes, setDurationMinutes] = useState("");
  const [usageType, setUsageType] = useState<"firecall" | "drill">("firecall");
  const [location, setLocation] = useState("");
  const [verifiedBy, setVerifiedBy] = useState<Id<"users"> | null>(null);

  // Set default member to current user when loaded
  useEffect(() => {
    if (currentUser && !memberId && !isOnBehalf) {
      setMemberId(currentUser._id);
    }
  }, [currentUser, memberId, isOnBehalf]);

  // Reset member selection when toggling on-behalf mode
  useEffect(() => {
    if (!isOnBehalf && currentUser) {
      setMemberId(currentUser._id);
    } else if (isOnBehalf) {
      setMemberId(null);
    }
  }, [isOnBehalf, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!memberId) {
      return;
    }

    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      return;
    }

    if (!location.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createRecord({
        memberId,
        dateUsed,
        durationMinutes: duration,
        usageType,
        location: location.trim(),
        verifiedBy: verifiedBy || undefined,
      });

      // Reset form
      setDurationMinutes("");
      setLocation("");
      setVerifiedBy(null);
      setDateUsed(new Date().toISOString().split("T")[0]);
      if (isOnBehalf) {
        setMemberId(null);
      }

      onSuccess?.();
    } catch (error) {
      console.error("Failed to create BA skills record:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser || !allMembers) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter out current user from verifier list (can't verify your own usage)
  const verifierOptions = allMembers.filter((m) => m._id !== memberId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* On Behalf Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4">
        <div className="space-y-0.5">
          <Label htmlFor="on-behalf" className="text-base font-medium">
            Entering for another member?
          </Label>
          <p className="text-sm text-muted-foreground">
            Toggle this on to submit a record on behalf of someone else
          </p>
        </div>
        <Switch
          id="on-behalf"
          checked={isOnBehalf}
          onCheckedChange={setIsOnBehalf}
        />
      </div>

      {/* Member Selection */}
      <div className="space-y-2">
        <Label htmlFor="member">
          {isOnBehalf ? "Member who wore BA" : "Member"}{" "}
          <span className="text-red-500">*</span>
        </Label>
        {isOnBehalf ? (
          <Select
            value={memberId || ""}
            onValueChange={(value) => setMemberId(value as Id<"users">)}
          >
            <SelectTrigger id="member">
              <SelectValue placeholder="Select a member..." />
            </SelectTrigger>
            <SelectContent>
              {allMembers.map((member) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currentUser.name}</span>
          </div>
        )}
      </div>

      {/* Date Used */}
      <div className="space-y-2">
        <Label htmlFor="dateUsed">
          Date BA was worn <span className="text-red-500">*</span>
        </Label>
        <Input
          id="dateUsed"
          type="date"
          value={dateUsed}
          onChange={(e) => setDateUsed(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          required
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label htmlFor="duration">
          Duration (minutes) <span className="text-red-500">*</span>
        </Label>
        <Input
          id="duration"
          type="number"
          min="1"
          max="480"
          placeholder="e.g., 30"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          How many minutes was the BA worn for?
        </p>
      </div>

      {/* Usage Type */}
      <div className="space-y-2">
        <Label htmlFor="usageType">
          Type of use <span className="text-red-500">*</span>
        </Label>
        <Select
          value={usageType}
          onValueChange={(value) => setUsageType(value as "firecall" | "drill")}
        >
          <SelectTrigger id="usageType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="firecall">Fire Call</SelectItem>
            <SelectItem value="drill">Training / Drill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">
          Location / Details <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="location"
          placeholder={
            usageType === "firecall"
              ? "e.g., Structure Fire - 475 Ballan Road, Wyndham Vale"
              : "e.g., Training - 475 Ballan Rd, Wyndham Vale"
          }
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          rows={3}
          required
        />
        <p className="text-xs text-muted-foreground">
          Include the type of call/drill and location
        </p>
      </div>

      {/* Verified By */}
      <div className="space-y-2">
        <Label htmlFor="verifiedBy">Verified by (optional)</Label>
        <Select
          value={verifiedBy || "none"}
          onValueChange={(value) =>
            setVerifiedBy(value === "none" ? null : (value as Id<"users">))
          }
        >
          <SelectTrigger id="verifiedBy">
            <SelectValue placeholder="Select a member to verify..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No verifier</SelectItem>
            {verifierOptions.map((member) => (
              <SelectItem key={member._id} value={member._id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Which member can verify this BA usage?
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={
          isSubmitting ||
          !memberId ||
          !durationMinutes ||
          !location.trim()
        }
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Submit BA Record
          </>
        )}
      </Button>
    </form>
  );
}
