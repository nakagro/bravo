import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { 
  PlusIcon, 
  DocumentTextIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ArchiveBoxIcon,
  EyeIcon
} from "@heroicons/react/24/outline";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { useState } from "react";
import { FireReportForm, FireReportView } from "./index";
import { Id } from "../../../convex/_generated/dataModel";

interface FireReport {
  _id: Id<"fireReports">;
  incidentNumber: string;
  brigadeAdvisedDate: string;
  brigadeAdvisedTime: string;
  propertyAddress: string;
  status: "draft" | "submitted" | "approved" | "archived";
  createdAt: number;
  updatedAt: number;
  createdByName: string;
  typeOfAttendance: string;
}

export function FireReportsDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Id<"fireReports"> | null>(null);
  const [editingReport, setEditingReport] = useState<Id<"fireReports"> | null>(null);

  // Get all fire reports
  const allReports = useQuery(api.fireReports.getFireReports, {}) as FireReport[] | undefined;
  
  // Get user's reports
  const myReports = useQuery(api.fireReports.getMyFireReports, {}) as FireReport[] | undefined;

  // Filter reports by status
  const draftReports = myReports?.filter(report => report.status === "draft") || [];
  const submittedReports = allReports?.filter(report => report.status === "submitted") || [];
  const approvedReports = allReports?.filter(report => report.status === "approved") || [];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  const handleNewReport = () => {
    setShowForm(true);
    setEditingReport(null);
    setSelectedReport(null);
  };

  const handleEditReport = (reportId: Id<"fireReports">) => {
    setEditingReport(reportId);
    setShowForm(true);
    setSelectedReport(null);
  };

  const handleViewReport = (reportId: Id<"fireReports">) => {
    setSelectedReport(reportId);
    setShowForm(false);
    setEditingReport(null);
  };

  const handleBackToDashboard = () => {
    setShowForm(false);
    setSelectedReport(null);
    setEditingReport(null);
  };

  // Show form when creating new or editing
  if (showForm) {
    return (
      <FireReportForm 
        reportId={editingReport}
        onBack={handleBackToDashboard}
        onSaved={handleBackToDashboard}
      />
    );
  }

  // Show report view when viewing
  if (selectedReport) {
    return (
      <FireReportView 
        reportId={selectedReport}
        onBack={handleBackToDashboard}
        onEdit={() => handleEditReport(selectedReport)}
      />
    );
  }

  if (!allReports || !myReports) {
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

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Mobile-First Header */}
      <div className="space-y-4">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fire Reports</h1>
        </div>
        {/* Mobile-optimized New Report Button */}
        <Button 
          onClick={handleNewReport} 
          className="w-full sm:w-auto gap-2 h-12 text-base font-medium"
          size="lg"
        >
          <PlusIcon className="h-5 w-5" />
          New Fire Report
        </Button>
      </div>

      {/* Mobile-Optimized Statistics Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="touch-manipulation">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Draft Reports</CardTitle>
            <DocumentTextIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl sm:text-2xl font-bold">{draftReports.length}</div>
            <p className="text-xs text-muted-foreground leading-tight">
              Your drafts
            </p>
          </CardContent>
        </Card>
        <Card className="touch-manipulation">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Submitted</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl sm:text-2xl font-bold">{submittedReports.length}</div>
            <p className="text-xs text-muted-foreground leading-tight">
              Pending
            </p>
          </CardContent>
        </Card>
        <Card className="touch-manipulation">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Approved</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl sm:text-2xl font-bold">{approvedReports.length}</div>
            <p className="text-xs text-muted-foreground leading-tight">
              Complete
            </p>
          </CardContent>
        </Card>
        <Card className="touch-manipulation">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Total</CardTitle>
            <ArchiveBoxIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl sm:text-2xl font-bold">{allReports.length}</div>
            <p className="text-xs text-muted-foreground leading-tight">
              All reports
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Draft Reports - Mobile Optimized */}
      {draftReports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DocumentTextIcon className="h-5 w-5" />
              My Draft Reports
            </CardTitle>
            <CardDescription className="text-sm">
              Tap to continue editing your drafts
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {draftReports.map((report) => (
                <div key={report._id} className="border rounded-lg p-4 space-y-3 touch-manipulation">
                  {/* Mobile-first content layout */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base">{report.incidentNumber}</h3>
                      {getStatusBadge(report.status)}
                      {getAttendanceTypeBadge(report.typeOfAttendance)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      📍 {report.propertyAddress}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      🕒 {report.brigadeAdvisedDate} at {report.brigadeAdvisedTime}
                    </p>
                  </div>
                  {/* Mobile-optimized buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      variant="default"
                      onClick={() => handleEditReport(report._id)}
                      className="flex-1 h-11 text-base font-medium"
                    >
                      Continue Editing
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleViewReport(report._id)}
                      className="flex-1 sm:flex-none h-11 gap-2"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Reports - Mobile Optimized */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClockIcon className="h-5 w-5" />
            Recent Reports
          </CardTitle>
          <CardDescription className="text-sm">
            Latest reports from all brigade members
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {allReports.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <DocumentTextIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  No fire reports yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Create your first report to get started.
                </p>
              </div>
            ) : (
              allReports.slice(0, 10).map((report) => (
                <div key={report._id} className="border rounded-lg p-4 space-y-3 touch-manipulation">
                  {/* Mobile-first content layout */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base">{report.incidentNumber}</h3>
                      {getStatusBadge(report.status)}
                      {getAttendanceTypeBadge(report.typeOfAttendance)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      📍 {report.propertyAddress}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <p className="text-xs text-muted-foreground">
                        👤 {report.createdByName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        📅 {formatDate(report.createdAt)}
                      </p>
                    </div>
                  </div>
                  {/* Mobile-optimized view button */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleViewReport(report._id)}
                      className="w-full h-11 gap-2 text-base"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View Report
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
