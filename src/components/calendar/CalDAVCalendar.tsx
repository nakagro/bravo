import React, { useState, useEffect } from 'react';
import ICAL from 'ical.js';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format, startOfDay, addMonths, addDays } from 'date-fns';

interface CalendarEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  allDay: boolean;
}

interface CalDAVCalendarProps {
  calendarUrl: string;
  maxEvents?: number;
  username?: string;
  password?: string;
}

export function CalDAVCalendar({ 
  calendarUrl, 
  maxEvents = 5, 
  username, 
  password 
}: CalDAVCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseICSWithICAL = (icsData: string): CalendarEvent[] => {
    try {
      const jcalData = ICAL.parse(icsData);
      const vcalendar = new ICAL.Component(jcalData);
      const vevents = vcalendar.getAllSubcomponents('vevent');
      
      const events: CalendarEvent[] = [];
      const now = new Date();
      const futureLimit = addMonths(now, 12);

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);
        
        // Handle recurring events
        if (event.isRecurring()) {
          const iterator = event.iterator();
          let next;
          
          while ((next = iterator.next())) {
            const occurrence = event.getOccurrenceDetails(next);
            const startDate = occurrence.startDate.toJSDate();
            
            // Stop if we've gone too far into the future
            if (startDate > futureLimit) break;
            
            // Only include future events
            if (startDate >= now) {
              events.push({
                uid: `${event.uid}-${startDate.getTime()}`,
                summary: event.summary || 'Untitled Event',
                start: startDate,
                end: occurrence.endDate.toJSDate(),
                description: event.description,
                location: event.location,
                allDay: event.startDate.isDate
              });
            }
          }
        } else {
          // Single occurrence event
          const startDate = event.startDate.toJSDate();
          
          if (startDate >= now) {
            events.push({
              uid: event.uid,
              summary: event.summary || 'Untitled Event',
              start: startDate,
              end: event.endDate.toJSDate(),
              description: event.description,
              location: event.location,
              allDay: event.startDate.isDate
            });
          }
        }
      }

      return events.sort((a, b) => a.start.getTime() - b.start.getTime());
    } catch (err) {
      console.error('Error parsing ICS data:', err);
      throw new Error('Failed to parse calendar data');
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use your proxy endpoint
      const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://localhost:3210';
      let proxyUrl = `${convexUrl}/http/calendar/events?url=${encodeURIComponent(calendarUrl)}`;
      
      if (username && password) {
        proxyUrl += `&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      }
      
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/calendar',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
      }

      const icsData = await response.text();
      const parsedEvents = parseICSWithICAL(icsData);
      
      // Limit to maxEvents
      setEvents(parsedEvents.slice(0, maxEvents));
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
    
    // Refresh events every 30 minutes
    const interval = setInterval(fetchCalendarEvents, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [calendarUrl, maxEvents, username, password]);

  const formatEventDate = (event: CalendarEvent) => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = startOfDay(addDays(today, 1));
    const eventDate = startOfDay(event.start);
    
    if (event.allDay) {
      if (eventDate.getTime() === today.getTime()) {
        return 'Today';
      } else if (eventDate.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
      } else {
        return format(event.start, 'MMM d');
      }
    }
    
    if (eventDate.getTime() === today.getTime()) {
      return format(event.start, 'HH:mm');
    } else if (eventDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow ${format(event.start, 'HH:mm')}`;
    } else {
      return format(event.start, 'MMM d, HH:mm');
    }
  };

  const formatEventDateShort = (event: CalendarEvent) => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = startOfDay(addDays(today, 1));
    const eventDate = startOfDay(event.start);
    
    if (eventDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (eventDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return format(event.start, 'EEE MMM d');
    }
  };

  const formatDuration = (event: CalendarEvent) => {
    if (event.allDay) return null;
    
    const duration = event.end.getTime() - event.start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-colors duration-200">
        <div className="flex items-center mb-3">
          <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Events</h2>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 dark:border-purple-400"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-colors duration-200">
        <div className="flex items-center mb-3">
          <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Events</h2>
        </div>
        <div className="text-center py-4">
          <div className="text-red-600 dark:text-red-400 mb-2 text-sm">Failed to load events</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{error}</div>
          <button
            onClick={fetchCalendarEvents}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-colors duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Events</h2>
        </div>
        <button
          onClick={fetchCalendarEvents}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors px-2 py-1"
        >
          ↻
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6">
          <CalendarIcon className="h-8 w-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.uid}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-20 text-center">
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {formatEventDateShort(event)}
                  </div>
                  {!event.allDay && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {format(event.start, 'HH:mm')}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight mb-1 truncate">
                    {event.summary}
                  </h3>
                  {/* Duration badges removed per user request */}
                  {event.location && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      📍 {event.location}
                    </div>
                  )}
                  {event.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {event.description.length > 60 
                        ? `${event.description.substring(0, 60)}...` 
                        : event.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}