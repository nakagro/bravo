import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import { BookOpen, DoorOpen, MapPin, X } from 'lucide-react';
import KioskApplianceLocations from '@/features/kiosk/KioskApplianceLocations';
import KioskGateControl from '@/features/kiosk/KioskGateControl';

const KIOSK_INACTIVITY_TIMEOUT_MS = 120_000;

const KioskContactDirectory = lazy(() => import('@/features/kiosk/KioskContactDirectory'));

type KioskTileId = 'appliance-locations' | 'gate-control' | 'contact-directory';

interface KioskTile {
    id: KioskTileId;
    title: string;
    icon: React.ReactNode;
    color: string;
}

const KIOSK_TILES: KioskTile[] = [
    {
        id: 'appliance-locations',
        title: 'Appliance Locations',
        icon: <MapPin className="h-16 w-16 mb-4" />,
        color: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-red-500',
    },
    {
        id: 'gate-control',
        title: 'Gate & Station',
        icon: <DoorOpen className="h-16 w-16 mb-4" />,
        color: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white border-amber-500',
    },
    {
        id: 'contact-directory',
        title: 'D14 Contact List',
        icon: <BookOpen className="h-16 w-16 mb-4" />,
        color: 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white border-sky-500',
    },
];

function KioskLoadingState({ title }: { title: string }) {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-50 flex flex-col items-center justify-center gap-6 px-8 text-center">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
                <p className="mt-3 text-xl md:text-2xl text-slate-400">Preparing the kiosk view…</p>
            </div>
        </div>
    );
}

export default function KioskPage() {
    const navigate = useNavigate();
    const [activeTile, setActiveTile] = useState<KioskTileId | null>(null);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
            setActiveTile(null);
        }, KIOSK_INACTIVITY_TIMEOUT_MS);
    }, []);

    useEffect(() => {
        const activityEvents: Array<keyof WindowEventMap> = [
            'pointerdown',
            'touchstart',
            'keydown',
            'wheel',
        ];

        resetInactivityTimer();
        const handleActivity = () => resetInactivityTimer();
        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, handleActivity);
        });

        return () => {
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, handleActivity);
            });
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
                inactivityTimerRef.current = null;
            }
        };
    }, [resetInactivityTimer]);

    if (activeTile === 'appliance-locations') {
        return <KioskApplianceLocations onBack={() => setActiveTile(null)} />;
    }

    if (activeTile === 'gate-control') {
        return <KioskGateControl onBack={() => setActiveTile(null)} />;
    }

    if (activeTile === 'contact-directory') {
        return (
            <Suspense fallback={<KioskLoadingState title="Loading contact list" />}>
                <KioskContactDirectory onBack={() => setActiveTile(null)} />
            </Suspense>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden select-none touch-none text-slate-50">
            {/* Header */}
            <header className="flex-none flex items-center justify-between px-8 py-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-4 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                    aria-label="Close Kiosk"
                >
                    <X className="h-10 w-10" />
                </button>
            </header>

            {/* Dashboard Tiles Grid */}
            <main className="flex-1 p-8 md:p-12 flex gap-6 md:gap-8 items-start justify-center flex-wrap overflow-y-auto">
                {KIOSK_TILES.map((tile) => (
                    <button
                        key={tile.id}
                        onClick={() => setActiveTile(tile.id)}
                        className={`group relative flex flex-col items-center justify-center p-6 md:p-8 rounded-[2rem] shadow-xl transition-all active:scale-[0.98] border-4 ${tile.color} w-full max-w-[320px] aspect-square`}
                    >
                        {tile.icon}
                        <h2 className="text-3xl md:text-4xl font-bold tracking-wide text-center leading-tight">{tile.title}</h2>
                    </button>
                ))}
            </main>
        </div>
    );
}
