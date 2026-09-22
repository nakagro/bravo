import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Plus, FileText, Clock, CircleCheckBig, Archive, Eye, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { useMemo, useState } from "react";
import { FireReportForm, FireReportView } from "./index";
import { Id } from "../../../convex/_generated/dataModel";
import { Input } from "../ui/input";

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
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "approved">("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Get all fire reports
  const allReports = useQuery(api.fireReports.getFireReports, {}) as FireReport[] | undefined;
  
  // Get user's reports
  const myReports = useQuery(api.fireReports.getMyFireReports, {}) as FireReport[] | undefined;

  // Derived datasets
  const draftReports = useMemo(
    () => (myReports?.filter((r) => r.status === "draft") || []).sort((a, b) => (sortDir === "desc" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt)),
    [myReports, sortDir]
  );
  const mySubmittedReports = useMemo(
    () => (myReports?.filter((r) => r.status === "submitted") || []).sort((a, b) => (sortDir === "desc" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt)),
    [myReports, sortDir]
  );
  const submittedReports = useMemo(
    () => (allReports?.filter((r) => r.status === "submitted") || []).sort((a, b) => (sortDir === "desc" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt)),
    [allReports, sortDir]
  );
  const approvedReports = useMemo(
    () => (allReports?.filter((r) => r.status === "approved") || []).sort((a, b) => (sortDir === "desc" ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt)),
    [allReports, sortDir]
  );

  // Others' reports: submitted or approved, excluding my own by id
  const myIds = useMemo(() => new Set((myReports || []).map((r) => r._id)), [myReports]);
  const othersReports = useMemo(() => {
    const base = (allReports || []).filter((r) => !myIds.has(r._id) && (r.status === "submitted" || r.status === "approved"));
    const byStatus = statusFilter === "all" ? base : base.filter((r) => r.status === statusFilter);
    const bySearch = search.trim()
      ? byStatus.filter((r) => {
          const q = search.toLowerCase();
          return (
            r.incidentNumber.toLowerCase().includes(q) ||
            r.propertyAddress.toLowerCase().includes(q) ||
            r.createdByName.toLowerCase().includes(q)
          );
        })
      : byStatus;
    return [...bySearch].sort((a, b) => (sortDir === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
  }, [allReports, myIds, statusFilter, search, sortDir]);

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
        return <Badge variant="secondary">Submitted</Badge>;
      case "approved":
        return (
          <Badge
            variant="outline"
            className="text-green-600 border-green-600 dark:text-green-300 dark:border-green-700"
          >
            Approved
          </Badge>
        );
      case "archived":
        return (
          <Badge
            variant="outline"
            className="text-gray-600 border-gray-600 dark:text-gray-300 dark:border-gray-700"
          >
            Archived
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAttendanceTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      grassScrub: {
        label: "Grass & Scrub",
        color:
          "bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800/50",
      },
      incident: {
        label: "Incident",
        color:
          "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800/50",
      },
      structure: {
        label: "Structure",
        color:
          "bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/50",
      },
      nonStructure: {
        label: "Non-structure",
        color:
          "bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800/50",
      },
      falseAlarm: {
        label: "False Alarm",
        color:
          "bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:border-gray-800/50",
      },
    };

    const typeInfo =
      typeMap[type] || {
        label: type,
        color:
          "bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:border-gray-800/50",
      };

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${typeInfo.color}`}
      >
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
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fire Reports</h1>
          <Button
            onClick={handleNewReport}
            className="w-full sm:w-auto gap-2 h-11 text-base font-medium"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            New Fire Report
          </Button>
        </div>

        {/* Tabs */}
        <div className="inline-flex w-full sm:w-auto rounded-lg border border-border p-1 bg-background/70">
          <button
            type="button"
            onClick={() => setActiveTab("my")}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "my" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            aria-pressed={activeTab === "my"}
          >
            My Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            aria-pressed={activeTab === "all"}
          >
            Brigade
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="touch-manipulation">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Draft Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
            <CircleCheckBig className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
            <Archive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl sm:text-2xl font-bold">{allReports.length}</div>
            <p className="text-xs text-muted-foreground leading-tight">
              All reports
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content by Tab */}
      {activeTab === "my" ? (
        <div className="space-y-4">
          {/* My Drafts */}
          {draftReports.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  My Draft Reports
                </CardTitle>
                <CardDescription className="text-sm">Tap to continue editing your drafts</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {draftReports.map((report) => (
                    <div
                      key={report._id}
                      className="border border-border rounded-lg p-4 space-y-3 touch-manipulation"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-base">{report.incidentNumber}</h3>
                          {getStatusBadge(report.status)}
                          {getAttendanceTypeBadge(report.typeOfAttendance)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">📍 {report.propertyAddress}</p>
                        <p className="text-xs text-muted-foreground">🕒 {report.brigadeAdvisedDate} at {report.brigadeAdvisedTime}</p>
                      </div>
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
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* My Submitted */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                My Submitted Reports
              </CardTitle>
              <CardDescription className="text-sm">Recently submitted by you</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {mySubmittedReports.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">No submitted reports yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mySubmittedReports.map((report) => (
                    <div key={report._id} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-base">{report.incidentNumber}</h3>
                          {getStatusBadge(report.status)}
                          {getAttendanceTypeBadge(report.typeOfAttendance)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">📍 {report.propertyAddress}</p>
                        <p className="text-xs text-muted-foreground">📅 {formatDate(report.createdAt)}</p>
                      </div>
                      <div className="pt-1">
                        <Button variant="outline" onClick={() => handleViewReport(report._id)} className="w-full h-10 gap-2">
                          <Eye className="h-4 w-4" /> View Report
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search incident #, address, member"
                className="pl-9 h-11"
                aria-label="Search reports"
              />
            </div>
            <div className="inline-flex rounded-md border border-border p-1">
              {(["all", "submitted", "approved"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    statusFilter === s ? "bg-muted" : "hover:bg-muted/70"
                  }`}
                  aria-pressed={statusFilter === s}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-border">
              <button
                type="button"
                onClick={() => setSortDir("desc")}
                className={`px-3 py-2 text-sm ${sortDir === "desc" ? "bg-muted" : "hover:bg-muted/70"}`}
                aria-pressed={sortDir === "desc"}
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => setSortDir("asc")}
                className={`px-3 py-2 text-sm ${sortDir === "asc" ? "bg-muted" : "hover:bg-muted/70"}`}
                aria-pressed={sortDir === "asc"}
              >
                Oldest
              </button>
            </div>
          </div>

          {/* Brigade Reports */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Brigade Reports
              </CardTitle>
              <CardDescription className="text-sm">Recent submitted and approved reports from your brigade</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {othersReports.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">No matching reports.</p>
                    <p className="text-sm text-muted-foreground">Try adjusting filters or search.</p>
                  </div>
                ) : (
                  othersReports.slice(0, 15).map((report) => (
                    <div key={report._id} className="border border-border rounded-lg p-4 space-y-3 touch-manipulation">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-base">{report.incidentNumber}</h3>
                          {getStatusBadge(report.status)}
                          {getAttendanceTypeBadge(report.typeOfAttendance)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">📍 {report.propertyAddress}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          <p className="text-xs text-muted-foreground">👤 {report.createdByName}</p>
                          <p className="text-xs text-muted-foreground">📅 {formatDate(report.createdAt)}</p>
                        </div>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={() => handleViewReport(report._id)}
                          className="w-full h-11 gap-2 text-base"
                        >
                          <Eye className="h-4 w-4" /> View Report
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
