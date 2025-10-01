import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, X, Smartphone, Trash2, Monitor, Tablet } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { formatDistanceToNow } from 'date-fns';
import type { Id } from '../../../../convex/_generated/dataModel';

export function NotificationSettings() {
  const subscriptions = useQuery(api.pushNotifications.getMySubscriptions);
  const recentNotifications = useQuery(api.notificationHistory.getRecentNotifications);
  const deleteSubscription = useMutation(api.pushNotifications.deleteMySubscription);
  
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"pushSubscriptions"> | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        new Notification('Brigade Management System', {
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
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to request notification permission'
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDeleteSubscription = async (id: Id<"pushSubscriptions">) => {
    if (!confirm('Are you sure you want to remove this device? You will no longer receive notifications on it.')) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteSubscription({ id });
      setMessage({
        type: 'success',
        text: 'Device removed successfully'
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to remove device'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getDeviceInfo = (subscription: any) => {
    const userAgent = navigator.userAgent.toLowerCase();
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect device type
    if (/mobile|android|iphone|ipod/.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/ipad|tablet/.test(userAgent)) {
      deviceType = 'tablet';
    }

    // Detect browser
    if (userAgent.includes('chrome')) browser = 'Chrome';
    else if (userAgent.includes('firefox')) browser = 'Firefox';
    else if (userAgent.includes('safari')) browser = 'Safari';
    else if (userAgent.includes('edge')) browser = 'Edge';

    // Detect OS
    if (userAgent.includes('android')) os = 'Android';
    else if (userAgent.includes('iphone') || userAgent.includes('ipad')) os = 'iOS';
    else if (userAgent.includes('mac')) os = 'macOS';
    else if (userAgent.includes('win')) os = 'Windows';
    else if (userAgent.includes('linux')) os = 'Linux';

    return { deviceType, browser, os };
  };

  const getDeviceIcon = (deviceType: 'mobile' | 'tablet' | 'desktop') => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
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
            Enable notifications to receive important updates and alerts from the Brigade Management System.
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

      {/* Permission Request Button */}
      {permission !== 'granted' && (
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

      {/* Subscribed Devices */}
      {permission === 'granted' && subscriptions && subscriptions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Subscribed Devices ({subscriptions.length})
            </h4>
          </div>
          
          <div className="space-y-2">
            {subscriptions.map((sub) => {
              const deviceInfo = getDeviceInfo(sub.subscription);
              return (
                <div
                  key={sub._id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-gray-600 dark:text-gray-400">
                      {getDeviceIcon(deviceInfo.deviceType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {deviceInfo.browser} on {deviceInfo.os}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Registered {formatDistanceToNow(sub.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSubscription(sub._id)}
                    disabled={deletingId === sub._id}
                    className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove this device"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Devices Message */}
      {permission === 'granted' && subscriptions && subscriptions.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            No devices are currently subscribed to notifications. Make sure to allow notifications when prompted by your browser.
          </p>
        </div>
      )}

      {/* Recent Notifications History */}
      {recentNotifications && recentNotifications.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Recent Notifications (Last 24 Hours)
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {recentNotifications.length} notification{recentNotifications.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentNotifications.slice(0, 5).map((notification) => (
              <div
                key={notification._id}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {notification.body}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDistanceToNow(notification.sentAt, { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {recentNotifications.length > 5 && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Showing 5 of {recentNotifications.length} notifications
            </p>
          )}
        </div>
      )}

      {/* Additional Info for PWA */}
      {permission === 'granted' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>💡 PWA Tip:</strong> When you install this app on your device, notifications will work even when the browser is closed.
          </p>
        </div>
      )}
    </div>
  );
}
