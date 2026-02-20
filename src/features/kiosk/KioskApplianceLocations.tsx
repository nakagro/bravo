import React, { useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getRelativeTimeCompact } from "../../utils/dateUtils";
import { ArrowLeft, MapPin, CheckCircle2, Plus, X } from "lucide-react";

interface KioskApplianceLocationsProps {
    onBack: () => void;
}

const KioskApplianceLocations: React.FC<KioskApplianceLocationsProps> = ({ onBack }) => {
    const applianceLocations = useQuery(api.applianceLocations.getApplianceLocations) || [];
    const allLocations = useQuery(api.applianceLocations.getAllLocations) || [];
    const updateApplianceLocation = useMutation(api.applianceLocations.updateApplianceLocation);

    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [customLocationFor, setCustomLocationFor] = useState<string | null>(null);
    const [customLocation, setCustomLocation] = useState('');

    const locationMap = applianceLocations.reduce((acc, location) => {
        acc[location.applianceName] = location.stationLocation;
        return acc;
    }, {} as Record<string, string>);

    const lastUpdatedAt = applianceLocations.length > 0
        ? Math.max(...applianceLocations.map(loc => loc.updatedAt))
        : null;

    const appliances = ['Pumper', 'Tanker', 'FCV'] as const;
    const primaryStations = ['Main Station', 'Satellite Station'];
    const customLocations = allLocations.filter(
        loc => !primaryStations.includes(loc as any)
    );
    const allAvailableLocations = [...primaryStations, ...customLocations];

    const handleLocationUpdate = async (applianceName: typeof appliances[number], newLocation: string) => {
        if (locationMap[applianceName] === newLocation) return;
        setIsUpdating(applianceName);
        try {
            await updateApplianceLocation({ applianceName, stationLocation: newLocation });
        } catch (error) {
            console.error('Error updating appliance location:', error);
        } finally {
            setIsUpdating(null);
        }
    };

    const handleCustomLocationSubmit = async (applianceName: typeof appliances[number]) => {
        if (!customLocation.trim()) return;
        await handleLocationUpdate(applianceName, customLocation.trim());
        setCustomLocationFor(null);
        setCustomLocation('');
    };

    // Emoji icons for each appliance
    const applianceIcons: Record<string, string> = {
        Pumper: '🚒',
        Tanker: '🚛',
        FCV: '🚐',
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors text-base font-medium"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Appliance Locations</h2>
                </div>
                {lastUpdatedAt && (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                        Updated {getRelativeTimeCompact(lastUpdatedAt)}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {appliances.map((appliance) => {
                        const currentLocation = locationMap[appliance] || 'Unknown';
                        const updating = isUpdating === appliance;

                        return (
                            <div
                                key={appliance}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                            >
                                {/* Appliance header */}
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
                                    <span className="text-3xl">{applianceIcons[appliance]}</span>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{appliance}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Currently at <span className="font-semibold text-blue-600 dark:text-blue-400">{currentLocation}</span>
                                        </p>
                                    </div>
                                    {updating && (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
                                    )}
                                </div>

                                {/* Location buttons */}
                                <div className="p-4 grid grid-cols-2 gap-3">
                                    {allAvailableLocations.map((location) => {
                                        const isActive = currentLocation === location;
                                        return (
                                            <button
                                                key={location}
                                                onClick={() => handleLocationUpdate(appliance, location)}
                                                disabled={updating || isActive}
                                                className={`
                          relative flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-base font-semibold transition-all
                          min-h-[56px]
                          ${isActive
                                                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-2 ring-green-400 dark:ring-green-600'
                                                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 active:bg-blue-50 dark:active:bg-blue-900/30 active:text-blue-700 dark:active:text-blue-300'
                                                    }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                                            >
                                                {isActive && <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400 shrink-0" />}
                                                <span className="truncate">{location}</span>
                                            </button>
                                        );
                                    })}

                                    {/* Custom location button / input */}
                                    {customLocationFor === appliance ? (
                                        <div className="col-span-2 flex gap-2">
                                            <input
                                                type="text"
                                                value={customLocation}
                                                onChange={(e) => setCustomLocation(e.target.value)}
                                                placeholder="Enter location..."
                                                autoFocus
                                                className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 text-base"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCustomLocationSubmit(appliance);
                                                    else if (e.key === 'Escape') {
                                                        setCustomLocationFor(null);
                                                        setCustomLocation('');
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => handleCustomLocationSubmit(appliance)}
                                                disabled={updating || !customLocation.trim()}
                                                className="px-5 py-3 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Set
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCustomLocationFor(null);
                                                    setCustomLocation('');
                                                }}
                                                className="p-3 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setCustomLocationFor(appliance);
                                                setCustomLocation('');
                                            }}
                                            disabled={updating}
                                            className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-500 dark:hover:text-gray-400 active:bg-gray-50 dark:active:bg-gray-700 transition-colors min-h-[56px] text-base font-medium"
                                        >
                                            <Plus className="h-5 w-5" />
                                            Custom
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default KioskApplianceLocations;
