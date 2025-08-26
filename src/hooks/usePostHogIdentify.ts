import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * Hook to automatically identify users with PostHog when they authenticate
 */
export function usePostHogIdentify() {
  const posthog = usePostHog();
  const user = useQuery(api.auth.loggedInUser);

  useEffect(() => {
    if (!posthog || !user) return;

    // Identify the user with PostHog
    posthog.identify(user._id, {
      name: user.name || 'Unknown',
      email: user.email || undefined,
      isAdmin: user.isAdmin || false,
      rank: user.rank || undefined,
      // Add any other user properties you want to track
      $set: {
        name: user.name || 'Unknown',
        email: user.email || undefined,
        isAdmin: user.isAdmin || false,
        rank: user.rank || undefined,
      }
    });

    // Set user properties that PostHog can use for feature flags and cohorts
    posthog.setPersonProperties({
      name: user.name || 'Unknown',
      email: user.email || undefined,
      isAdmin: user.isAdmin || false,
      rank: user.rank || undefined,
    });

  }, [posthog, user]);

  return { user, posthog };
}
