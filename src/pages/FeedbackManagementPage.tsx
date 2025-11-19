import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Bug, Lightbulb, Wrench, Check, X, Clock } from "lucide-react";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "../../convex/_generated/dataModel";

type FeedbackStatus = "pending" | "implemented" | "wont_implement" | "under_review";

export default function FeedbackManagementPage() {
    const navigate = useNavigate();
    const feedbackItems = useQuery(api.feedback.getAllFeedback);
    const updateStatus = useMutation(api.feedback.updateFeedbackStatus);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState<Id<"feedback"> | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | null>(null);
    const [adminResponse, setAdminResponse] = useState("");

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "bug":
                return <Bug className="h-3.5 w-3.5" />;
            case "feature":
                return <Lightbulb className="h-3.5 w-3.5" />;
            case "improvement":
                return <Wrench className="h-3.5 w-3.5" />;
            default:
                return <MessageSquare className="h-3.5 w-3.5" />;
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getStatusBadge = (status?: FeedbackStatus) => {
        if (!status || status === "pending") {
            return (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold">
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    Pending
                </Badge>
            );
        }
        if (status === "implemented") {
            return (
                <Badge className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 text-white border-0 font-semibold shadow-sm">
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Implemented
                </Badge>
            );
        }
        if (status === "wont_implement") {
            return (
                <Badge variant="destructive" className="text-sm px-3 py-1 font-semibold shadow-sm">
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Won't Implement
                </Badge>
            );
        }
        if (status === "under_review") {
            return (
                <Badge className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white border-0 font-semibold shadow-sm">
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    Under Review
                </Badge>
            );
        }
    };

    const getCardBorderClass = (status?: FeedbackStatus) => {
        if (status === "implemented") {
            return "border-l-4 border-l-green-600";
        }
        if (status === "wont_implement") {
            return "border-l-4 border-l-red-600";
        }
        if (status === "under_review") {
            return "border-l-4 border-l-blue-600";
        }
        return "border-l-4 border-l-gray-300 dark:border-l-gray-700";
    };

    const handleStatusClick = (feedbackId: Id<"feedback">, currentStatus: FeedbackStatus, currentResponse?: string) => {
        setSelectedFeedback(feedbackId);
        setSelectedStatus(currentStatus);
        setAdminResponse(currentResponse || "");
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedFeedback || !selectedStatus) return;

        await updateStatus({
            feedbackId: selectedFeedback,
            status: selectedStatus,
            adminResponse: adminResponse || undefined,
        });

        setDialogOpen(false);
        setSelectedFeedback(null);
        setSelectedStatus(null);
        setAdminResponse("");
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin")}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Admin
                    </Button>
                    {/* <Badge variant="secondary" className="text-sm font-semibold">
                        {feedbackItems?.length || 0} items
                    </Badge> */}
                </div>
            </div>

            {/* Feedback List */}
            <div className="space-y-3">
                {!feedbackItems ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-muted-foreground mt-3">Loading...</p>
                    </div>
                ) : feedbackItems.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No feedback yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {feedbackItems.map((item) => (
                            <div
                                key={item._id}
                                className={`bg-card border border-border p-4 space-y-3 ${getCardBorderClass(item.status)}`}
                            >
                                {/* Header Row */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                            className="flex items-center gap-1 text-sm px-3 py-1 bg-gradient-to-r from-orange-600 to-red-600 text-white border-0 font-semibold"
                                        >
                                            {getCategoryIcon(item.category)}
                                            <span className="capitalize">{item.category}</span>
                                        </Badge>
                                        <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                                            v{item.appVersion}
                                        </Badge>
                                    </div>
                                    <button
                                        onClick={() => handleStatusClick(item._id, item.status || "pending", item.adminResponse)}
                                        className="transition-transform hover:scale-105 active:scale-95"
                                    >
                                        {getStatusBadge(item.status)}
                                    </button>
                                </div>

                                {/* Subject */}
                                <h3 className="font-semibold text-foreground leading-snug">
                                    {item.subject}
                                </h3>

                                {/* Message */}
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {item.message}
                                </p>

                                {/* Admin Response */}
                                {item.adminResponse && (
                                    <div className="bg-muted/50 p-3 rounded-md">
                                        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Comments:</p>
                                        <p className="text-sm text-foreground">{item.adminResponse}</p>
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                                    <span>
                                        Submitted by: {item.isAnonymous ? "Anonymous" : item.submitterName || "Unknown"}
                                    </span>
                                    <span>{formatDate(item.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Status Update Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Update Feedback Status</DialogTitle>
                        <DialogDescription>
                            Choose a status and optionally add comments about this feedback.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Status
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelectedStatus("implemented")}
                                    className={`justify-start ${selectedStatus === "implemented"
                                        ? "bg-green-600 text-white hover:bg-green-700 border-green-600"
                                        : "hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-950 dark:hover:text-green-400"
                                        }`}
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Implemented
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelectedStatus("wont_implement")}
                                    className={`justify-start ${selectedStatus === "wont_implement"
                                        ? "bg-red-600 text-white hover:bg-red-700 border-red-600"
                                        : "hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950 dark:hover:text-red-400"
                                        }`}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Won't Implement
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelectedStatus("under_review")}
                                    className={`justify-start ${selectedStatus === "under_review"
                                        ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                                        : "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                                        }`}
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Under Review
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSelectedStatus("pending")}
                                    className={`justify-start ${selectedStatus === "pending"
                                        ? "bg-gray-600 text-white hover:bg-gray-700 border-gray-600"
                                        : "hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300 dark:hover:bg-gray-950 dark:hover:text-gray-400"
                                        }`}
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Pending
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Comments (optional)
                            </label>
                            <Textarea
                                // placeholder="Add any notes or comments about this decision..."
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit}>
                            Update Status
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
