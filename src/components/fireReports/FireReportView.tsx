import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { 
  ArrowLeftIcon, 
  PencilIcon, 
  DocumentTextIcon,
  MapPinIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  TruckIcon,
  FireIcon,
  ShieldExclamationIcon
} from "@heroicons/react/24/outline";
import { useToast } from "../../hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";

interface FireReportViewProps {
  reportId: Id<"fireReports">;
  onBack: () => void;
  onEdit: () => void;
}

export function FireReportView({ reportId, onBack, onEdit }: FireReportViewProps) {
  const report = useQuery(api.fireReports.getFireReport, { reportId });
  const { toast } = useToast();

  if (!report) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-10 w-10"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "submitted":
        return <Badge variant="default">Submitted</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>;
      case "archived":
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAttendanceTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      grassScrub: { label: "Grass & Scrub", color: "bg-green-100 text-green-800" },
      incident: { label: "Incident", color: "bg-blue-100 text-blue-800" },
      structure: { label: "Structure", color: "bg-red-100 text-red-800" },
      nonStructure: { label: "Non-structure", color: "bg-yellow-100 text-yellow-800" },
      falseAlarm: { label: "False Alarm", color: "bg-gray-100 text-gray-800" }
    };

    const typeInfo = typeMap[type] || { label: type, color: "bg-gray-100 text-gray-800" };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${typeInfo.color}`}>
        {typeInfo.label}
      </span>
    );
  };

  const getActionLabel = (actionValue: string) => {
    const actionMap: Record<string, string> = {
      calledOff: "Called Off En-route",
      stepUp: "Step up",
      investigateOnly: "Investigate Only",
      fireOutOnArrival: "Fire Out on Arrival",
      washaway: "Wash-away",
      removeHazard: "Remove Hazard, Evacuation",
      rescue: "Rescue or Assistance",
      isolate: "Isolate / Shut off",
      standby: "Standby, Cover Assignment",
      extinguish: "Extinguish, Salvage, Overhaul, Ventilate",
      service: "Service, Assist Elderly, Gain Entry etc.",
      other: "Other"
    };
    return actionMap[actionValue] || actionValue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Fire Report: {report.incidentNumber}
              </h1>
              {getStatusBadge(report.status)}
              {getAttendanceTypeBadge(report.typeOfAttendance)}
            </div>
            <p className="text-muted-foreground">
              Reported by {report.createdByName} • {formatDate(report.createdAt)}
            </p>
          </div>
        </div>
        {(report.status === "draft" || report.status === "submitted") && (
          <Button onClick={onEdit} className="gap-2">
            <PencilIcon className="h-4 w-4" />
            Edit Report
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        {/* Fire Call Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FireIcon className="h-5 w-5" />
              Fire Call Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Incident Number</h4>
                <p className="mt-1">{report.incidentNumber}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Brigade Advised</h4>
                <p className="mt-1">{report.brigadeAdvisedDate} at {report.brigadeAdvisedTime}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Attending Capacity</h4>
                <p className="mt-1 capitalize">{report.attendingCapacity}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Brigade Call Number</h4>
                <p className="mt-1">{report.brigadeCaller || "Not provided"}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Firecom Call Number</h4>
                <p className="mt-1">{report.firecomCaller || "Not provided"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Incident Controller</h4>
                <p className="mt-1">{report.incidentController}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Brigade OIC</h4>
                <p className="mt-1">{report.brigadeOIC || "Not provided"}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                Property Address/Location
              </h4>
              <p className="mt-1">{report.propertyAddress}</p>
              {report.propertyCoordinates && (
                <p className="text-sm text-muted-foreground mt-1">
                  GPS: {report.propertyCoordinates}
                </p>
              )}
            </div>

            {report.jobDetail && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Job Detail</h4>
                <p className="mt-1">{report.jobDetail}</p>
              </div>
            )}

            <div className="flex gap-8">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Keys Used</h4>
                <p className="mt-1">{report.keysUsed === true ? "Yes" : report.keysUsed === false ? "No" : "Not specified"}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Charge Recommended</h4>
                <p className="mt-1">{report.chargeRecommended === true ? "Yes" : report.chargeRecommended === false ? "No" : "Not specified"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Taken */}
        {report.actionsTaken && report.actionsTaken.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldExclamationIcon className="h-5 w-5" />
                Actions Taken
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {report.actionsTaken.map((action, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">{getActionLabel(action)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Property Information */}
        {(report.propertyInfo?.occupier || report.propertyInfo?.owner) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Property Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {report.propertyInfo?.occupier && (
                <div>
                  <h3 className="font-medium mb-3">Occupier Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {report.propertyInfo.occupier.name && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Name</h4>
                        <p className="mt-1">{report.propertyInfo.occupier.name}</p>
                      </div>
                    )}
                    {report.propertyInfo.occupier.phone && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                          <PhoneIcon className="h-3 w-3" />
                          Phone
                        </h4>
                        <p className="mt-1">{report.propertyInfo.occupier.phone}</p>
                      </div>
                    )}
                    {report.propertyInfo.occupier.type && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Type</h4>
                        <p className="mt-1 capitalize">{report.propertyInfo.occupier.type}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {report.propertyInfo?.owner && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-3">Owner Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {report.propertyInfo.owner.name && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Name</h4>
                          <p className="mt-1">{report.propertyInfo.owner.name}</p>
                        </div>
                      )}
                      {report.propertyInfo.owner.phone && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                            <PhoneIcon className="h-3 w-3" />
                            Phone
                          </h4>
                          <p className="mt-1">{report.propertyInfo.owner.phone}</p>
                        </div>
                      )}
                    </div>
                    {report.propertyInfo.owner.address && (
                      <div className="mt-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Address</h4>
                        <p className="mt-1">{report.propertyInfo.owner.address}</p>
                      </div>
                    )}
                    {report.propertyInfo.owner.type && (
                      <div className="mt-4">
                        <h4 className="font-medium text-sm text-muted-foreground">Type</h4>
                        <p className="mt-1 capitalize">{report.propertyInfo.owner.type}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {report.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{report.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Report Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-1">
                <h4 className="font-medium text-sm sm:text-base text-muted-foreground">Created</h4>
                <p className="text-sm sm:text-base">{formatDate(report.createdAt)}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">by {report.createdByName}</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-sm sm:text-base text-muted-foreground">Last Updated</h4>
                <p className="text-sm sm:text-base">{formatDate(report.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
