"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bars3Icon, ArchiveBoxIcon, KeyIcon, CalendarIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

export function HamburgerMenu() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.auth.loggedInUser);
  const moduleSettings = useQuery(api.modules.getModuleSettings);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Fetch module access status for the current user
  const hoseAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "hoses" });
  const keysAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "keys" });
  const availabilityAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "availability" });
  const dutyCrewAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "dutyCrew" });
  const settingsAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "settings" });
  const adminAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "admin" });
  
  // Helper function to check if a module is accessible to the current user
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

  // Get the user's display name (prefer firstName if available)
  const displayName = user ? 
    (user.firstName) ? 
      `${user.firstName}` : 
      user.name || user.email || "User" : 
    "User";

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger button */}
      <button 
        className="flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu"
      >
        <Bars3Icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-20 border border-gray-200 dark:border-gray-700 animate-fadeIn">
          {/* User info */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{displayName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
          
          {/* Navigation items */}
          <div className="py-1 border-b border-gray-200">
            <h3 className="px-4 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Navigation</h3>
            
            <Link 
              to="/"
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <HomeIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
              Dashboard
            </Link>
            
            {hasModuleAccess("availability") && (
              <Link 
                to="/availability"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/availability' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <CalendarIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                Availability
              </Link>
            )}

            {/* Hose Inventory */}
            {hasModuleAccess("hoses") && (
              <Link 
                to="/hoses"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/hoses' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                Hose Inventory
              </Link>
            )}
            
            {/* Keys Management */}
            {hasModuleAccess("keys") && (
              <Link 
                to="/keys"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/keys' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <KeyIcon className="h-4 w-4 mr-2" />
                Key Management
              </Link>
            )}

            {hasModuleAccess("dutyCrew") && (
              <Link 
                to="/dutycrew"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/dutycrew' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <CalendarIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                Duty Crew
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">Preview</span>
              </Link>
            )}
            
            <Link 
              to="/appliances"
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center ${location.pathname === '/appliances' ? 'text-red-700 font-medium' : 'text-gray-700'}`}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                />
              </svg>
              Appliance Checks
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">Preview</span>
            </Link>
          {/* End of commented section */}
          </div>
          
          {/* Settings section */}
          <div className="py-1">
            <h3 className="px-4 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Settings</h3>
            {hasModuleAccess("settings") && (
              <Link 
                to="/settings"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/settings' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <Cog6ToothIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                User Settings
              </Link>
            )}
          </div>
          
            
            {/* Admin Settings - Always show to admins regardless of module settings */}
            {(hasModuleAccess("admin") || user?.isAdmin) && (
              <Link 
                to="/admin"
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center ${location.pathname === '/admin' ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <Cog6ToothIcon className="h-4 w-4 mr-2" />
                Admin Settings
              </Link>
            )}

          {/* Sign out button */}
          <div className="py-1 border-t border-gray-200 dark:border-gray-700">
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
              onClick={() => {
                void signOut();
                setIsOpen(false);
              }}
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
