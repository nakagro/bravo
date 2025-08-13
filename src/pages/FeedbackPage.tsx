import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { getVersionString } from "@/utils/version";
import * as Sentry from "@sentry/react";

export function FeedbackPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"bug" | "feature" | "improvement" | "general">("general");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = useMutation(api.feedback.submitFeedback);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitFeedback({
        subject: subject.trim(),
        message: message.trim(),
        category,
        isAnonymous,
        appVersion: getVersionString(),
      });

      // Send Sentry event for feedback submission
      Sentry.addBreadcrumb({
        message: "Feedback submitted",
        category: "user_action",
        level: "info",
        data: {
          category,
          isAnonymous,
          appVersion: getVersionString(),
          subject: subject.trim().substring(0, 50) + (subject.trim().length > 50 ? "..." : ""), // Truncated for privacy
        },
      });

      Sentry.captureMessage("New feedback submitted", {
        level: "info",
        tags: {
          feedback_category: category,
          app_version: getVersionString(),
          submission_type: isAnonymous ? "anonymous" : "identified",
        },
        extra: {
          subject: subject.trim(),
          message: message.trim(),
          category,
          isAnonymous,
          appVersion: getVersionString(),
        },
      });

      // Reset form and show success toast
      setSubject("");
      setMessage("");
      setCategory("general");
      setIsAnonymous(false);
      
      toast.success("Thank you for your feedback! 😍");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback</h1>
        </div>
        
        <div className="max-w-2xl w-full">
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
            Help us improve the Brigade Management System by sharing your feedback, reporting bugs, or suggesting new features.
          </p>

        <Card>
          <CardHeader>
            <CardTitle>Submit Feedback</CardTitle>
            <CardDescription>
              Your input helps us make the system better for everyone in the brigade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(value: "bug" | "feature" | "improvement" | "general") => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select feedback category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">🐛 Bug Report</SelectItem>
                    <SelectItem value="feature">✨ Feature Request</SelectItem>
                    <SelectItem value="improvement">🔧 Improvement Suggestion</SelectItem>
                    <SelectItem value="general">💬 General Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  required
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please provide detailed feedback, including steps to reproduce if reporting a bug..."
                  rows={6}
                  required
                />
              </div>

              {/* Anonymous Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="anonymous"
                  checked={isAnonymous}
                  onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                />
                <Label htmlFor="anonymous" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Submit anonymously
                </Label>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isAnonymous ? (
                  "Your feedback will be submitted without any identifying information."
                ) : (
                  "Your name will be attached to this feedback to help us follow up if needed."
                )}
              </div>

              {/* App Version Info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                <strong>App Version:</strong> v{getVersionString()}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={isSubmitting || !subject.trim() || !message.trim()}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
