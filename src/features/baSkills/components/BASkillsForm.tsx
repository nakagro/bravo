import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { LoaderCircle, Save, User, Users, Flame, GraduationCap } from "lucide-react";

interface BASkillsFormProps {
  onSuccess?: () => void;
}

const DURATION_PRESETS = [15, 20, 30, 45, 60];

export function BASkillsForm({ onSuccess }: BASkillsFormProps) {
  const currentUser = useQuery(api.baSkills.getCurrentUser);
  const allMembers = useQuery(api.baSkills.getAllMembers);
  const createRecord = useMutation(api.baSkills.createBASkillsRecord);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [memberId, setMemberId] = useState<Id<"users"> | null>(null);
  const [dateUsed, setDateUsed] = useState(() => new Date().toISOString().split("T")[0]);
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

  // Sort members by rank (Captain > Lieutenant > Firefighter > Probationary) then alphabetically
  const sortMembersByRank = (members: typeof allMembers) => {
    if (!members) return [];
    const rankOrder = { Captain: 1, Lieutenant: 2, Firefighter: 3, Probationary: 4 };
    return [...members].sort((a, b) => {
      const rankA = rankOrder[a.rank as keyof typeof rankOrder] || 999;
      const rankB = rankOrder[b.rank as keyof typeof rankOrder] || 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  };

  const sortedMembers = useMemo(() => sortMembersByRank(allMembers), [allMembers]);

  const memberOptions: ComboboxOption[] = useMemo(
    () => sortedMembers.map((member) => ({ value: member._id, label: member.name, rank: member.rank })),
    [sortedMembers]
  );

  const verifierOptions: ComboboxOption[] = useMemo(
    () => sortedMembers
      .filter((m) => m._id !== memberId)
      .map((member) => ({ value: member._id, label: member.name, rank: member.rank })),
    [sortedMembers, memberId]
  );

  const duration = parseInt(durationMinutes, 10);
  const isDurationValid = !isNaN(duration) && duration > 0 && duration <= 480;
  const isMemberValid = !!memberId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);

    if (!isMemberValid || !isDurationValid) return;

    setIsSubmitting(true);
    try {
      await createRecord({
        memberId: memberId!,
        dateUsed,
        durationMinutes: duration,
        usageType,
        location: location.trim(),
        verifiedBy: verifiedBy || undefined,
      });

      // Reset form — preserve usageType for batch entry
      setDurationMinutes("");
      setLocation("");
      setVerifiedBy(null);
      setAttempted(false);
      setDateUsed(new Date().toISOString().split("T")[0]);
      if (isOnBehalf) setMemberId(null);

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
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Who is this for? */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Who is this for? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsOnBehalf(false)}
            className={`relative px-3 py-3 sm:px-4 sm:py-4 rounded-lg border-2 transition-all text-left min-h-[76px] ${
              !isOnBehalf
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-3 h-full">
              <div className={`shrink-0 rounded-full p-2 ${!isOnBehalf ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                <User className={`h-5 w-5 ${!isOnBehalf ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${!isOnBehalf ? "text-red-900 dark:text-red-100" : ""}`}>For myself</div>
                <div className="text-sm text-muted-foreground truncate mt-0.5">{currentUser.name}</div>
              </div>
              {!isOnBehalf && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsOnBehalf(true)}
            className={`relative px-3 py-3 sm:px-4 sm:py-4 rounded-lg border-2 transition-all text-left min-h-[76px] ${
              isOnBehalf
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-3 h-full">
              <div className={`shrink-0 rounded-full p-2 ${isOnBehalf ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                <Users className={`h-5 w-5 ${isOnBehalf ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${isOnBehalf ? "text-red-900 dark:text-red-100" : ""}`}>For another member</div>
              </div>
              {isOnBehalf && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Member Selection */}
      {isOnBehalf && (
        <div className="space-y-2">
          <Label htmlFor="member">
            Select member <span className="text-red-500">*</span>
          </Label>
          <Combobox
            options={memberOptions}
            value={memberId || ""}
            onValueChange={(value) => setMemberId(value as Id<"users">)}
            placeholder="Select a member..."
            searchPlaceholder="Search members..."
            emptyText="No member found."
          />
          {attempted && !isMemberValid && (
            <p className="text-sm text-destructive">Please select a member.</p>
          )}
        </div>
      )}

      {/* Type of use — visual buttons */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Type of use <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUsageType("firecall")}
            className={`relative px-3 py-3 sm:px-4 sm:py-4 rounded-lg border-2 transition-all text-left min-h-[76px] ${
              usageType === "firecall"
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-3 h-full">
              <div className={`shrink-0 rounded-full p-2 ${usageType === "firecall" ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                <Flame className={`h-5 w-5 ${usageType === "firecall" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${usageType === "firecall" ? "text-red-900 dark:text-red-100" : ""}`}>Fire Call</div>
                <div className="text-sm text-muted-foreground mt-0.5">Actual incident</div>
              </div>
              {usageType === "firecall" && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setUsageType("drill")}
            className={`relative px-3 py-3 sm:px-4 sm:py-4 rounded-lg border-2 transition-all text-left min-h-[76px] ${
              usageType === "drill"
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-3 h-full">
              <div className={`shrink-0 rounded-full p-2 ${usageType === "drill" ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                <GraduationCap className={`h-5 w-5 ${usageType === "drill" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${usageType === "drill" ? "text-red-900 dark:text-red-100" : ""}`}>Training / Drill</div>
                <div className="text-sm text-muted-foreground mt-0.5">Practice session</div>
              </div>
              {usageType === "drill" && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="dateUsed">
          Date <span className="text-red-500">*</span>
        </Label>
        <Input
          id="dateUsed"
          type="date"
          className="h-11"
          value={dateUsed}
          onChange={(e) => setDateUsed(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          required
        />
      </div>

      {/* Duration — quick-tap presets + manual input */}
      <div className="space-y-2">
        <Label>
          Duration (time on air) <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDurationMinutes(String(preset))}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                durationMinutes === String(preset)
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                  : "border-border hover:border-gray-400 dark:hover:border-gray-600 text-foreground"
              }`}
            >
              {preset} min
            </button>
          ))}
        </div>
        <Input
          id="duration"
          type="number"
          inputMode="numeric"
          min="1"
          max="480"
          placeholder="Or enter custom minutes..."
          className="h-11"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        {attempted && !isDurationValid && (
          <p className="text-sm text-destructive">
            {!durationMinutes ? "Please enter a duration." : "Duration must be between 1 and 480 minutes."}
          </p>
        )}
      </div>

      {/* Location / Details — optional */}
      <div className="space-y-2">
        <Label htmlFor="location">Location / Details</Label>
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
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">Include the type of call/drill and location</p>
      </div>

      {/* Verified By — optional */}
      <div className="space-y-2">
        <Label htmlFor="verifiedBy">Verified by <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
        <Combobox
          options={verifierOptions}
          value={verifiedBy || ""}
          onValueChange={(value) => setVerifiedBy(value as Id<"users">)}
          placeholder="Select a member to verify..."
          searchPlaceholder="Search members..."
          emptyText="No member found."
        />
        <p className="text-xs text-muted-foreground">Can be added later if no one is available to verify now</p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Save className="mr-2 h-5 w-5" />
            Submit BA Record
          </>
        )}
      </Button>
    </form>
  );
}
