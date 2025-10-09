"use node";

import { PostHog } from "posthog-node";

// Initialize PostHog client for server-side tracking
let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    console.warn("PostHog API key not configured. Analytics tracking disabled.");
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host,
      flushAt: 1, // Send events immediately in development
      flushInterval: 10000, // Flush every 10 seconds in production
    });
  }

  return posthogClient;
}

/**
 * Track a notification event in PostHog
 */
export async function trackNotificationEvent(params: {
  eventName: string;
  notificationType?: string;
  source?: string;
  userId?: string;
  recipientCount?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const client = getPostHogClient();
  
  if (!client) {
    // Analytics disabled, skip silently
    return;
  }

  try {
    const properties = {
      notification_type: params.notificationType,
      source: params.source,
      recipient_count: params.recipientCount,
      success: params.success,
      error: params.error,
      timestamp: new Date().toISOString(),
      ...params.metadata,
    };

    // Use a distinct ID - either the userId or a system identifier
    const distinctId = params.userId || "system";

    client.capture({
      distinctId,
      event: params.eventName,
      properties,
    });

    // Ensure events are sent
    await client.flush();
  } catch (error) {
    // Don't let analytics failures break the application
    console.error("Failed to track PostHog event:", error);
  }
}

/**
 * Track when a cron job sends notifications
 */
export async function trackCronNotification(params: {
  cronName: string;
  notificationType: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  duration?: number;
}): Promise<void> {
  await trackNotificationEvent({
    eventName: "cron_notification_sent",
    notificationType: params.notificationType,
    source: `cron:${params.cronName}`,
    recipientCount: params.recipientCount,
    success: params.successCount > 0,
    metadata: {
      success_count: params.successCount,
      failure_count: params.failureCount,
      duration_ms: params.duration,
    },
  });
}

/**
 * Track individual notification delivery
 */
export async function trackNotificationDelivery(params: {
  userId: string;
  notificationType?: string;
  source?: string;
  title: string;
  success: boolean;
  error?: string;
  hasSubscription: boolean;
  deviceType?: string;
  platform?: string;
  browser?: string;
}): Promise<void> {
  await trackNotificationEvent({
    eventName: "notification_delivered",
    notificationType: params.notificationType,
    source: params.source,
    userId: params.userId,
    success: params.success,
    error: params.error,
    metadata: {
      title: params.title,
      has_subscription: params.hasSubscription,
      device_type: params.deviceType,
      platform: params.platform,
      browser: params.browser,
    },
  });
}

/**
 * Shutdown PostHog client gracefully
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
