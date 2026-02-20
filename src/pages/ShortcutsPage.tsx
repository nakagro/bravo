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
    const baseUrl = import.meta.env.VITE_CONVEX_URL
        ? import.meta.env.VITE_CONVEX_URL.replace('.cloud', '.site')
        : window.location.origin;

    const endpointUrl = `${baseUrl}/api/shortcuts/availability`;

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
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold mt-8 mb-4">Example Webhook URLs</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        You can use these URLs in the Apple Shortcuts &quot;Get content of URL&quot; action. Ensure the action is set to method POST.
                    </p>

                    <ExampleIntegration
                        title="Set to Available (Station)"
                        url={`${endpointUrl}?token=${token}&status=available - station`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=available - station`, "Available URL copied!")}
                    />

                    <ExampleIntegration
                        title="Set to Unavailable"
                        url={`${endpointUrl}?token=${token}&status=not available`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=not available`, "Unavailable URL copied!")}
                    />

                    <ExampleIntegration
                        title="Set to Delayed Response for 2 Hours"
                        url={`${endpointUrl}?token=${token}&status=delayed response&durationHours=2&nextStatus=reset`}
                        onCopy={() => copyToClipboard(`${endpointUrl}?token=${token}&status=delayed response&durationHours=2&nextStatus=reset`, "Delayed URL copied!")}
                    />

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-medium text-sm">Valid Statuses for &quot;status&quot; and &quot;nextStatus&quot; parameters</h3>
                        </div>
                        <div className="p-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <ul className="list-disc pl-5 space-y-1">
                                <li><code>available - station</code></li>
                                <li><code>available - satellite</code></li>
                                <li><code>not available</code></li>
                                <li><code>delayed response</code></li>
                                <li><code>WFH</code></li>
                                <li><code>reset</code> (Valid for nextStatus only. Removes the status entirely.)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ExampleIntegration({ title, url, onCopy }: { title: string, url: string, onCopy: () => void }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                <h3 className="font-medium text-sm">{title}</h3>
                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded uppercase">POST</span>
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
