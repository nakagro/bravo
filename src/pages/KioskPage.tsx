import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';
import KioskApplianceLocations from '@/features/kiosk/KioskApplianceLocations';

type KioskTileId = 'appliance-locations';

interface KioskTile {
    id: KioskTileId;
    title: string;
    description: string;
    icon: React.ReactNode;
    emoji?: string;
    color: string;
}

const KIOSK_TILES: KioskTile[] = [
    {
        id: 'appliance-locations',
        title: 'Appliance Locations',
        description: 'Move trucks between stations',
        icon: <MapPin className="h-8 w-8" />,
        emoji: '🚒',
        color: 'from-blue-500 to-blue-600',
    },
    // Future tiles go here, e.g.:
    // {
    //   id: 'availability',
    //   title: 'Availability',
    //   description: 'View who is available',
    //   icon: <Users className="h-8 w-8" />,
    //   emoji: '👥',
    //   color: 'from-green-500 to-green-600',
    // },
];

export default function KioskPage() {
    const navigate = useNavigate();
    const [activeTile, setActiveTile] = useState<KioskTileId | null>(null);

    // Render the active tile's content full-screen
    if (activeTile === 'appliance-locations') {
        return (
            <div className="min-h-[calc(100vh-56px)] flex flex-col bg-gray-50 dark:bg-gray-900">
                <KioskApplianceLocations onBack={() => setActiveTile(null)} />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-56px)] flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Kiosk Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors text-base font-medium"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    🖥️ Station Kiosk
                </h1>
                <div className="w-[72px]" /> {/* Spacer for centering */}
            </div>

            {/* Dashboard Grid */}
            <div className="flex-1 p-6 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <p className="text-sm text-muted-foreground mb-6">
                        Tap an option below to get started.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {KIOSK_TILES.map((tile) => (
                            <button
                                key={tile.id}
                                onClick={() => setActiveTile(tile.id)}
                                className="group relative flex flex-col items-center justify-center gap-3 p-6 md:p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md active:shadow-none active:scale-[0.98] transition-all text-center min-h-[160px]"
                            >
                                {/* Gradient accent bar at top */}
                                <div className={`absolute top-0 left-4 right-4 h-1 rounded-b-full bg-gradient-to-r ${tile.color} opacity-60 group-hover:opacity-100 transition-opacity`} />

                                {/* Icon */}
                                <div className="text-4xl">{tile.emoji}</div>

                                {/* Title */}
                                <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                    {tile.title}
                                </h3>

                                {/* Description */}
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">
                                    {tile.description}
                                </p>
                            </button>
                        ))}

                        {/* Placeholder for future tiles */}
                        <div className="flex flex-col items-center justify-center gap-3 p-6 md:p-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 min-h-[160px]">
                            <span className="text-3xl">➕</span>
                            <span className="text-sm font-medium">More coming soon</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
