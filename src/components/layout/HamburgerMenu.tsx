"use client";
import React from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  KeyRound,
  CalendarDays,
  Cog,
  LogOut,
  Home,
  Users,
  Wrench,
  ShieldAlert,
  FileText,
  MessageSquare,
  AlertTriangle,
  Link2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getVersionString } from "@/utils/version";
import { AnimatedHamburger } from "@/components/common/AnimatedHamburger";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";

export const HamburgerMenu = React.memo(() => {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.auth.loggedInUser);
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);

  // Use single optimized query instead of 12 separate queries
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);

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
    navigate(path);
  };

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`h-12 w-12 p-2 transition-all duration-200 active:scale-95 hover:bg-transparent ${
            isOpen 
              ? 'bg-accent text-accent-foreground shadow-sm' 
              : ''
          }`}
          aria-label="Menu"
        >
          <AnimatedHamburger isOpen={isOpen} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 text-base dark:border-neutral-700" align="end">
        <DropdownMenuLabel className="font-normal py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col space-y-2 flex-1 min-w-0">
              <p className="text-base font-medium leading-none">{displayName}</p>
              <p className="text-sm leading-none text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
            <DarkModeToggle />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-sm font-semibold py-2">Navigation</DropdownMenuLabel>
          {hasModuleAccess("dashboard") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/")}
              className={location.pathname === '/' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Home className="mr-3 h-5 w-5" />
              <span>Dashboard</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("availability") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/availability")}
              className={location.pathname === '/availability' ? 'bg-accent text-accent-foreground' : ''}
            >
              <CalendarDays className="mr-3 h-5 w-5" />
              <span>Availability</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("hoses") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/hoses")}
              className={location.pathname === '/hoses' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Archive className="mr-3 h-5 w-5" />
              <span>Hose Management</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("keys") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/keys")}
              className={location.pathname === '/keys' ? 'bg-accent text-accent-foreground' : ''}
            >
              <KeyRound className="mr-3 h-5 w-5" />
              <span>Key Management</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("links") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/links")}
              className={location.pathname === '/links' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Link2 className="mr-3 h-5 w-5" />
              <span>Links</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("fireReports") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/fire-reports")}
              className={location.pathname === '/fire-reports' ? 'bg-accent text-accent-foreground' : ''}
            >
              <FileText className="mr-3 h-5 w-5" />
              <span>Fire Reports</span>
              <Badge variant="outline" className="ml-auto">Preview</Badge>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("dutyCrew") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/dutycrew")}
              className={location.pathname === '/dutycrew' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Users className="mr-3 h-5 w-5" />
              <span>Duty Crew</span>
              <Badge variant="outline" className="ml-auto">WIP</Badge>
            </DropdownMenuItem>
          )}



          {hasModuleAccess("applianceChecks") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/appliances")}
              className={location.pathname === '/appliances' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Wrench className="mr-3 h-5 w-5" />
              <span>Appliance Checks</span>
              <Badge variant="outline" className="ml-auto">WIP</Badge>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("vehicleFaults") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/vehicle-faults")}
              className={location.pathname === '/vehicle-faults' ? 'bg-accent text-accent-foreground' : ''}
            >
              <AlertTriangle className="mr-3 h-5 w-5" />
              <span>Vehicle Faults</span>
              <Badge variant="outline" className="ml-auto">WIP</Badge>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-sm font-semibold py-2">Support</DropdownMenuLabel>
          {hasModuleAccess("feedback") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/feedback")}
              className={location.pathname === '/feedback' ? 'bg-accent text-accent-foreground' : ''}
            >
              <MessageSquare className="mr-3 h-5 w-5" />
              <span>Feedback</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-sm font-semibold py-2">Settings</DropdownMenuLabel>
          {hasModuleAccess("settings") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/settings")}
              className={location.pathname === '/settings' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Cog className="mr-3 h-5 w-5" />
              <span>User Settings</span>
            </DropdownMenuItem>
          )}

          {(hasModuleAccess("admin") || user?.isAdmin) && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/admin")}
              className={location.pathname === '/admin' ? 'bg-accent text-accent-foreground' : ''}
            >
              <ShieldAlert className="mr-3 h-5 w-5" />
              <span>Admin Settings</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => { void signOut(); }}>
          <LogOut className="mr-3 h-5 w-5" />
          <span>Sign out</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
          v{getVersionString()}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

HamburgerMenu.displayName = 'HamburgerMenu';
