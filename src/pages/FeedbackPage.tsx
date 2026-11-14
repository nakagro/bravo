import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { MessageSquare, Send, CircleCheckBig, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getVersionString } from "@/utils/version";

export function FeedbackPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"bug" | "feature" | "improvement" | "general">("general");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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

      setIsSubmitted(true);
      
      setSubject("");
      setMessage("");
      setCategory("general");
      setIsAnonymous(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAnother = () => {
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="mb-6">
            <CircleCheckBig className="h-20 w-20 text-green-500 mx-auto mb-4" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Feedback submitted
          </h1>
          
          <p className="text-base text-gray-600 dark:text-gray-400 mb-8 max-w-md">
            Thank you for taking the time to help improve BRAVO. Your feedback is valuable to making the system better for everyone in the brigade.
          </p>
          
          <Button 
            onClick={handleSubmitAnother}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Submit More Feedback
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Feedback</h1>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Your input helps us make the system better for everyone in the brigade.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection */}
        <div className="space-y-3">
          <Label>Category</Label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div
              onClick={() => setCategory("general")}
              className={`cursor-pointer p-2 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                category === "general"
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="text-center">
                <div className="text-lg sm:text-2xl mb-1 sm:mb-2">💬</div>
                <div className="font-medium text-xs sm:text-sm">General Feedback</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  Share your thoughts
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory("bug")}
              className={`cursor-pointer p-2 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                category === "bug"
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-400"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="text-center">
                <div className="text-lg sm:text-2xl mb-1 sm:mb-2">🐛</div>
                <div className="font-medium text-xs sm:text-sm">Bug Report</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  Something isn't working
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory("feature")}
              className={`cursor-pointer p-2 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                category === "feature"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="text-center">
                <div className="text-lg sm:text-2xl mb-1 sm:mb-2">✨</div>
                <div className="font-medium text-xs sm:text-sm">Feature Request</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  Suggest a new feature
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory("improvement")}
              className={`cursor-pointer p-2 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                category === "improvement"
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="text-center">
                <div className="text-lg sm:text-2xl mb-1 sm:mb-2">🔧</div>
                <div className="font-medium text-xs sm:text-sm">Improvement</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
                  Enhance existing features
                </div>
              </div>
            </div>
          </div>
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
          loading={isSubmitting}
          type="submit" 
          disabled={isSubmitting || !subject.trim() || !message.trim()}
          className="w-full"
        >
          <>
              <Send className="mr-2 h-4 w-4" />
              Submit Feedback
            </>
        </Button>
      </form>
    </div>
  );
}
