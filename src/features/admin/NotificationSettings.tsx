import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Clock, Moon } from "lucide-react";
import { toast } from "sonner";
import { MessageTemplates } from "./MessageTemplates";
import { Spinner } from "@/components/ui/spinner";

interface NotificationSettingsProps {
  showTitle?: boolean;
}

export default function NotificationSettings({ showTitle = true }: NotificationSettingsProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState<Record<string, boolean>>({});

  const settings = useQuery(api.notificationSettings.getNotificationSettings);
  const initializeSettings = useMutation(api.notificationSettings.initializeNotificationSettings);
  const updateSetting = useMutation(api.notificationSettings.updateNotificationSetting);

  const handleInitialize = async () => {
    try {
      setIsInitializing(true);
      const created = await initializeSettings();
      toast.success(`Initialized ${created} notification settings`);
    } catch (error) {
      toast.error("Failed to initialize notification settings");
      console.error("Error initializing settings:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleSetting = async (notificationType: "nightlyReset" | "morningReminder", enabled: boolean) => {
    try {
      setUpdatingSettings(prev => ({ ...prev, [notificationType]: true }));
      await updateSetting({ notificationType, enabled });
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${getNotificationDisplayName(notificationType)} notifications`);
    } catch (error) {
      toast.error("Failed to update notification setting");
      console.error("Error updating setting:", error);
    } finally {
      setUpdatingSettings(prev => ({ ...prev, [notificationType]: false }));
    }
  };

  const getNotificationDisplayName = (type: string) => {
    switch (type) {
      case "nightlyReset":
        return "Daily Reset";
      case "morningReminder":
        return "Morning Reminder";
      default:
        return type;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "nightlyReset":
        return <Moon className="h-5 w-5" />;
      case "morningReminder":
        return <Clock className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationTime = (type: string) => {
    switch (type) {
      case "nightlyReset":
        return "4:00 AM";
      case "morningReminder":
        return "10:00 AM";
      default:
        return "Unknown";
    }
  };

  if (settings === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="size-6 text-muted-foreground" />
        <span className="ml-2 text-gray-500">Loading notification settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-component="NotificationSettings">
      {showTitle && (
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Notification Settings
          </h2>
        </div>
      )}

      {settings.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellOff className="h-5 w-5" />
              No Notification Settings Found
            </CardTitle>
            <CardDescription>
              Initialize the default notification settings to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              loading={isInitializing}
              onClick={handleInitialize} 
              disabled={isInitializing}
              className="w-full"
            >
              <>
                  <Bell className="h-4 w-4 mr-2" />
                  Initialize Notification Settings
                </>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {settings.map((setting) => (
            <Card key={setting._id} className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getNotificationIcon(setting.notificationType)}
                    <div>
                      <CardTitle className="text-lg">
                        {getNotificationDisplayName(setting.notificationType)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        Scheduled at {getNotificationTime(setting.notificationType)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={setting.enabled ? "default" : "secondary"}>
                      {setting.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={(enabled) => 
                        handleToggleSetting(setting.notificationType, enabled)
                      }
                      disabled={updatingSettings[setting.notificationType]}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {setting.description}
                </p>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  Last updated: {new Date(setting.updatedAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">More notification types can be added in the future</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <MessageTemplates />
    </div>
  );
}
