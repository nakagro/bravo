import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

interface EmailSettingsProps {
  showTitle?: boolean;
}

export default function EmailSettings({ showTitle = true }: EmailSettingsProps) {
  const emailSettings = useQuery(api.emailSettings.getEmailSettings);
  const updateEmailSetting = useMutation(api.emailSettings.updateEmailSetting);
  const initializeEmailSettings = useMutation(api.emailSettings.initializeEmailSettings);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleToggle = async (emailType: "newUserSignup" | "feedbackSubmission", enabled: boolean) => {
    try {
      await updateEmailSetting({
        emailType,
        enabled,
      });
      toast.success(`Email setting updated successfully`);
    } catch (error) {
      console.error("Failed to update email setting:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update email setting");
    }
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initializeEmailSettings();
      toast.success("Email settings initialized successfully");
    } catch (error) {
      console.error("Failed to initialize email settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to initialize email settings");
    } finally {
      setIsInitializing(false);
    }
  };

  if (!emailSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  // Check if settings need initialization
  const needsInitialization = emailSettings.length === 0;

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-red-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Settings</h2>
        </div>
      )}

      {needsInitialization ? (
        <Card>
          <CardHeader>
            <CardTitle>Initialize Email Settings</CardTitle>
            <CardDescription>
              Email settings have not been initialized yet. Click the button below to set up default email settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              loading={isInitializing}
              onClick={handleInitialize}
              disabled={isInitializing}
              className="bg-red-600 hover:bg-red-700"
            >
              <>
                  <Mail className="mr-2 h-4 w-4" />
                  Initialize Email Settings
                </>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Control which automated emails are sent by the system. Disabling an email will prevent it from being sent to any users.
          </p>

          {emailSettings.map((setting) => {
            const emailTypeLabels = {
              newUserSignup: "New User Signup Notification",
              feedbackSubmission: "Feedback Submission Notification",
            };

            const emailTypeDescriptions = {
              newUserSignup: "Send email to all admins when a new user signs up for the system",
              feedbackSubmission: "Send email to all admins when a user submits feedback",
            };

            return (
              <Card key={setting._id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {emailTypeLabels[setting.emailType]}
                      </CardTitle>
                      <CardDescription>
                        {emailTypeDescriptions[setting.emailType]}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`email-${setting.emailType}`}
                        checked={setting.enabled}
                        onCheckedChange={(checked) => handleToggle(setting.emailType, checked)}
                      />
                      <Label
                        htmlFor={`email-${setting.emailType}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {setting.enabled ? "Enabled" : "Disabled"}
                      </Label>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Changes take effect immediately. Disabled emails will not be sent until re-enabled.
            </p>
          </div>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Reinitialize Email Settings</CardTitle>
              <CardDescription>
                Add any new email notification types that have been added to the system. This will not affect existing settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                loading={isInitializing}
                onClick={handleInitialize}
                disabled={isInitializing}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reinitialize Settings
                  </>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
