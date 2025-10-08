import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, X } from 'lucide-react';

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);
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
    } catch (error) {
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

      {/* Additional Info for PWA */}
      {permission === 'granted' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>PWA Tip:</strong> When you install this app on your device, notifications will work even when the browser is closed.
          </p>
        </div>
      )}
    </div>
  );
}
