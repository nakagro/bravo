"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Archive,
  KeyRound,
  CalendarDays,
  Cog,
  LogOut,
  Home,
  Users,
  Wrench,
  ShieldAlert,
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

export function HamburgerMenu() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.auth.loggedInUser);
  // const moduleSettings = useQuery(api.modules.getModuleSettings); // Kept from original, though not directly used in this refactored menu logic
  const location = useLocation();
  const navigate = useNavigate();

  const hoseAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "hoses" });
  const keysAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "keys" });
  const availabilityAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "availability" });
  const dutyCrewAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "dutyCrew" });
  const settingsAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "settings" });
  const adminAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "admin" });

  const hasModuleAccess = (moduleId: string): boolean => {
    switch (moduleId) {
      case "hoses": return hoseAccess === true;
      case "keys": return keysAccess === true;
      case "availability": return availabilityAccess === true;
      case "dutyCrew": return dutyCrewAccess === true;
      case "settings": return settingsAccess === true;
      case "admin": return adminAccess === true;
      default: return false;
    }
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu">
          <Menu className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 dark:border-neutral-700" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Navigation</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleNavigation("/")}
            className={location.pathname === '/' ? 'bg-accent text-accent-foreground' : ''}
          >
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>

          {hasModuleAccess("availability") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/availability")}
              className={location.pathname === '/availability' ? 'bg-accent text-accent-foreground' : ''}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              <span>Availability</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("hoses") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/hoses")}
              className={location.pathname === '/hoses' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Archive className="mr-2 h-4 w-4" />
              <span>Hose Inventory</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("keys") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/keys")}
              className={location.pathname === '/keys' ? 'bg-accent text-accent-foreground' : ''}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              <span>Key Management</span>
            </DropdownMenuItem>
          )}

          {hasModuleAccess("dutyCrew") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/dutycrew")}
              className={location.pathname === '/dutycrew' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Duty Crew</span>
              <Badge variant="outline" className="ml-auto">Preview</Badge>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => handleNavigation("/appliances")}
            className={location.pathname === '/appliances' ? 'bg-accent text-accent-foreground' : ''}
          >
            <Wrench className="mr-2 h-4 w-4" />
            <span>Appliance Checks</span>
            <Badge variant="outline" className="ml-auto">Preview</Badge>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Settings</DropdownMenuLabel>
          {hasModuleAccess("settings") && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/settings")}
              className={location.pathname === '/settings' ? 'bg-accent text-accent-foreground' : ''}
            >
              <Cog className="mr-2 h-4 w-4" />
              <span>User Settings</span>
            </DropdownMenuItem>
          )}

          {(hasModuleAccess("admin") || user?.isAdmin) && (
            <DropdownMenuItem
              onClick={() => handleNavigation("/admin")}
              className={location.pathname === '/admin' ? 'bg-accent text-accent-foreground' : ''}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              <span>Admin Settings</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => { void signOut(); }}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
