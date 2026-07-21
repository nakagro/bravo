import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import {
    ArrowLeft,
    Flame,
    GraduationCap,
    X,
    Check,
    Pencil,
    CalendarDays,
    Clock,
    ChevronLeft,
    ChevronRight,
    Delete,
} from 'lucide-react';
import { toast } from 'sonner';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import { RANK_ORDER, isBARecordMemberOption } from '@/features/baSkills/memberEligibility';
import { getServiceToken } from '@/features/serviceAccounts/ServiceAccountContext';

interface KioskBAUsageProps {
    onBack: () => void;
}

type UsageType = 'firecall' | 'drill';

const DURATION_PRESETS = [15, 20, 30, 45];
const MAX_DURATION_DIGITS = 3; // covers the backend's 480-minute cap

const USAGE_TYPES: Array<{ key: UsageType; title: string; Icon: typeof Flame }> = [
    { key: 'firecall', title: 'Fire Call', Icon: Flame },
    { key: 'drill', title: 'Training', Icon: GraduationCap },
];

// Local-date helpers — Date#toISOString() is UTC, which silently rolls
// "today" back a day for AEDT/AEST users in the early morning.
function formatISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function todayISO() {
    return formatISO(new Date());
}

function yesterdayISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatISO(d);
}

function formatDisplayDate(iso: string): string {
    if (iso === todayISO()) return 'Today';
    if (iso === yesterdayISO()) return 'Yesterday';
    return parseISO(iso).toLocaleDateString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

interface MemberLite {
    _id: Id<'users'>;
    name: string;
    rank?: string;
}

// Tap-only tile grid — this kiosk's touch keyboard is unreliable, so member
// and verifier pickers avoid typed search entirely in favour of a full list.
function MemberTileGrid({
    members,
    isSelected,
    onToggle,
}: {
    members: MemberLite[];
    isSelected: (id: Id<'users'>) => boolean;
    onToggle: (id: Id<'users'>) => void;
}) {
    if (members.length === 0) {
        return (
            <p className="text-lg text-slate-400">
                No members with BA skills are set up yet.
            </p>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {members.map((member) => {
                const active = isSelected(member._id);
                return (
                    <button
                        key={member._id}
                        type="button"
                        onClick={() => onToggle(member._id)}
                        className={`relative flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-4 text-left transition-all active:scale-[0.98] ${
                            active
                                ? 'border-red-500 bg-red-950/40'
                                : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                        }`}
                    >
                        <div className="min-w-0">
                            <div className={`truncate text-lg font-semibold ${active ? 'text-white' : 'text-slate-200'}`}>
                                {member.name}
                            </div>
                            {member.rank && (
                                <div className="truncate text-sm text-slate-400">{member.rank}</div>
                            )}
                        </div>
                        {active && (
                            <div className="shrink-0 rounded-full bg-red-500 p-1">
                                <Check className="h-4 w-4 text-white" />
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// Full-screen date picker — big "Today"/"Yesterday" shortcuts plus a calendar
// grid for anything older. Native <input type="date"> renders a tiny, fiddly
// picker on this tablet's browser, so this replaces it entirely.
function DatePickerModal({
    value,
    onChange,
    onClose,
}: {
    value: string;
    onChange: (iso: string) => void;
    onClose: () => void;
}) {
    const [viewMonth, setViewMonth] = useState(() => {
        const d = parseISO(value);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const today = new Date();
    const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const isCurrentMonth = viewMonth.getTime() === todayMonthStart.getTime();

    const cells = useMemo(() => {
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const firstWeekday = new Date(year, month, 1).getDay();
        const numDays = new Date(year, month + 1, 0).getDate();
        const result: Array<{ date: Date; iso: string } | null> = [];
        for (let i = 0; i < firstWeekday; i++) result.push(null);
        for (let day = 1; day <= numDays; day++) {
            const date = new Date(year, month, day);
            result.push({ date, iso: formatISO(date) });
        }
        return result;
    }, [viewMonth]);

    const pick = (iso: string) => {
        onChange(iso);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col">
            <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Select Date</h3>
                <button
                    onClick={onClose}
                    className="p-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl active:bg-slate-700 transition"
                    aria-label="Close"
                >
                    <X className="h-8 w-8" />
                </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => pick(todayISO())}
                        className="rounded-3xl border-2 border-slate-700 bg-slate-900 py-6 text-2xl font-bold text-white hover:border-red-500 active:scale-[0.98] transition-all"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => pick(yesterdayISO())}
                        className="rounded-3xl border-2 border-slate-700 bg-slate-900 py-6 text-2xl font-bold text-white hover:border-red-500 active:scale-[0.98] transition-all"
                    >
                        Yesterday
                    </button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col rounded-3xl border-2 border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex-none flex items-center justify-between mb-4">
                        <button
                            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                            className="p-3 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="h-7 w-7" />
                        </button>
                        <h4 className="text-xl md:text-2xl font-bold text-white">
                            {viewMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                        </h4>
                        <button
                            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                            disabled={isCurrentMonth}
                            className="p-3 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 transition-colors"
                            aria-label="Next month"
                        >
                            <ChevronRight className="h-7 w-7" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm md:text-base font-semibold text-slate-500">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <div key={d}>{d}</div>
                        ))}
                    </div>

                    <div className="flex-1 grid grid-cols-7 gap-2">
                        {cells.map((cell, i) => {
                            if (!cell) return <div key={`blank-${i}`} />;
                            const isFuture = cell.date.getTime() > today.getTime() && cell.iso !== todayISO();
                            const isSelected = cell.iso === value;
                            const isToday = cell.iso === todayISO();
                            return (
                                <button
                                    key={cell.iso}
                                    onClick={() => pick(cell.iso)}
                                    disabled={isFuture}
                                    className={`rounded-2xl text-lg md:text-xl font-semibold transition-all active:scale-[0.95] disabled:opacity-25 disabled:cursor-not-allowed ${
                                        isSelected
                                            ? 'bg-red-600 text-white'
                                            : isToday
                                                ? 'border-2 border-red-500 text-white'
                                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                    }`}
                                >
                                    {cell.date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Full-screen numeric keypad for the custom duration field — bigger, more
// reliable touch targets than relying on the tablet's native numeric keyboard.
function NumberPadModal({
    value,
    onClose,
    onDone,
}: {
    value: string;
    onClose: () => void;
    onDone: (value: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    const pressDigit = (digit: string) => {
        setDraft((prev) => {
            if (prev.length >= MAX_DURATION_DIGITS) return prev;
            const next = prev === '0' ? digit : prev + digit;
            return next;
        });
    };

    const backspace = () => setDraft((prev) => prev.slice(0, -1));
    const clear = () => setDraft('');

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col">
            <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Custom Duration</h3>
                <button
                    onClick={onClose}
                    className="p-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl active:bg-slate-700 transition"
                    aria-label="Cancel"
                >
                    <X className="h-8 w-8" />
                </button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-6 py-6">
                <div className="text-6xl md:text-7xl font-bold text-white tabular-nums">
                    {draft || '0'}
                    <span className="ml-3 text-3xl md:text-4xl font-medium text-slate-500">min</span>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full max-w-xl">
                    {keys.map((digit) => (
                        <button
                            key={digit}
                            onClick={() => pressDigit(digit)}
                            className="rounded-3xl border-2 border-slate-700 bg-slate-900 py-8 text-3xl font-bold text-white hover:border-slate-500 active:bg-slate-800 active:scale-[0.97] transition-all"
                        >
                            {digit}
                        </button>
                    ))}
                    <button
                        onClick={clear}
                        className="rounded-3xl border-2 border-slate-700 bg-slate-900 py-8 text-xl font-bold text-slate-300 hover:border-slate-500 active:bg-slate-800 active:scale-[0.97] transition-all"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => pressDigit('0')}
                        className="rounded-3xl border-2 border-slate-700 bg-slate-900 py-8 text-3xl font-bold text-white hover:border-slate-500 active:bg-slate-800 active:scale-[0.97] transition-all"
                    >
                        0
                    </button>
                    <button
                        onClick={backspace}
                        className="flex items-center justify-center rounded-3xl border-2 border-slate-700 bg-slate-900 py-8 text-white hover:border-slate-500 active:bg-slate-800 active:scale-[0.97] transition-all"
                        aria-label="Backspace"
                    >
                        <Delete className="h-8 w-8" />
                    </button>
                </div>

                <button
                    onClick={() => onDone(draft)}
                    disabled={!draft}
                    className="w-full max-w-xl rounded-3xl bg-red-600 py-6 text-2xl font-bold text-white hover:bg-red-500 active:bg-red-700 disabled:opacity-50 transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    );
}

function KioskBAUsage({ onBack }: KioskBAUsageProps) {
    const allMembers = useQuery(api.baRecords.listMembers, { serviceToken: getServiceToken() ?? undefined });
    const createRecord = useMutation(api.baRecords.createRecord);

    const [usageType, setUsageType] = useState<UsageType>('firecall');
    const [dateUsed, setDateUsed] = useState(todayISO);
    const [durationMinutes, setDurationMinutes] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<Id<'users'>[]>([]);
    const [verifiedBy, setVerifiedBy] = useState<Id<'users'> | null>(null);
    const [attempted, setAttempted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isDurationPadOpen, setIsDurationPadOpen] = useState(false);

    // On-screen keyboard for the notes field — job/address info is the one
    // thing on this page that must be typed.
    const [isNotesEditorOpen, setIsNotesEditorOpen] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const keyboardRef = useRef<{ setInput: (v: string) => void } | null>(null);
    const [keyboardLayout, setKeyboardLayout] = useState<'default' | 'shift'>('default');

    const sortedMembers = useMemo(() => {
        if (!allMembers) return [];
        return allMembers.filter(isBARecordMemberOption).sort((a, b) => {
            const ra = RANK_ORDER[a.rank ?? ''] ?? 999;
            const rb = RANK_ORDER[b.rank ?? ''] ?? 999;
            if (ra !== rb) return ra - rb;
            return a.name.localeCompare(b.name);
        });
    }, [allMembers]);

    const duration = parseInt(durationMinutes, 10);
    const isDurationValid = !isNaN(duration) && duration > 0 && duration <= 480;
    const isPresetDuration = DURATION_PRESETS.includes(duration);
    const isMembersValid = selectedMemberIds.length > 0;
    const isVerifierValid = !!verifiedBy;
    const isNotesValid = notes.trim().length > 0;
    const canSubmit = isDurationValid && isMembersValid && isVerifierValid && isNotesValid;

    const toggleMember = (id: Id<'users'>) => {
        setSelectedMemberIds((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
        );
    };

    const openNotesEditor = () => {
        setNotesDraft(notes);
        setKeyboardLayout('default');
        setIsNotesEditorOpen(true);
    };

    const setNotesDraftSynced = (value: string) => {
        setNotesDraft(value);
        keyboardRef.current?.setInput(value);
    };

    const handleKeyboardKeyPress = (button: string) => {
        if (button === '{shift}' || button === '{lock}') {
            setKeyboardLayout((prev) => (prev === 'default' ? 'shift' : 'default'));
        }
    };

    const saveNotes = () => {
        setNotes(notesDraft);
        setIsNotesEditorOpen(false);
    };

    const resetForNextJob = () => {
        setSelectedMemberIds([]);
        setVerifiedBy(null);
        setNotes('');
        setDurationMinutes('');
        setAttempted(false);
        setDateUsed(todayISO());
    };

    const handleSubmit = async () => {
        setAttempted(true);
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            const results = await Promise.allSettled(
                selectedMemberIds.map((memberId) => {
                    if (memberId === verifiedBy) {
                        return Promise.reject(new Error('skip-self-verify'));
                    }
                    return createRecord({
                        memberId,
                        dateUsed,
                        durationMinutes: duration,
                        usageType,
                        notes: notes.trim(),
                        verifiedBy: verifiedBy!,
                        serviceToken: getServiceToken() ?? undefined,
                    });
                }),
            );

            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            const skippedSelf = results.filter(
                (r) => r.status === 'rejected' && (r.reason as Error)?.message === 'skip-self-verify',
            ).length;
            const failed = results.length - succeeded - skippedSelf;

            if (succeeded > 0) {
                toast.success(`${succeeded} BA record${succeeded === 1 ? '' : 's'} submitted`);
            }
            if (skippedSelf > 0) {
                toast.warning(
                    `${skippedSelf} member${skippedSelf === 1 ? '' : 's'} skipped, the verifier can't verify their own BA usage. Log that one separately with a different verifier.`,
                );
            }
            if (failed > 0) {
                toast.error(`${failed} record${failed === 1 ? '' : 's'} failed to submit`);
            }
            if (succeeded > 0) {
                resetForNextJob();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-50 flex flex-col overflow-hidden select-none touch-none">
            <header className="flex-none flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                        aria-label="Back to kiosk home"
                    >
                        <ArrowLeft className="h-8 w-8" />
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Log BA Usage</h1>
                </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 space-y-6" style={{ scrollbarWidth: 'none' }}>
                {/* Type of use */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-3">Type of use</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {USAGE_TYPES.map(({ key, title, Icon }) => {
                            const active = usageType === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setUsageType(key)}
                                    className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-5 transition-all active:scale-[0.98] ${
                                        active
                                            ? 'border-red-500 bg-red-950/40'
                                            : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                                    }`}
                                >
                                    <div className={`rounded-full p-3 ${active ? 'bg-red-500/20' : 'bg-slate-800'}`}>
                                        <Icon className={`h-7 w-7 ${active ? 'text-red-400' : 'text-slate-400'}`} />
                                    </div>
                                    <span className={`text-xl font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>
                                        {title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Date + Duration */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-3">Date</h2>
                        <button
                            type="button"
                            onClick={() => setIsDatePickerOpen(true)}
                            className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900 px-5 py-4 text-left hover:border-slate-500 transition-colors"
                        >
                            <span className="text-xl font-semibold text-white">{formatDisplayDate(dateUsed)}</span>
                            <CalendarDays className="h-6 w-6 shrink-0 text-slate-400" />
                        </button>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white mb-3">Duration on air</h2>
                        <div className="grid grid-cols-4 gap-2">
                            {DURATION_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setDurationMinutes(String(preset))}
                                    className={`rounded-xl border-2 py-3 text-lg font-semibold transition-all ${
                                        durationMinutes === String(preset)
                                            ? 'border-red-500 bg-red-950/40 text-red-300'
                                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                                    }`}
                                >
                                    {preset}m
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsDurationPadOpen(true)}
                            className={`mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3 text-left transition-colors ${
                                durationMinutes && !isPresetDuration
                                    ? 'border-red-500 bg-red-950/40 text-red-300'
                                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                            }`}
                        >
                            <span className="text-lg font-semibold">
                                {durationMinutes && !isPresetDuration ? `${durationMinutes} minutes` : 'Custom minutes…'}
                            </span>
                            <Clock className="h-5 w-5 shrink-0" />
                        </button>
                        {attempted && !isDurationValid && (
                            <p className="mt-1 text-sm text-red-400">Enter a duration between 1 and 480 minutes.</p>
                        )}
                    </div>
                </section>

                {/* Job info / notes — the one field that needs typing */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-3">Job info / notes</h2>
                    <button
                        type="button"
                        onClick={openNotesEditor}
                        className={`flex w-full items-start justify-between gap-3 rounded-2xl border-2 px-5 py-5 text-left transition-all ${
                            notes ? 'border-slate-600 bg-slate-900' : 'border-dashed border-slate-700 bg-slate-900/50'
                        }`}
                    >
                        <span className={`text-lg ${notes ? 'text-white' : 'text-slate-500'}`}>
                            {notes || 'Tap to enter job details, e.g. "Structure fire, 475 Ballan Rd, Wyndham Vale"'}
                        </span>
                        <Pencil className="h-6 w-6 shrink-0 text-slate-400" />
                    </button>
                    {attempted && !isNotesValid && (
                        <p className="mt-1 text-sm text-red-400">Enter a brief note about this BA usage.</p>
                    )}
                </section>

                {/* Who was on air */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-3">
                        Who was on air? <span className="text-base font-normal text-slate-400">(tap all that apply)</span>
                    </h2>
                    <MemberTileGrid
                        members={sortedMembers}
                        isSelected={(id) => selectedMemberIds.includes(id)}
                        onToggle={toggleMember}
                    />
                    {attempted && !isMembersValid && (
                        <p className="mt-1 text-sm text-red-400">Select at least one member.</p>
                    )}
                </section>

                {/* Verified by */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-3">Verified by</h2>
                    <MemberTileGrid
                        members={sortedMembers}
                        isSelected={(id) => verifiedBy === id}
                        onToggle={(id) => setVerifiedBy((prev) => (prev === id ? null : id))}
                    />
                    {attempted && !isVerifierValid && (
                        <p className="mt-1 text-sm text-red-400">Select a verifier.</p>
                    )}
                </section>

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full rounded-3xl bg-red-600 py-6 text-2xl font-bold text-white transition-colors hover:bg-red-500 active:bg-red-700 disabled:opacity-50"
                >
                    {isSubmitting
                        ? 'Submitting…'
                        : `Submit ${selectedMemberIds.length || ''} BA Record${selectedMemberIds.length === 1 ? '' : 's'}`}
                </button>
            </main>

            {/* Notes editor — full-screen on-screen keyboard, this kiosk has no physical one */}
            {isNotesEditorOpen && (
                <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col">
                    <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-800">
                        <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Job info / notes</h3>
                        <button
                            onClick={() => setIsNotesEditorOpen(false)}
                            className="p-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl active:bg-slate-700 transition"
                            aria-label="Cancel"
                        >
                            <X className="h-8 w-8" />
                        </button>
                    </header>

                    <div className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-6">
                        <textarea
                            value={notesDraft}
                            onChange={(e) => setNotesDraftSynced(e.target.value)}
                            placeholder="Tap the keys below…"
                            readOnly
                            rows={3}
                            className="flex-none w-full resize-none rounded-3xl border-4 border-slate-700 bg-slate-900 px-6 py-4 text-2xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                        />

                        <div className="flex-1 min-h-0 flex flex-col justify-center">
                            <Keyboard
                                keyboardRef={(r) => { keyboardRef.current = r; }}
                                layoutName={keyboardLayout}
                                theme="hg-theme-default kioskKeyboard"
                                layout={{
                                    default: [
                                        '1 2 3 4 5 6 7 8 9 0',
                                        'q w e r t y u i o p',
                                        'a s d f g h j k l',
                                        '{shift} z x c v b n m {bksp}',
                                        ', . - / {space}',
                                    ],
                                    shift: [
                                        '1 2 3 4 5 6 7 8 9 0',
                                        'Q W E R T Y U I O P',
                                        'A S D F G H J K L',
                                        '{shift} Z X C V B N M {bksp}',
                                        ', . - / {space}',
                                    ],
                                }}
                                display={{
                                    '{bksp}': '⌫',
                                    '{shift}': '⇧',
                                    '{space}': 'space',
                                }}
                                onChange={(input: string) => setNotesDraft(input)}
                                onKeyPress={handleKeyboardKeyPress}
                            />
                        </div>

                        <div className="flex-none flex gap-4 md:gap-6">
                            <button
                                onClick={() => setIsNotesEditorOpen(false)}
                                className="flex-1 py-5 bg-slate-800 text-slate-300 rounded-3xl text-2xl font-semibold hover:bg-slate-700 active:bg-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveNotes}
                                disabled={!notesDraft.trim()}
                                className="flex-[2] py-5 bg-red-600 text-white rounded-3xl text-2xl font-bold hover:bg-red-500 active:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                Save Notes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDatePickerOpen && (
                <DatePickerModal
                    value={dateUsed}
                    onChange={setDateUsed}
                    onClose={() => setIsDatePickerOpen(false)}
                />
            )}

            {isDurationPadOpen && (
                <NumberPadModal
                    value={!isPresetDuration ? durationMinutes : ''}
                    onClose={() => setIsDurationPadOpen(false)}
                    onDone={(val) => {
                        setDurationMinutes(val);
                        setIsDurationPadOpen(false);
                    }}
                />
            )}

            <style>{`
                .overflow-y-auto::-webkit-scrollbar { display: none; }

                .kioskKeyboard.simple-keyboard { background: transparent; padding: 0; max-width: 900px; margin: 0 auto; width: 100%; }
                .kioskKeyboard .hg-row { margin-bottom: 10px; }
                .kioskKeyboard .hg-row:last-child { margin-bottom: 0; }
                .kioskKeyboard .hg-button {
                    height: 72px;
                    background: #1e293b;
                    color: #f1f5f9;
                    border: 2px solid #334155;
                    border-radius: 16px;
                    font-size: 1.75rem;
                    font-weight: 600;
                    box-shadow: none;
                }
                .kioskKeyboard .hg-button:active {
                    background: #dc2626;
                    border-color: #ef4444;
                    color: #ffffff;
                }
                .kioskKeyboard .hg-button.hg-functionBtn { background: #0f172a; }
            `}</style>
        </div>
    );
}

export default KioskBAUsage;
