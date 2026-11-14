import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../../components/ui/button";
import { Mail } from "lucide-react";
import { toast } from "sonner";

interface TestEmailButtonProps {
  userEmail: string;
  userName: string;
}

export function TestEmailButton({ userEmail, userName }: TestEmailButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const sendTestEmail = useAction(api.emails.sendTestEmail);

  const handleSendTestEmail = async () => {
    setIsSending(true);
    try {
      await sendTestEmail({
        to: userEmail,
        userName: userName,
      });
      
      toast.success("Test email sent!", {
        description: `Check your inbox at ${userEmail}`,
      });
    } catch (error) {
      console.error("Failed to send test email:", error);
      toast.error("Failed to send test email", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Email Testing
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Send a test email to verify your email address is working correctly.
        </p>
      </div>
      
      <Button
        loading={isSending}
        onClick={handleSendTestEmail}
        disabled={isSending}
        variant="outline"
        className="w-full sm:w-auto"
      >
        <>
            <Mail className="mr-2 h-4 w-4" />
            Send Test Email
          </>
      </Button>
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Email will be sent to: <span className="font-medium">{userEmail}</span>
      </p>
    </div>
  );
}
