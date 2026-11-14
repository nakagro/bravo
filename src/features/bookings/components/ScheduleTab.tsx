import { useState, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addDays, startOfWeek, isToday, eachDayOfInterval } from "date-fns";
import { enAU } from "date-fns/locale";
import { formatTime, formatUserName, formatStatus, parseBookingDate, getTodayStr } from "../types";
import { BookingEditForm } from "./BookingEditForm";
import { BookingRequestForm } from "./BookingRequestForm";
import { DateBadge, StatusBadge } from "./badges";
import { EmptyState } from "../../../components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Clock, Inbox, SquarePen, Plus } from "lucide-react";

interface ScheduleTabProps {
  isAdmin?: boolean;
  initialDate?: string;
}

export function ScheduleTab({ isAdmin = false, initialDate }: ScheduleTabProps) {
  const isMobile = useIsMobile();
  const [selectedResource, setSelectedResource] = useState<Id<"bookingResources"> | 'all'>('all');
  const [editingBookingId, setEditingBookingId] = useState<Id<"bookings"> | null>(null);
  const [bookingFormDate, setBookingFormDate] = useState<string | null>(null);
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

  // Swipe left/right on the calendar area changes weeks
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigateWeek(dx < 0 ? 'next' : 'prev');
    }
  };

  // Format booking display info (user or reason for blocked)
  const formatBookingInfo = (booking: any) => {
    if (booking.isBlocked) {
      return booking.notes || 'Blocked';
    }
    return formatUserName(booking.requestedByUser);
  };

  // Stripes for blocked: the calendar idiom for "unavailable", keeping red
  // for actions and genuine errors
  const blockedClasses =
    'bg-gray-100 dark:bg-gray-700/60 border-gray-400 dark:border-gray-500 ' +
    '[background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.05)_4px,rgba(0,0,0,0.05)_8px)] ' +
    'dark:[background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.05)_4px,rgba(255,255,255,0.05)_8px)]';

  const getStatusClasses = (status: string, isBlocked?: boolean) => {
    if (isBlocked) {
      return blockedClasses;
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

  const getStatusTextClasses = (status: string, isBlocked?: boolean) => {
    if (isBlocked) {
      return 'text-gray-700 dark:text-gray-200';
    }
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
  const isLoadingBookings = bookings === undefined;
  const today = getTodayStr();

  return (
    <>
      {/* Booking Edit Modal - Admin only */}
      {editingBookingId && (
        <BookingEditForm
          bookingId={editingBookingId}
          onClose={() => setEditingBookingId(null)}
        />
      )}

      {/* Booking Request Modal - opened by tapping a day */}
      {bookingFormDate && (
        <BookingRequestForm
          initialDate={bookingFormDate}
          initialResourceId={selectedResource === 'all' ? undefined : selectedResource}
          onClose={() => setBookingFormDate(null)}
        />
      )}

      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="p-3 space-y-3">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateWeek('prev')}
              aria-label="Previous week"
              className="px-3 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <ChevronLeft className="h-5 w-5" />
              {!isMobile && <span className="ml-1">Previous</span>}
            </button>

            <div className="flex items-center gap-2">
              <span className={`font-semibold ${isMobile ? 'text-sm' : 'text-base'}`}>{weekRangeLabel}</span>
              <button
                onClick={goToToday}
                className="px-3 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Today
              </button>
            </div>

            <button
              onClick={() => navigateWeek('next')}
              aria-label="Next week"
              className="px-3 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {!isMobile && <span className="mr-1">Next</span>}
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Resource filter */}
          <Select
            value={selectedResource}
            onValueChange={(value) => setSelectedResource(value as Id<"bookingResources"> | 'all')}
          >
            <SelectTrigger
              aria-label="Filter by resource"
              className="w-full sm:w-72 h-11 text-base sm:text-sm rounded-lg"
            >
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              {activeResources?.map((resource) => (
                <SelectItem key={resource._id} value={resource._id}>
                  {resource.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-3 pt-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Desktop: Week grid */}
          {!isMobile && (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`text-center p-2 rounded-t-lg border-b-2 ${
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
                const isPast = day.dateStr < today;

                return (
                  <div
                    key={`content-${day.dateStr}`}
                    className={`min-h-[100px] p-1 border rounded-b-lg flex flex-col ${
                      day.isToday
                        ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {isLoadingBookings ? (
                      <Skeleton className="h-10 w-full rounded" />
                    ) : (
                      <div className="space-y-1 flex-1">
                        {dayBookings.map((booking) => (
                          <div
                            key={`${booking._id}-${day.dateStr}`}
                            onClick={() => isAdmin && setEditingBookingId(booking._id)}
                            className={`p-1.5 rounded text-xs border-l-2 ${getStatusClasses(booking.status, booking.isBlocked)} ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all' : ''}`}
                          >
                            <div className={`font-medium truncate ${getStatusTextClasses(booking.status, booking.isBlocked)}`}>
                              {booking.resource?.name}
                            </div>
                            <div className={`text-[11px] font-semibold ${getStatusTextClasses(booking.status, booking.isBlocked)}`}>
                              {booking.isBlocked ? 'Blocked' : formatStatus(booking.status)}
                            </div>
                            {booking.isAllDay ? (
                              <div className="text-[11px] opacity-75">All day</div>
                            ) : booking.startTime && booking.endTime ? (
                              <div className="text-[11px] opacity-75 flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              </div>
                            ) : null}
                            <div className="text-[11px] opacity-75 truncate">
                              {formatBookingInfo(booking)}
                            </div>
                            {!booking.isBlocked && booking.notes && (
                              <div className="text-[11px] opacity-60 truncate italic">
                                {booking.notes}
                              </div>
                            )}
                          </div>
                        ))}
                        {!isPast && (
                          <button
                            onClick={() => setBookingFormDate(day.dateStr)}
                            aria-label={`Book ${day.dayName} ${day.dayNum} ${day.monthName}`}
                            className="w-full py-1 rounded text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile: Day-by-day list view */}
          {isMobile && isLoadingBookings && (
            <div className="space-y-2">
              {weekDays.map((day) => (
                <Skeleton key={day.dateStr} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}
          {isMobile && !isLoadingBookings && (
            <div className="space-y-2">
              {weekDays.map((day) => {
                const dayBookings = bookingsByDate[day.dateStr] || [];
                const isPast = day.dateStr < today;

                return (
                  <div
                    key={day.dateStr}
                    className={`rounded-lg border overflow-hidden ${
                      day.isToday
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* Day header */}
                    <div
                      className={`flex items-center justify-between pl-3 pr-1 py-1 ${
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
                      <div className="flex items-center gap-1">
                        {dayBookings.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                          </span>
                        )}
                        {!isPast && (
                          <button
                            onClick={() => setBookingFormDate(day.dateStr)}
                            aria-label={`Book ${day.dayName} ${day.dayNum} ${day.monthName}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Day bookings (collapsed entirely when empty) */}
                    {dayBookings.length > 0 && (
                      <div className="p-2">
                        <div className="space-y-2">
                          {dayBookings.map((booking) => (
                            <div
                              key={`${booking._id}-${day.dateStr}`}
                              onClick={() => isAdmin && setEditingBookingId(booking._id)}
                              className={`p-3 rounded-lg border-l-4 ${getStatusClasses(booking.status, booking.isBlocked)} ${isAdmin ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium ${getStatusTextClasses(booking.status, booking.isBlocked)}`}>
                                    {booking.resource?.name}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="h-4 w-4 flex-shrink-0" />
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
                                  <StatusBadge status={booking.status} isBlocked={booking.isBlocked} />
                                  {isAdmin && (
                                    <SquarePen className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming bookings list - only show on desktop */}
      {!isMobile && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              This Week's Bookings
            </h3>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoadingBookings ? (
              <div className="p-3 space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-14 w-[50px] rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : bookings.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
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
                        <DateBadge dateStr={booking.startDate} />
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
                      <StatusBadge status={booking.status} isBlocked={booking.isBlocked} />
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
