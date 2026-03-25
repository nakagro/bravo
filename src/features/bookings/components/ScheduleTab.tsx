import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addDays, startOfWeek, isToday, eachDayOfInterval, parse } from "date-fns";
import { enAU } from "date-fns/locale";
import { formatTime, formatUserName, parseBookingDate } from "../types";
import { BookingEditForm } from "./BookingEditForm";
import { EmptyState } from "../../../components/shared/EmptyState";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InboxIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

interface ScheduleTabProps {
  isAdmin?: boolean;
  initialDate?: string;
}

export function ScheduleTab({ isAdmin = false, initialDate }: ScheduleTabProps) {
  const isMobile = useIsMobile();
  const [selectedResource, setSelectedResource] = useState<Id<"bookingResources"> | 'all'>('all');
  const [editingBookingId, setEditingBookingId] = useState<Id<"bookings"> | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const targetDate = initialDate ? parseBookingDate(initialDate) : new Date();
    return startOfWeek(targetDate, { weekStartsOn: 1 });
  });

  const activeResources = useQuery(api.bookings.getActiveBookingResources);

  // Calculate date range for the current week
  const dateRange = useMemo(() => ({
    startDate: format(currentWeekStart, "yyyy-MM-dd"),
    endDate: format(addDays(currentWeekStart, 6), "yyyy-MM-dd"),
  }), [currentWeekStart]);

  const bookings = useQuery(
    api.bookings.getBookingsForDateRange,
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      resourceId: selectedResource === 'all' ? undefined : selectedResource,
    }
  );

  // Generate days of the week
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: currentWeekStart,
      end: addDays(currentWeekStart, 6),
    }).map((date) => ({
      date,
      dateStr: format(date, "yyyy-MM-dd"),
      dayName: format(date, "EEE", { locale: enAU }),
      dayNum: date.getDate(),
      monthName: format(date, "MMM", { locale: enAU }),
      isToday: isToday(date),
    }));
  }, [currentWeekStart]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, typeof bookings> = {};
    if (!bookings) return grouped;

    for (const booking of bookings) {
      const start = parseBookingDate(booking.startDate);
      const end = parseBookingDate(booking.endDate || booking.startDate);

      for (const day of eachDayOfInterval({ start, end })) {
        const dateStr = format(day, "yyyy-MM-dd");
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr]!.push(booking);
      }
    }
    return grouped;
  }, [bookings]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Format booking display info (user or reason for blocked)
  const formatBookingInfo = (booking: any) => {
    if (booking.isBlocked) {
      return booking.notes || 'Blocked';
    }
    return formatUserName(booking.requestedByUser);
  };

  const getStatusClasses = (status: string, isBlocked?: boolean) => {
    if (isBlocked) {
      return 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600';
    }
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600';
      case 'approved':
        return 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600';
    }
  };

  const getStatusTextClasses = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-800 dark:text-yellow-200';
      case 'approved':
        return 'text-green-800 dark:text-green-200';
      default:
        return 'text-gray-800 dark:text-gray-200';
    }
  };

  const weekRangeLabel = `${weekDays[0].dayNum} ${weekDays[0].monthName} - ${weekDays[6].dayNum} ${weekDays[6].monthName}`;

  return (
    <>
      {/* Booking Edit Modal - Admin only */}
      {editingBookingId && (
        <BookingEditForm
          bookingId={editingBookingId}
          onClose={() => setEditingBookingId(null)}
        />
      )}

      {/* Header with navigation */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-medium flex items-center">
              <CalendarDaysIcon className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
              Booking Schedule
            </h2>
            
            <div className="flex items-center gap-2">
              <label htmlFor="resourceFilter" className="text-sm font-medium whitespace-nowrap">Filter:</label>
              <select
                id="resourceFilter"
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value as Id<"bookingResources"> | 'all')}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
              >
                <option value="all">All resources</option>
                {activeResources?.map((resource) => (
                  <option key={resource._id} value={resource._id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="p-3">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center text-sm"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              {!isMobile && <span className="ml-1">Previous</span>}
            </button>
            
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${isMobile ? 'text-sm' : 'text-base'}`}>{weekRangeLabel}</span>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Today
              </button>
            </div>
            
            <button
              onClick={() => navigateWeek('next')}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center text-sm"
            >
              {!isMobile && <span className="mr-1">Next</span>}
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop: Week grid */}
          {!isMobile && (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`text-center p-2 rounded-t border-b-2 ${
                    day.isToday
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400">{day.dayName}</div>
                  <div className={`text-lg font-bold ${day.isToday ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {day.dayNum}
                  </div>
                </div>
              ))}

              {/* Day content */}
              {weekDays.map((day) => {
                const dayBookings = bookingsByDate[day.dateStr] || [];
                
                return (
                  <div
                    key={`content-${day.dateStr}`}
                    className={`min-h-[100px] p-1 border rounded-b ${
                      day.isToday
                        ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {dayBookings.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {dayBookings.map((booking) => (
                          <div
                            key={`${booking._id}-${day.dateStr}`}
                            onClick={() => isAdmin && setEditingBookingId(booking._id)}
                            className={`p-1.5 rounded text-xs border-l-2 ${getStatusClasses(booking.status, booking.isBlocked)} ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all' : ''}`}
                          >
                            <div className={`font-medium truncate ${getStatusTextClasses(booking.status)}`}>
                              {booking.resource?.name}
                            </div>
                            {booking.isAllDay ? (
                              <div className="text-[10px] opacity-75">All day</div>
                            ) : booking.startTime && booking.endTime ? (
                              <div className="text-[10px] opacity-75 flex items-center gap-0.5">
                                <ClockIcon className="h-3 w-3" />
                                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              </div>
                            ) : null}
                            <div className="text-[10px] opacity-75 truncate">
                              {formatBookingInfo(booking)}
                            </div>
                            {!booking.isBlocked && booking.notes && (
                              <div className="text-[10px] opacity-60 truncate italic">
                                {booking.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile: Day-by-day list view */}
          {isMobile && (
            <div className="space-y-2">
              {weekDays.map((day) => {
                const dayBookings = bookingsByDate[day.dateStr] || [];
                
                return (
                  <div
                    key={day.dateStr}
                    className={`rounded border overflow-hidden ${
                      day.isToday
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* Day header */}
                    <div
                      className={`flex items-center justify-between px-3 py-2 ${
                        day.isToday
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${day.isToday ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {day.dayNum}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {day.dayName}, {day.monthName}
                        </span>
                        {day.isToday && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                      </span>
                    </div>
                    
                    {/* Day bookings */}
                    <div className="p-2">
                      {dayBookings.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                          No bookings
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dayBookings.map((booking) => (
                            <div
                              key={`${booking._id}-${day.dateStr}`}
                              onClick={() => isAdmin && setEditingBookingId(booking._id)}
                              className={`p-3 rounded border-l-4 ${getStatusClasses(booking.status, booking.isBlocked)} ${isAdmin ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium ${getStatusTextClasses(booking.status)}`}>
                                    {booking.resource?.name}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                    <ClockIcon className="h-4 w-4 flex-shrink-0" />
                                    {booking.isAllDay ? (
                                      'All day'
                                    ) : booking.startTime && booking.endTime ? (
                                      `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
                                    ) : (
                                      'All day'
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    {formatBookingInfo(booking)}
                                  </div>
                                  {!booking.isBlocked && booking.notes && (
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
                                      {booking.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {booking.status === 'pending' && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                      Pending
                                    </span>
                                  )}
                                  {booking.isBlocked && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                      Blocked
                                    </span>
                                  )}
                                  {isAdmin && (
                                    <PencilSquareIcon className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded p-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium">Legend:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-50 dark:bg-green-900/30 border-l-2 border-green-400 dark:border-green-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-yellow-50 dark:bg-yellow-900/30 border-l-2 border-yellow-400 dark:border-yellow-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-50 dark:bg-red-900/30 border-l-2 border-red-400 dark:border-red-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Blocked</span>
          </div>
        </div>
      </div>

      {/* Upcoming bookings list - only show on desktop */}
      {!isMobile && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
              This Week's Bookings
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {!bookings || bookings.length === 0 ? (
              <EmptyState
                icon={<InboxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
                title="No bookings scheduled for this week"
              />
            ) : (
              bookings.map((booking) => (
                  <div
                    key={booking._id}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {format(parseBookingDate(booking.startDate), "EEE", { locale: enAU })}
                          </div>
                          <div className="text-lg font-bold">{parseBookingDate(booking.startDate).getDate()}</div>
                        </div>
                        <div>
                          <div className="font-medium">{booking.resource?.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {booking.isAllDay ? (
                              'All day'
                            ) : booking.startTime && booking.endTime ? (
                              `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
                            ) : (
                              'All day'
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {booking.isBlocked ? (booking.notes || 'Blocked') : `Booked by ${formatUserName(booking.requestedByUser)}`}
                          </div>
                          {!booking.isBlocked && booking.notes && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5">
                              {booking.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        booking.isBlocked
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          : booking.status === 'approved' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                      }`}>
                        {booking.isBlocked ? 'Blocked' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>
                  </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
