import React, { useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getRelativeTimeCompact } from "../../utils/dateUtils";
import { X, CircleCheckBig, Plus, Truck, MapPin, ArrowLeft } from "lucide-react";

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

    const handleCustomLocationSubmit = async (applianceName: typeof appliances[number], overrideLocation?: string) => {
        const loc = overrideLocation || customLocation.trim();
        if (!loc) return;
        await handleLocationUpdate(applianceName, loc);
        setCustomLocationFor(null);
        setCustomLocation('');
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-50 flex flex-col overflow-hidden select-none touch-none">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-8 py-6">
                <button
                    onClick={onBack}
                    className="p-4 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-10 w-10" />
                </button>
                <div className="flex items-center">
                    {lastUpdatedAt && (
                        <span className="text-xl md:text-2xl text-slate-400 font-medium">
                            Updated {getRelativeTimeCompact(lastUpdatedAt)}
                        </span>
                    )}
                </div>
            </div>

            {/* Content Component */}
            <div className="flex-1 px-8 pb-8 overflow-hidden">
                <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
                    {appliances.map((appliance) => {
                        const currentLocation = locationMap[appliance] || 'Unknown';
                        const updating = isUpdating === appliance;
                        const isCustomActive = !primaryStations.includes(currentLocation) && currentLocation !== 'Unknown';

                        return (
                            <div
                                key={appliance}
                                className="flex flex-col bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl relative"
                            >
                                {/* Appliance header */}
                                <div className="flex-none p-6 border-b-4 border-slate-800 bg-slate-800/20 flex flex-col items-center justify-center gap-4">
                                    <div className="p-4 bg-slate-800 rounded-full">
                                        <Truck className="h-10 w-10 md:h-12 md:w-12 text-slate-300" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">{appliance}</h3>
                                        <p className="text-xl md:text-2xl text-slate-500 font-medium">
                                            Currently at <span className="font-bold text-red-400">{currentLocation}</span>
                                        </p>
                                    </div>
                                    {updating && (
                                        <div className="absolute top-6 right-6 h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-red-500" />
                                    )}
                                </div>

                                {/* Location buttons */}
                                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

                                    {/* Primary Locations */}
                                    {primaryStations.map((location) => {
                                        const isActive = currentLocation === location;
                                        return (
                                            <button
                                                key={location}
                                                onClick={() => handleLocationUpdate(appliance, location)}
                                                disabled={updating || isActive}
                                                className={`
                                                relative flex items-center justify-between px-6 py-6 md:py-8 rounded-2xl text-2xl md:text-3xl font-semibold transition-all
                                                ${isActive
                                                        ? 'bg-red-600 text-white border-4 border-red-500'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 active:bg-slate-600 border-2 border-transparent'
                                                    }
                                                ${!isActive ? 'disabled:opacity-50' : ''} disabled:cursor-not-allowed active:scale-[0.98]
                                              `}
                                            >
                                                <span className="truncate">{location}</span>
                                                {isActive && <CircleCheckBig className="h-8 w-8 md:h-10 md:w-10 text-white shrink-0" />}
                                            </button>
                                        );
                                    })}

                                    {/* Custom Location button */}
                                    <button
                                        onClick={() => {
                                            setCustomLocationFor(appliance);
                                            setCustomLocation('');
                                        }}
                                        disabled={updating}
                                        className={`
                                        relative flex items-center justify-between px-6 py-6 md:py-8 rounded-2xl text-2xl md:text-3xl font-semibold transition-all mt-auto
                                        ${isCustomActive
                                                ? 'bg-red-600 text-white border-4 border-red-500'
                                                : 'border-4 border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 active:bg-slate-800'
                                            }
                                        ${!isCustomActive ? 'disabled:opacity-50' : ''} disabled:cursor-not-allowed active:scale-[0.98]
                                      `}
                                    >
                                        {isCustomActive ? (
                                            <>
                                                <span className="truncate">{currentLocation}</span>
                                                <CircleCheckBig className="h-8 w-8 md:h-10 md:w-10 text-white shrink-0" />
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-4 w-full justify-center">
                                                <Plus className="h-8 w-8 md:h-10 md:w-10" />
                                                <span className="truncate font-medium">Custom Location</span>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Custom Location Modal */}
            {customLocationFor && (
                <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4">
                    <div className="bg-slate-900 border-4 border-slate-700 p-8 md:p-10 rounded-[2rem] w-full max-w-3xl shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                                Custom Location: <span className="text-red-400">{customLocationFor}</span>
                            </h3>
                            <button
                                onClick={() => {
                                    setCustomLocationFor(null);
                                    setCustomLocation('');
                                }}
                                className="p-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl active:bg-slate-700 transition"
                            >
                                <X className="h-8 w-8 md:h-10 md:w-10" />
                            </button>
                        </div>

                        {/* Recent Custom Locations */}
                        {customLocations.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <span className="text-xl text-slate-400 font-medium">Recent Locations:</span>
                                <div className="flex flex-wrap gap-3">
                                    {customLocations.map(loc => (
                                        <button
                                            key={loc}
                                            onClick={() => handleCustomLocationSubmit(customLocationFor as any, loc)}
                                            className="px-6 py-4 bg-slate-800 text-slate-300 rounded-2xl text-2xl font-medium hover:bg-slate-700 active:bg-slate-600 transition-colors border-2 border-slate-700 active:scale-[0.98] flex items-center gap-2"
                                        >
                                            <MapPin className="h-6 w-6 text-slate-400" />
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative mt-2">
                            <input
                                type="text"
                                value={customLocation}
                                onChange={(e) => setCustomLocation(e.target.value)}
                                placeholder="Enter completely new location..."
                                autoFocus
                                className="w-full px-8 py-8 md:py-10 bg-slate-950 border-4 border-slate-700 rounded-3xl text-3xl md:text-4xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCustomLocationSubmit(customLocationFor as any);
                                    else if (e.key === 'Escape') {
                                        setCustomLocationFor(null);
                                        setCustomLocation('');
                                    }
                                }}
                            />
                        </div>

                        <div className="flex gap-4 md:gap-6 mt-4">
                            <button
                                onClick={() => {
                                    setCustomLocationFor(null);
                                    setCustomLocation('');
                                }}
                                className="flex-1 py-8 bg-slate-800 text-slate-300 rounded-3xl text-2xl md:text-3xl font-semibold hover:bg-slate-700 active:bg-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleCustomLocationSubmit(customLocationFor as any)}
                                disabled={!customLocation.trim()}
                                className="flex-[2] py-8 bg-red-600 text-white rounded-3xl text-2xl md:text-3xl font-bold hover:bg-red-500 active:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                Confirm Location
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .overflow-y-auto::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default KioskApplianceLocations;
