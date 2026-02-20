import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, X } from 'lucide-react';
import KioskApplianceLocations from '@/features/kiosk/KioskApplianceLocations';

type KioskTileId = 'appliance-locations';

interface KioskTile {
    id: KioskTileId;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}

const KIOSK_TILES: KioskTile[] = [
    {
        id: 'appliance-locations',
        title: 'Appliance Locations',
        description: 'Update the location of appliances on BRAVO',
        icon: <MapPin className="h-16 w-16 mb-4" />,
        color: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-red-500',
    },
];

export default function KioskPage() {
    const navigate = useNavigate();
    const [activeTile, setActiveTile] = useState<KioskTileId | null>(null);

    // If a tile is active, render its component full-screen
    if (activeTile === 'appliance-locations') {
        return <KioskApplianceLocations onBack={() => setActiveTile(null)} />;
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
                        <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-wide text-center leading-tight">{tile.title}</h2>
                        <p className="text-xl md:text-2xl opacity-90 text-center font-medium leading-snug">
                            {tile.description}
                        </p>
                    </button>
                ))}
            </main>
        </div>
    );
}
