import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Key, RefreshCw, Clock, Shield, TriangleAlert, CircleCheck, CircleX, Search, CircleHelp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Id } from "../../convex/_generated/dataModel";

export default function AuthManagementPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
    const [isPurging, setIsPurging] = useState(false);
    const [isPurgingAll, setIsPurgingAll] = useState(false);
        
    // Only search when there's a search term
    const searchResults = useQuery(
        api.authManagement.searchUsers,
        searchTerm.length >= 2 ? { searchTerm } : "skip"
    );
    
    // Only fetch auth info when a user is selected
    const authInfo = useQuery(
        api.authManagement.getUserAuthInfo,
        selectedUserId ? { userId: selectedUserId } : "skip"
    );
    
    const authStats = useQuery(api.authManagement.getAuthStats);
    const purgeExpiredTokens = useMutation(api.authManagement.purgeExpiredTokens);
    const purgeAllExpiredTokens = useMutation(api.authManagement.purgeAllExpiredTokens);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return formatDate(timestamp);
    };

    const getSessionHealthBadge = (sessionCount: number) => {
        if (sessionCount === 0) {
            return (
                <Badge variant="outline" className="text-xs">
                    <CircleX className="h-3 w-3 mr-1" />
                    No Sessions
                </Badge>
            );
        }
        if (sessionCount > 5) {
            return (
                <Badge className="text-xs bg-amber-600 hover:bg-amber-700 text-white border-0">
                    <TriangleAlert className="h-3 w-3 mr-1" />
                    {sessionCount} Sessions
                </Badge>
            );
        }
        return (
            <Badge className="text-xs bg-green-600 hover:bg-green-700 text-white border-0">
                <CircleCheck className="h-3 w-3 mr-1" />
                {sessionCount} Session{sessionCount !== 1 ? 's' : ''}
            </Badge>
        );
    };

    const getUserDisplayName = (user: { name?: string; firstName?: string; lastName?: string; email?: string }) => {
        if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`;
        }
        if (user.name) return user.name;
        if (user.email) return user.email;
        return "Unknown User";
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Auth Management</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        View user authentication data, sessions, and tokens
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/admin")}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Admin
                    </Button>
                </div>
            </div>

            {/* Help Section */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="help" className="border rounded-lg bg-card">
                    <AccordionTrigger className="px-4 hover:no-underline">
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <CircleHelp className="h-4 w-4" />
                            Understanding Auth Data
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <Key className="h-4 w-4 text-blue-500" />
                                        Auth Accounts
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Links a user to their authentication method (password, Google, etc.). 
                                        One user can have multiple accounts. If missing, the user cannot sign in.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <Users className="h-4 w-4 text-green-500" />
                                        Sessions
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Created when a user signs in. Represents an active "logged in" state. 
                                        Multiple sessions = logged in on multiple devices/browsers.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <RefreshCw className="h-4 w-4 text-purple-500" />
                                        Refresh Tokens
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Tied to a session. Used to get new access tokens without re-authenticating. 
                                        Have expiration times - expired tokens can cause sign-outs.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="border-t pt-4">
                                <h4 className="font-semibold text-sm mb-2">Common Issues to Look For</h4>
                                <div className="grid gap-2 text-xs">
                                    <div className="flex items-start gap-2">
                                        <Badge className="bg-amber-600 text-white border-0 shrink-0">5+ Sessions</Badge>
                                        <span className="text-muted-foreground">
                                            User may be signing in repeatedly without signing out, or sessions aren't being cleaned up
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Badge variant="destructive" className="shrink-0">Expired Tokens</Badge>
                                        <span className="text-muted-foreground">
                                            Should be cleaned up automatically. If accumulating, there may be a cleanup issue
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Badge variant="outline" className="shrink-0">No Sessions</Badge>
                                        <span className="text-muted-foreground">
                                            User was signed out (session deleted/expired) but still has an auth account
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Stats Cards */}
            {authStats === undefined ? (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2 pt-4 px-4">
                                <Skeleton className="h-4 w-16" />
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <Skeleton className="h-8 w-12" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                Users
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold">{authStats.totalUsers}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Key className="h-3.5 w-3.5" />
                                Sessions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold">{authStats.totalSessions}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Tokens
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold">{authStats.totalRefreshTokens}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <TriangleAlert className="h-3.5 w-3.5" />
                                Multi-Session
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold">{authStats.usersWithMultipleSessions}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                Expired
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-amber-600">{authStats.expiredTokenCount}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <CircleX className="h-3.5 w-3.5" />
                                Orphaned
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-red-600">{authStats.orphanedTokenCount}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Purge Button - skeleton or actual */}
            {authStats === undefined ? (
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-64" />
                            <Skeleton className="h-9 w-32" />
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {/* Purge Button - separate row */}
            {authStats && (authStats.expiredTokenCount > 0 || authStats.orphanedTokenCount > 0) && (
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium">{authStats.expiredTokenCount + authStats.orphanedTokenCount}</span> tokens to clean up 
                                ({authStats.expiredTokenCount} expired + {authStats.orphanedTokenCount} orphaned)
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={isPurgingAll}
                                onClick={async () => {
                                    const total = authStats.expiredTokenCount + authStats.orphanedTokenCount;
                                    if (!confirm(`Are you sure you want to purge ${total} tokens? This runs in the background.`)) return;
                                    setIsPurgingAll(true);
                                    try {
                                        const result = await purgeAllExpiredTokens({});
                                        alert(result.message);
                                    } catch  {
                                        alert('Failed to start purge');
                                    } finally {
                                        setIsPurgingAll(false);
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isPurgingAll ? "Starting..." : "Purge All Tokens"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Search User
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email (min 2 characters)..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setSelectedUserId(null);
                            }}
                            className="pl-10"
                        />
                    </div>
                    
                    {/* Search Results */}
                    {searchTerm.length >= 2 && searchResults && searchResults.length > 0 && !selectedUserId && (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                            </p>
                            <div className="grid gap-2">
                                {searchResults.map((user) => (
                                    <Button
                                        key={user._id}
                                        variant="outline"
                                        className="justify-start h-auto py-2 px-3"
                                        onClick={() => setSelectedUserId(user._id)}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-medium">
                                                {getUserDisplayName(user)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {user.email || "No email"}
                                            </span>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {searchTerm.length >= 2 && searchResults && searchResults.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No users found matching "{searchTerm}"
                        </p>
                    )}
                    
                    {searchTerm.length > 0 && searchTerm.length < 2 && (
                        <p className="text-xs text-muted-foreground">
                            Type at least 2 characters to search
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Selected User Auth Info */}
            {selectedUserId && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                                {authInfo ? getUserDisplayName(authInfo.user) : "Loading..."}
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedUserId(null)}
                            >
                                <CircleX className="h-4 w-4 mr-1" />
                                Clear
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {!authInfo ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                <p className="text-sm text-muted-foreground mt-3">Loading auth data...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* User Summary */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-sm text-muted-foreground">
                                        {authInfo.user.email || "No email"}
                                    </span>
                                    {authInfo.user.isAdmin && (
                                        <Badge className="text-xs bg-purple-600 hover:bg-purple-700 text-white border-0">
                                            <Shield className="h-3 w-3 mr-1" />
                                            Admin
                                        </Badge>
                                    )}
                                    {getSessionHealthBadge(authInfo.sessionCount)}
                                </div>

                                {/* User Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Rank</span>
                                        <span className="font-medium">{authInfo.user.rank || "Not set"}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Status</span>
                                        <span className="font-medium">{authInfo.user.currentStatus || "Not set"}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Status Updated</span>
                                        <span className="font-medium">
                                            {authInfo.user.statusUpdatedAt
                                                ? formatRelativeTime(authInfo.user.statusUpdatedAt)
                                                : "Never"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Last Activity</span>
                                        <span className="font-medium">
                                            {authInfo.lastActivity
                                                ? formatRelativeTime(authInfo.lastActivity)
                                                : "Unknown"}
                                        </span>
                                    </div>
                                </div>

                                {/* Auth Accounts */}
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <Key className="h-4 w-4" />
                                        Auth Accounts ({authInfo.accounts.length})
                                    </h4>
                                    {authInfo.accounts.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No auth accounts found</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {authInfo.accounts.map((account) => (
                                                <div
                                                    key={account._id}
                                                    className="bg-muted/50 rounded-md p-2 text-xs"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <span className="font-medium">
                                                                Provider: {account.provider || "Unknown"}
                                                            </span>
                                                            {account.emailVerified && (
                                                                <Badge variant="outline" className="ml-2 text-xs py-0">
                                                                    Verified
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-muted-foreground">
                                                            Created: {formatDate(account._creationTime)}
                                                        </span>
                                                    </div>
                                                    <div className="text-muted-foreground mt-1 font-mono truncate">
                                                        ID: {account._id}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Sessions */}
                                <div>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Active Sessions ({authInfo.sessions.length})
                                    </h4>
                                    {authInfo.sessions.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No active sessions</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {authInfo.sessions.map((session) => (
                                                <div
                                                    key={session._id}
                                                    className="bg-muted/50 rounded-md p-2 text-xs flex justify-between items-center"
                                                >
                                                    <span className="font-mono truncate">
                                                        {session._id}
                                                    </span>
                                                    <span className="text-muted-foreground ml-2 whitespace-nowrap">
                                                        {formatRelativeTime(session._creationTime)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Refresh Tokens */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            <RefreshCw className="h-4 w-4" />
                                            Refresh Tokens ({authInfo.refreshTokens.length})
                                        </h4>
                                        {authInfo.refreshTokens.some(t => t.expirationTime && t.expirationTime < Date.now()) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs text-destructive hover:text-destructive"
                                                disabled={isPurging}
                                                onClick={async () => {
                                                    if (!selectedUserId) return;
                                                    setIsPurging(true);
                                                    try {
                                                        const result = await purgeExpiredTokens({ userId: selectedUserId });
                                                        alert(`Deleted ${result.deletedCount} expired token${result.deletedCount !== 1 ? 's' : ''}`);
                                                    } catch  {
                                                        alert('Failed to purge tokens');
                                                    } finally {
                                                        setIsPurging(false);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                {isPurging ? "Purging..." : "Purge Expired"}
                                            </Button>
                                        )}
                                    </div>
                                    {authInfo.refreshTokens.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No refresh tokens</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {authInfo.refreshTokens.map((token) => {
                                                const isExpired = token.expirationTime && token.expirationTime < Date.now();
                                                return (
                                                    <div
                                                        key={token._id}
                                                        className={`bg-muted/50 rounded-md p-2 text-xs ${isExpired ? 'border border-amber-500/50' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-mono truncate">
                                                                {token._id}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {isExpired && (
                                                                    <Badge variant="destructive" className="text-xs py-0">
                                                                        Expired
                                                                    </Badge>
                                                                )}
                                                                <span className="text-muted-foreground whitespace-nowrap">
                                                                    {formatRelativeTime(token._creationTime)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {token.expirationTime && (
                                                            <div className="text-muted-foreground mt-1">
                                                                Expires: {formatDate(token.expirationTime)}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {!selectedUserId && searchTerm.length < 2 && (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                        Search for a user to view their auth information
                    </p>
                </div>
            )}
        </div>
    );
}
