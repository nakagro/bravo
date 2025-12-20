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
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, User, Users } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Who is this for? - Clear visual selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Who is this BA record for? <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Option 1: For myself */}
          <button
            type="button"
            onClick={() => setIsOnBehalf(false)}
            className={`relative p-4 rounded-lg border-2 transition-all text-left ${
              !isOnBehalf
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 rounded-full p-2 ${
                  !isOnBehalf
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-muted"
                }`}
              >
                <User
                  className={`h-5 w-5 ${
                    !isOnBehalf
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium ${
                    !isOnBehalf ? "text-red-900 dark:text-red-100" : ""
                  }`}
                >
                  For myself
                </div>
                <div className="text-sm text-muted-foreground truncate mt-0.5">
                  {currentUser.name}
                </div>
              </div>
              {!isOnBehalf && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* Option 2: For another member */}
          <button
            type="button"
            onClick={() => setIsOnBehalf(true)}
            className={`relative p-4 rounded-lg border-2 transition-all text-left ${
              isOnBehalf
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : "border-border hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 rounded-full p-2 ${
                  isOnBehalf
                    ? "bg-red-100 dark:bg-red-900/30"
                    : "bg-muted"
                }`}
              >
                <Users
                  className={`h-5 w-5 ${
                    isOnBehalf
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium ${
                    isOnBehalf ? "text-red-900 dark:text-red-100" : ""
                  }`}
                >
                  For another member
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Select member below
                </div>
              </div>
              {isOnBehalf && (
                <div className="shrink-0">
                  <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Member Selection - Only show when entering on behalf */}
      {isOnBehalf && (
        <div className="space-y-2">
          <Label htmlFor="member">
            Select member <span className="text-red-500">*</span>
          </Label>
          <Select
            value={memberId || ""}
            onValueChange={(value) => setMemberId(value as Id<"users">)}
          >
            <SelectTrigger id="member" className="h-11">
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
        </div>
      )}

      {/* Date and Duration - Side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="space-y-2">
          <Label htmlFor="duration">
            Duration (mins) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="duration"
            type="number"
            className="h-11"
            inputMode="numeric"
            min="1"
            max="480"
            placeholder="e.g., 30"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
          />
        </div>
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
          <SelectTrigger id="usageType" className="h-11">
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
          className="resize-none"
          required
        />
        <p className="text-xs text-muted-foreground">
          Include the type of call/drill and location
        </p>
      </div>

      {/* Verified By */}
      <div className="space-y-2">
        <Label htmlFor="verifiedBy">
          Verified by <span className="text-red-500">*</span>
        </Label>
        <Select
          value={verifiedBy || ""}
          onValueChange={(value) => setVerifiedBy(value as Id<"users">)}
        >
          <SelectTrigger id="verifiedBy" className="h-11">
            <SelectValue placeholder="Select a member to verify..." />
          </SelectTrigger>
          <SelectContent>
            {verifierOptions.map((member) => (
              <SelectItem key={member._id} value={member._id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submit Button - Large touch target for mobile */}
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base"
        disabled={
          isSubmitting ||
          !memberId ||
          !durationMinutes ||
          !location.trim() ||
          !verifiedBy
        }
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
