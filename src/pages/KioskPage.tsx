import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KioskApplianceLocations from '@/features/kiosk/KioskApplianceLocations';
import KioskDashboard from '@/features/kiosk/dashboard/KioskDashboard';
import type { KioskOverlay } from '@/features/kiosk/dashboard/layout';

const KIOSK_INACTIVITY_TIMEOUT_MS = 120_000;

const KioskContactDirectory = lazy(() => import('@/features/kiosk/KioskContactDirectory'));

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
    // The dashboard is home; Appliance Locations and the Contact List are
    // full-screen overlays launched from it.
    const [overlay, setOverlay] = useState<KioskOverlay | null>(null);
    // Bumped on inactivity so the dashboard dismisses any open modal/confirm.
    const [resetSignal, setResetSignal] = useState(0);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
            setOverlay(null);
            setResetSignal((n) => n + 1);
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

    if (overlay === 'appliance-locations') {
        return <KioskApplianceLocations onBack={() => setOverlay(null)} />;
    }

    if (overlay === 'contact-directory') {
        return (
            <Suspense fallback={<KioskLoadingState title="Loading contact list" />}>
                <KioskContactDirectory onBack={() => setOverlay(null)} />
            </Suspense>
        );
    }

    return (
        <KioskDashboard
            onNavigate={setOverlay}
            onExit={() => navigate(-1)}
            resetSignal={resetSignal}
        />
    );
}
