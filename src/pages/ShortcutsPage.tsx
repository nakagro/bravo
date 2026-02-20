import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, ArrowLeft, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

export default function ShortcutsPage() {
    const token = useQuery(api.shortcuts.getToken);
    const generateToken = useMutation(api.shortcuts.generateToken);
    const revokeToken = useMutation(api.shortcuts.revokeToken);

    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        try {
            setIsGenerating(true);
            await generateToken();
            toast.success("Shortcut token generated successfully.");
        } catch (error) {
            toast.error("Failed to generate token.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevoke = async () => {
        if (!confirm("Are you sure you want to revoke your shortcut token? Any existing shortcuts using it will stop working.")) {
            return;
        }
        try {
            await revokeToken();
            toast.success("Shortcut token revoked.");
        } catch (error) {
            toast.error("Failed to revoke token.");
        }
    };

    const copyToClipboard = (text: string, message: string) => {
        navigator.clipboard.writeText(text);
        toast.success(message);
    };

    // Build the webhook URL
    // Self-hosted Convex: HTTP endpoints are at <base>/http/<path>
    // Convex Cloud: HTTP endpoints are at <base>.site/<path> (replace .cloud with .site)
    const convexUrl = import.meta.env.VITE_CONVEX_URL || '';
    let httpBaseUrl: string;
    if (convexUrl.includes('.cloud')) {
        // Convex Cloud
        httpBaseUrl = convexUrl.replace('.cloud', '.site');
    } else if (convexUrl) {
        // Self-hosted Convex — HTTP actions are served under /http
        httpBaseUrl = convexUrl.replace(/\/$/, '') + '/http';
    } else {
        httpBaseUrl = window.location.origin;
    }

    const endpointUrl = `${httpBaseUrl}/api/shortcuts/availability`;

    return (
        <div className="space-y-6 max-w-3xl mx-auto pb-12">
            <div className="flex items-center gap-4">
                <Link to="/extras" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Zap className="w-6 h-6 text-yellow-500" />
                    Automation Shortcuts
                </h1>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900 border-l-4 border-l-blue-500 text-sm">
                <p className="text-blue-900 dark:text-blue-300">
                    <strong>iOS Shortcuts / Webhooks:</strong> You can automate your availability status using Apple Shortcuts or any standard HTTP request. Generate a token below to get your secure personal URLs.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-1">Your Secret Token</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        This token uniquely identifies you and allows changing your status without needing to log in. Treat it like a password.
                    </p>
                </div>

                <div className="p-5">
                    {token === undefined ? (
                        <div className="flex justify-center p-4">
                            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : token ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm break-all">
                                <span className="flex-1 text-gray-700 dark:text-gray-300">{token}</span>
                                <button
                                    onClick={() => copyToClipboard(token, "Token copied!")}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                    aria-label="Copy token"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                    Regenerate Token
                                </button>
                                <button
                                    onClick={handleRevoke}
                                    className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Revoke
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-gray-500 dark:text-gray-400 mb-4">You don't have an active shortcut token.</p>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors inline-flex items-center gap-2 shadow-sm"
                            >
                                <Zap className="w-4 h-4" />
                                {isGenerating ? "Generating..." : "Generate Token"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {token && (
                <UrlBuilder token={token} endpointUrl={endpointUrl} copyToClipboard={copyToClipboard} />
            )}

            {token && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold mt-8 mb-2">Ready-to-Use Webhook URLs</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Copy any URL below and paste it into the Apple Shortcuts &quot;Get content of URL&quot; action with the method set to <strong>POST</strong>. Each URL is pre-filled with your token.
                    </p>

                    {/* Quick Status Changes */}
                    <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mt-6 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" /> Quick Status Changes
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Set your status instantly with no duration or auto-transition.</p>

                    <ExampleIntegration
                        title="Set to Available (Station)"
                        description="You are available and responding from Main Station."
                        url={`${endpointUrl}?token=${token}&status=available - station`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=available - station`, "Available (Station) URL copied!")}
                    />

                    <ExampleIntegration
                        title="Set to Available (Satellite)"
                        description="You are available and responding from Satellite Station."
                        url={`${endpointUrl}?token=${token}&status=available - satellite`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=available - satellite`, "Available (Satellite) URL copied!")}
                    />

                    <ExampleIntegration
                        title="Set to Delayed Response"
                        description="You can respond but will be delayed."
                        url={`${endpointUrl}?token=${token}&status=delayed response`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=delayed response`, "Delayed Response URL copied!")}
                    />

                    <ExampleIntegration
                        title="Set to Working From Home"
                        description="You are working from home."
                        url={`${endpointUrl}?token=${token}&status=WFH`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=WFH`, "WFH URL copied!")}
                    />

                    <ExampleIntegration
                        title="Set to Unavailable"
                        description="You are not available to respond."
                        url={`${endpointUrl}?token=${token}&status=not available`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=not available`, "Unavailable URL copied!")}
                    />

                    {/* With Duration */}
                    <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mt-8 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" /> With Duration &amp; Auto-Transition
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Set your status for a specific number of hours, then automatically transition to another status (or clear it).</p>

                    <ExampleIntegration
                        title="Available (Station) for 4 Hours → Clear"
                        description="Available from Station for 4 hours, then status resets."
                        url={`${endpointUrl}?token=${token}&status=available - station&durationHours=4&nextStatus=reset`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=available - station&durationHours=4&nextStatus=reset`, "4h Available URL copied!")}
                    />

                    <ExampleIntegration
                        title="Delayed Response for 2 Hours → Available (Station)"
                        description="Delayed for 2 hours, then automatically switches to Available (Station)."
                        url={`${endpointUrl}?token=${token}&status=delayed response&durationHours=2&nextStatus=available - station`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=delayed response&durationHours=2&nextStatus=available - station`, "2h Delayed → Available URL copied!")}
                    />

                    <ExampleIntegration
                        title="WFH for 8 Hours → Unavailable"
                        description="Working from home for 8 hours, then switches to Unavailable."
                        url={`${endpointUrl}?token=${token}&status=WFH&durationHours=8&nextStatus=not available`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=WFH&durationHours=8&nextStatus=not available`, "8h WFH → Unavailable URL copied!")}
                    />

                    <ExampleIntegration
                        title="Unavailable for 12 Hours → Available (Station)"
                        description="Unavailable for 12 hours, then automatically available at station."
                        url={`${endpointUrl}?token=${token}&status=not available&durationHours=12&nextStatus=available - station`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=not available&durationHours=12&nextStatus=available - station`, "12h Unavailable → Available URL copied!")}
                    />

                    {/* Reference */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-8">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-medium text-sm">Parameter Reference</h3>
                        </div>
                        <div className="p-4 text-sm text-gray-600 dark:text-gray-400 space-y-3">
                            <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">status <span className="text-red-500">*required</span></p>
                                <ul className="list-disc pl-5 space-y-0.5">
                                    <li><code>available - station</code></li>
                                    <li><code>available - satellite</code></li>
                                    <li><code>delayed response</code></li>
                                    <li><code>WFH</code></li>
                                    <li><code>not available</code></li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">durationHours <span className="text-gray-400">optional</span></p>
                                <p>Number of hours the status lasts (e.g. <code>2</code>, <code>4.5</code>, <code>12</code>).</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">nextStatus <span className="text-gray-400">optional</span></p>
                                <p>Status to transition to after the duration expires. Accepts all values from <code>status</code> plus:</p>
                                <ul className="list-disc pl-5 mt-1">
                                    <li><code>reset</code> — clears the status entirely</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const STATUS_OPTIONS = [
    { value: "available - station", label: "Available (Station)", color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700" },
    { value: "available - satellite", label: "Available (Satellite)", color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700" },
    { value: "delayed response", label: "Delayed Response", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700" },
    { value: "WFH", label: "Working From Home", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700" },
    { value: "not available", label: "Unavailable", color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600" },
] as const;

const NEXT_STATUS_OPTIONS = [
    { value: "", label: "None (no transition)" },
    { value: "reset", label: "Clear Status (reset)" },
    { value: "available - station", label: "Available (Station)" },
    { value: "available - satellite", label: "Available (Satellite)" },
    { value: "delayed response", label: "Delayed Response" },
    { value: "WFH", label: "Working From Home" },
    { value: "not available", label: "Unavailable" },
] as const;

function UrlBuilder({ token, endpointUrl, copyToClipboard }: { token: string, endpointUrl: string, copyToClipboard: (text: string, message: string) => void }) {
    const [selectedStatus, setSelectedStatus] = useState("");
    const [durationHours, setDurationHours] = useState("");
    const [nextStatus, setNextStatus] = useState("");

    // Build the URL dynamically
    const buildUrl = () => {
        if (!selectedStatus) return null;
        const params = new URLSearchParams();
        params.set("token", token);
        params.set("status", selectedStatus);
        if (durationHours && parseFloat(durationHours) > 0) {
            params.set("durationHours", durationHours);
        }
        if (nextStatus) {
            params.set("nextStatus", nextStatus);
        }
        return `${endpointUrl}?${params.toString()}`;
    };

    const generatedUrl = buildUrl();

    // Build a human-readable summary
    const buildSummary = () => {
        if (!selectedStatus) return null;
        const statusLabel = STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label || selectedStatus;
        let summary = `Set status to "${statusLabel}"`;
        if (durationHours && parseFloat(durationHours) > 0) {
            summary += ` for ${durationHours} hour${parseFloat(durationHours) !== 1 ? 's' : ''}`;
        }
        if (nextStatus) {
            const nextLabel = NEXT_STATUS_OPTIONS.find(s => s.value === nextStatus)?.label || nextStatus;
            summary += `, then → ${nextLabel}`;
        }
        return summary;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    URL Builder
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Build a custom webhook URL by choosing the options below.
                </p>
            </div>

            <div className="p-5 space-y-5">
                {/* Step 1: Status */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        1. Choose status <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {STATUS_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedStatus(option.value)}
                                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all text-left ${selectedStatus === option.value
                                        ? `${option.color} ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-800 shadow-sm`
                                        : `${option.color} opacity-70 hover:opacity-100`
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Step 2: Duration (optional) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        2. Duration in hours <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            value={durationHours}
                            onChange={(e) => setDurationHours(e.target.value)}
                            placeholder="e.g. 4"
                            min="0.5"
                            step="0.5"
                            className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">hours</span>
                        {/* Quick duration buttons */}
                        <div className="flex gap-1.5 ml-2">
                            {[1, 2, 4, 8, 12, 24].map((h) => (
                                <button
                                    key={h}
                                    onClick={() => setDurationHours(String(h))}
                                    className={`px-2 py-1 rounded text-xs transition-colors ${durationHours === String(h)
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Step 3: Next Status (optional) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        3. After duration, switch to <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    >
                        {NEXT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Generated URL */}
                {generatedUrl ? (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Summary:</span> {buildSummary()}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-xs overflow-x-auto whitespace-nowrap">
                                {generatedUrl}
                            </div>
                            <button
                                onClick={() => copyToClipboard(generatedUrl, "Custom URL copied!")}
                                className="px-5 py-2.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Copy className="w-4 h-4" />
                                Copy URL
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Select a status above to generate your URL.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ExampleIntegration({ title, description, url, onCopy }: { title: string, description?: string, url: string, onCopy: () => void }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center gap-3">
                <div className="min-w-0">
                    <h3 className="font-medium text-sm">{title}</h3>
                    {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded uppercase shrink-0">POST</span>
            </div>
            <div className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 font-mono text-xs overflow-x-auto whitespace-nowrap">
                        {url}
                    </div>
                    <button
                        onClick={onCopy}
                        className="px-4 py-2 shrink-0 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Copy className="w-4 h-4" />
                        Copy URL
                    </button>
                </div>
            </div>
        </div>
    );
}
