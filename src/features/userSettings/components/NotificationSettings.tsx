import React, { useState, useEffect } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';
import { NotificationPrefsList } from './NotificationPrefsList';
import { openInstallPrompt, resolveInstallPlatform } from '@/lib/installState';
import {
  Bell,
  BellOff,
  Check,
  X,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  Send,
  Download,
} from "lucide-react";
import { errorMessage } from "@/lib/errors";

const DEVICE_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
} as const;

function DeviceList() {
  const subscriptions = useQuery(api.pushNotifications.getMySubscriptions);
  const sendTest = useAction(api.pushNotificationAction.sendTestNotificationToSelf);
  const removeSubscription = useMutation(api.pushNotifications.deleteMySubscription);

  const [testingId, setTestingId] = useState<Id<"pushSubscriptions"> | "all" | null>(null);
  const [removingId, setRemovingId] = useState<Id<"pushSubscriptions"> | null>(null);

  const handleTest = async (subscriptionId?: Id<"pushSubscriptions">) => {
    setTestingId(subscriptionId ?? "all");
    try {
      const result = await sendTest(subscriptionId ? { subscriptionId } : {});
      if (result.sentCount > 0) {
        toast.success(
          result.sentCount === 1
            ? "Test notification sent, check this device."
            : `Test notification sent to ${result.sentCount} device(s).`
        );
      }
      if (result.failedCount > 0) {
        toast.error(
          `Failed to send to ${result.failedCount} device(s). They may need to be removed and re-registered.`
        );
      }
    } catch (error) {
      toast.error("Failed to send test notification", {
        description: errorMessage(error, "Unknown error occurred"),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleRemove = async (subscriptionId: Id<"pushSubscriptions">) => {
    setRemovingId(subscriptionId);
    try {
      await removeSubscription({ id: subscriptionId });
      toast.success("Device removed");
    } catch (error) {
      toast.error("Failed to remove device", {
        description: errorMessage(error, "Unknown error occurred"),
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (subscriptions === undefined) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading registered devices...
      </p>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No devices are currently registered for push notifications on this account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          Registered Devices
        </h4>
        {subscriptions.length > 1 && (
          <Button
            onClick={() => handleTest(undefined)}
            disabled={testingId !== null}
            loading={testingId === "all"}
            variant="outline"
            size="sm"
          >
            <Send className="mr-2 h-4 w-4" />
            Test All Devices
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {subscriptions.map((sub) => {
          const Icon = DEVICE_ICONS[sub.deviceType ?? "desktop"] ?? Monitor;
          const label = [sub.platform, sub.browser].filter(Boolean).join(" · ") || "Unknown device";

          return (
            <div
              key={sub._id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="h-5 w-5 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Registered {new Date(sub.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => handleTest(sub._id)}
                  disabled={testingId !== null}
                  loading={testingId === sub._id}
                  variant="outline"
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Test</span>
                </Button>
                <Button
                  onClick={() => handleRemove(sub._id)}
                  disabled={removingId !== null}
                  loading={removingId === sub._id}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Remove</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        If a device isn't receiving notifications, try removing it here and re-enabling
        notifications on that device to re-register it.
      </p>
    </div>
  );
}

function NotificationTypePrefs() {
  const rows = useQuery(api.notificationPrefs.getMyNotificationPrefs);
  const setPref = useMutation(api.notificationPrefs.setMyNotificationPref);
  return (
    <NotificationPrefsList
      rows={rows}
      onChange={(category, enabled) => setPref({ category, enabled })}
    />
  );
}

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // On iPhone/iPad, web push only exists inside the installed app. Asking for
  // permission from a Safari tab fails silently, so explain the install step
  // instead of showing a button that cannot work.
  const [installPlatform] = useState(() => resolveInstallPlatform());
  const needsInstallForPush = installPlatform === 'ios-safari' || installPlatform === 'ios-other';

  useEffect(() => {
    // Check current notification permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setMessage({
        type: 'error',
        text: 'This browser does not support notifications'
      });
      return;
    }

    setIsRequesting(true);
    setMessage(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setMessage({
          type: 'success',
          text: 'Notifications enabled successfully!'
        });
        
        // Show a test notification
        new Notification('BRAVO', {
          body: 'Notifications are now enabled for this device.',
          icon: '/favicon.ico'
        });
      } else if (result === 'denied') {
        setMessage({
          type: 'error',
          text: 'Notifications were denied. You can enable them in your browser settings.'
        });
      } else {
        setMessage({
          type: 'error',
          text: 'Notification permission was dismissed.'
        });
      }
    } catch  {
      setMessage({
        type: 'error',
        text: 'Failed to request notification permission'
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: <Check className="h-5 w-5 text-green-600" />,
          text: 'Notifications are enabled',
          color: 'text-green-600'
        };
      case 'denied':
        return {
          icon: <X className="h-5 w-5 text-red-600" />,
          text: 'Notifications are blocked',
          color: 'text-red-600'
        };
      default:
        return {
          icon: <BellOff className="h-5 w-5 text-gray-500" />,
          text: 'Notifications not configured',
          color: 'text-gray-500'
        };
    }
  };

  const status = getPermissionStatus();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Push Notifications
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enable notifications to receive important updates and alerts from BRAVO.
          </p>
        </div>
        <Bell className="h-6 w-6 text-gray-400" />
      </div>

      {/* Current Status */}
      <div className="flex items-center gap-2">
        {status.icon}
        <span className={`text-sm font-medium ${status.color}`}>
          {status.text}
        </span>
      </div>

      {/* iOS in a browser tab: push is impossible until installed */}
      {permission !== 'granted' && needsInstallForPush && (
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Install BRAVO first.</strong> On iPhone and iPad, notifications only
              work when BRAVO is added to your home screen and opened from there.
            </p>
          </div>
          <button
            onClick={openInstallPrompt}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
          >
            <Download className="h-4 w-4" />
            Show me how to install
          </button>
        </div>
      )}

      {/* Permission Request Button */}
      {permission !== 'granted' && !needsInstallForPush && (
        <div className="space-y-3">
          <button
            onClick={requestNotificationPermission}
            disabled={isRequesting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors duration-200"
          >
            <Bell className="h-4 w-4" />
            {isRequesting ? 'Requesting...' : 'Enable Notifications'}
          </button>
          
          {permission === 'denied' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              If notifications are blocked, you'll need to enable them manually in your browser settings for this site.
            </p>
          )}
        </div>
      )}

      {/* Success/Error Messages */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Additional Info for PWA */}
      {permission === 'granted' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>PWA Tip:</strong> When you install this app on your device, notifications will work even when the browser is closed.
          </p>
        </div>
      )}

      {/* Which kinds of push this member wants */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            What to notify me about
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Switching one off only stops the push. It still shows in BRAVO and your Action Centre.
          </p>
        </div>
        <NotificationTypePrefs />
      </div>

      {/* Registered devices, testing, and removal */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <DeviceList />
      </div>
    </div>
  );
}
