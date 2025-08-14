/**
 * Utility functions for date and time formatting
 */

/**
 * Format a timestamp to a readable date and time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted date and time string
 */
export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
};

/**
 * Format a timestamp to a readable time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-AU', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
};

/**
 * Get a relative time string (e.g., "2 minutes ago", "1 hour ago")
 * @param timestamp Unix timestamp in milliseconds
 * @returns Relative time string
 */
export const getRelativeTimeString = (timestamp: number): string => {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }
  
  return formatDateTime(timestamp);
};

/**
 * Get a compact relative time string (e.g., "2m ago", "1h ago", "3d ago")
 * @param timestamp Unix timestamp in milliseconds
 * @returns Compact relative time string
 */
export const getRelativeTimeCompact = (timestamp: number): string => {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);

  if (diffInSeconds < 60) {
    return 'now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return formatDateTime(timestamp);
};
