import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LoaderCircle, TriangleAlert, CircleCheckBig, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function BASkillsAudit() {
  const auditData = useQuery(api.baSkillsAudit.getBASkillsAudit);

  if (!auditData) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auditData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">No members with BA skills found.</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "expired":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <TriangleAlert className="h-3 w-3" />
            Expired
          </Badge>
        );
      case "urgent":
        return (
          <Badge className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600">
            <AlertCircle className="h-3 w-3" />
            Urgent
          </Badge>
        );
      case "warning":
        return (
          <Badge className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600">
            <Clock className="h-3 w-3" />
            Warning
          </Badge>
        );
      case "never_used":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Never Used
          </Badge>
        );
      case "current":
        return (
          <Badge className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
            <CircleCheckBig className="h-3 w-3" />
            Current
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusMessage = (
    status: string,
    daysUntilExpiry?: number,
    daysSinceLastUse?: number
  ) => {
    switch (status) {
      case "expired":
        return `Expired ${Math.abs(daysUntilExpiry || 0)} days ago - must use BA to maintain qualification`;
      case "urgent":
        return `${daysUntilExpiry} days remaining - use BA soon to maintain qualification`;
      case "warning":
        return `${daysUntilExpiry} days remaining`;
      case "never_used":
        return "No BA usage recorded - must use BA within 6 months of qualification";
      case "current":
        return `Last used ${daysSinceLastUse} days ago - ${daysUntilExpiry} days remaining`;
      default:
        return "";
    }
  };

  // Group by status for better organization
  const expired = auditData.filter((m) => m.status === "expired");
  const urgent = auditData.filter((m) => m.status === "urgent");
  const warning = auditData.filter((m) => m.status === "warning");
  const neverUsed = auditData.filter((m) => m.status === "never_used");
  const current = auditData.filter((m) => m.status === "current");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {expired.length}
            </div>
            <div className="text-xs text-muted-foreground">Expired</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {urgent.length}
            </div>
            <div className="text-xs text-muted-foreground">Urgent</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {warning.length}
            </div>
            <div className="text-xs text-muted-foreground">Warning</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {neverUsed.length}
            </div>
            <div className="text-xs text-muted-foreground">Never Used</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {current.length}
            </div>
            <div className="text-xs text-muted-foreground">Current</div>
          </CardContent>
        </Card>
      </div>

      {/* Member List */}
      <div className="space-y-3">
        {auditData.map((member) => (
          <div
            key={member.userId}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {member.userName}
                  </span>
                  {getStatusBadge(member.status)}
                  <div className="flex gap-1">
                    {member.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {getStatusMessage(
                    member.status,
                    member.daysUntilExpiry,
                    member.daysSinceLastUse
                  )}
                </div>
                {member.lastUsageDate && (
                  <div className="text-xs text-muted-foreground">
                    Last used: {new Date(member.lastUsageDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
