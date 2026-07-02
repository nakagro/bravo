"use client";
import React from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useConvexConnectionState } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocation, useNavigate } from "react-router-dom";
import { Cog, LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getVersionString } from "@/utils/version";
import { AnimatedHamburger } from "@/components/common/AnimatedHamburger";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "@/config/navigation";

export const HamburgerMenu = () => {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.auth.loggedInUser);
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const connectionState = useConvexConnectionState();

  // Use single optimized query instead of 12 separate queries
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const pendingActions = useQuery(api.actionCentre.getMyActions);

  const hasModuleAccess = (moduleId: string): boolean => {
    if (!moduleAccess) return false;
    return moduleAccess[moduleId as keyof typeof moduleAccess] === true;
  };

  const displayName = user ?
    (user.firstName) ?
      `${user.firstName}` :
      user.name || user.email || "User" :
    "User";

  if (!isAuthenticated) {
    return null;
  }

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    navigate(path);
    window.scrollTo(0, 0);
  };

  const isVisible = (item: NavItem) => item.alwaysVisible || hasModuleAccess(item.id);

  const renderTile = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const pendingCount =
      item.badge === "pendingActions" && pendingActions ? pendingActions.length : 0;

    return (
      <button
        key={item.id}
        onClick={() => handleNavigation(item.path)}
        className={`group relative flex flex-col items-center text-center gap-1 rounded-lg border p-2 transition-colors ${isActive
          ? 'bg-primary/10 ring-2 ring-primary border-transparent'
          : 'bg-card hover:bg-accent/50 border-border dark:border-neutral-700'
          }`}
      >
        <div className={`p-2 rounded-lg transition-colors ${item.color.bg} ${item.color.bgHover}`}>
          <Icon className={`h-5 w-5 ${item.color.fg}`} />
        </div>
        <span className="text-sm font-medium leading-tight">
          {item.shortLabel ?? item.label}
        </span>
        {item.wip && (
          <Badge variant="outline" className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0">
            WIP
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge variant="destructive" className="absolute top-1.5 right-1.5">
            {pendingCount > 9 ? "9+" : pendingCount}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={`h-12 w-12 p-2 transition-all duration-200 active:scale-95 hover:bg-transparent ${isOpen
            ? 'bg-accent text-accent-foreground shadow-sm'
            : ''
            }`}
          aria-label="Menu"
        >
          <AnimatedHamburger isOpen={isOpen} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        hideCloseButton
        className="w-full sm:max-w-sm p-0 flex flex-col gap-0 dark:border-neutral-700"
      >
        {/* Close button aligned with the header hamburger trigger (header: px-4 py-2, h-12 w-12) */}
        <SheetClose asChild>
          <Button
            variant="ghost"
            className="absolute right-4 top-2 h-12 w-12 p-2 transition-all duration-200 active:scale-95 hover:bg-transparent"
            aria-label="Close menu"
          >
            <AnimatedHamburger isOpen={true} />
          </Button>
        </SheetClose>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border dark:border-neutral-700">
          <div className="flex items-start justify-between gap-3 pr-16">
            <div className="flex flex-col space-y-2 flex-1 min-w-0">
              <SheetTitle className="text-base font-medium leading-none">
                {displayName}
              </SheetTitle>
              <p className="text-sm leading-none text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
            <DarkModeToggle />
          </div>
        </div>

        {/* Module grid */}
        <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-3">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter(
              (item) => item.group === group.id && isVisible(item)
            );
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map(renderTile)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pinned footer */}
        <div className="border-t border-border dark:border-neutral-700 px-4 py-2 space-y-1">
          <div className="flex gap-1.5">
            {hasModuleAccess("settings") && (
              <button
                onClick={() => handleNavigation("/settings")}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-xs transition-colors ${location.pathname === '/settings'
                  ? 'bg-primary/10 ring-1 ring-primary'
                  : 'hover:bg-accent/50'
                  }`}
              >
                <Cog className="h-5 w-5" />
                <span>Settings</span>
              </button>
            )}

            {(hasModuleAccess("admin") || user?.isAdmin) && (
              <button
                onClick={() => handleNavigation("/admin")}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-xs transition-colors ${location.pathname === '/admin'
                  ? 'bg-primary/10 ring-1 ring-primary'
                  : 'hover:bg-accent/50'
                  }`}
              >
                <ShieldAlert className="h-5 w-5" />
                <span>Admin</span>
              </button>
            )}

            <button
              onClick={() => { void signOut(); }}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-xs transition-colors hover:bg-accent/50"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign out</span>
            </button>
          </div>

          <button
            onClick={() => handleNavigation("/about")}
            className="flex w-full justify-center rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
          >
            <span className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="font-semibold bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">BRAVO</span>
              {" · "}
              <span>v{getVersionString()}</span>
              <span className={`inline-block h-2 w-2 rounded-full ${connectionState.isWebSocketConnected
                ? 'bg-green-600 dark:bg-green-500'
                : 'bg-amber-600 dark:bg-amber-500'
                }`} title={
                  connectionState.isWebSocketConnected
                    ? 'Connected'
                    : connectionState.connectionRetries > 0
                      ? 'Reconnecting...'
                      : 'Disconnected'
                } />
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

HamburgerMenu.displayName = 'HamburgerMenu';
