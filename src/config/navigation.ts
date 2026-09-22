import type { ComponentType } from "react";
import {
  Archive,
  KeyRound,
  CalendarDays,
  Home,
  Users,
  Wrench,
  FileText,
  MessageSquare,
  TriangleAlert,
  Link2,
  Calendar,
  CalendarCheck,
  CalendarRange,
  BellRing,
  ClipboardList,
} from "lucide-react";
import { MaskVentilatorIcon } from "@/components/icons/MaskVentilatorIcon";

export type NavGroup = "operations" | "equipment" | "brigade" | "support";

export interface NavItemColor {
  /** Icon container background, e.g. "bg-green-100 dark:bg-green-900/20" */
  bg: string;
  /** Icon container hover background (dashboard cards use `group` hover) */
  bgHover: string;
  /** Icon foreground colour */
  fg: string;
}

export interface NavItem {
  /** Key into the api.modules.getAllModuleAccess result */
  id: string;
  label: string;
  /** Shorter label for tight tile layouts; falls back to label */
  shortLabel?: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  group: NavGroup;
  /** Rendered regardless of module access (e.g. Action Centre) */
  alwaysVisible?: boolean;
  wip?: boolean;
  color: NavItemColor;
  /** Marker for dynamic badges resolved by the consumer */
  badge?: "pendingActions";
  /** Hide from the dashboard module grid (e.g. Dashboard itself) */
  hideOnDashboard?: boolean;
}

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: "operations", label: "Operations" },
  { id: "equipment", label: "Equipment" },
  { id: "brigade", label: "Brigade" },
  { id: "support", label: "Support" },
];

export const NAV_ITEMS: NavItem[] = [
  // --- Operations ---
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: Home,
    group: "operations",
    hideOnDashboard: true,
    color: {
      bg: "bg-gray-100 dark:bg-gray-900/20",
      bgHover: "group-hover:bg-gray-200 dark:group-hover:bg-gray-900/40",
      fg: "text-gray-600 dark:text-gray-400",
    },
  },
  {
    id: "actions",
    label: "Action Centre",
    shortLabel: "Actions",
    path: "/actions",
    icon: BellRing,
    group: "operations",
    alwaysVisible: true,
    hideOnDashboard: true,
    badge: "pendingActions",
    color: {
      bg: "bg-amber-100 dark:bg-amber-900/20",
      bgHover: "group-hover:bg-amber-200 dark:group-hover:bg-amber-900/40",
      fg: "text-amber-600 dark:text-amber-400",
    },
  },
  {
    id: "availability",
    label: "Availability",
    path: "/availability",
    icon: CalendarDays,
    group: "operations",
    color: {
      bg: "bg-green-100 dark:bg-green-900/20",
      bgHover: "group-hover:bg-green-200 dark:group-hover:bg-green-900/40",
      fg: "text-green-600 dark:text-green-400",
    },
  },
  // Listed here so its dashboard tile sits beside Availability; the hamburger
  // menu still files it under Brigade via `group`.
  {
    id: "events",
    label: "Events",
    path: "/events",
    icon: CalendarCheck,
    group: "brigade",
    color: {
      bg: "bg-emerald-100 dark:bg-emerald-900/20",
      bgHover: "group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/40",
      fg: "text-emerald-600 dark:text-emerald-400",
    },
  },
  {
    id: "dutyCrew",
    label: "Duty Crew",
    path: "/dutycrew",
    icon: Users,
    group: "operations",
    color: {
      bg: "bg-purple-100 dark:bg-purple-900/20",
      bgHover: "group-hover:bg-purple-200 dark:group-hover:bg-purple-900/40",
      fg: "text-purple-600 dark:text-purple-400",
    },
  },
  {
    id: "fireReports",
    label: "Fire Reports",
    path: "/fire-reports",
    icon: FileText,
    group: "operations",
    wip: true,
    color: {
      bg: "bg-orange-100 dark:bg-orange-900/20",
      bgHover: "group-hover:bg-orange-200 dark:group-hover:bg-orange-900/40",
      fg: "text-orange-600 dark:text-orange-400",
    },
  },
  // --- Equipment ---
  {
    id: "hoses",
    label: "Hose Management",
    shortLabel: "Hoses",
    path: "/hoses",
    icon: Archive,
    group: "equipment",
    color: {
      bg: "bg-red-100 dark:bg-red-900/20",
      bgHover: "group-hover:bg-red-200 dark:group-hover:bg-red-900/40",
      fg: "text-red-600 dark:text-red-400",
    },
  },
  {
    id: "keys",
    label: "Key Management",
    shortLabel: "Keys",
    path: "/keys",
    icon: KeyRound,
    group: "equipment",
    color: {
      bg: "bg-blue-100 dark:bg-blue-900/20",
      bgHover: "group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40",
      fg: "text-blue-600 dark:text-blue-400",
    },
  },
  {
    id: "inventory",
    label: "Inventory",
    path: "/inventory",
    icon: Wrench,
    group: "equipment",
    color: {
      bg: "bg-yellow-100 dark:bg-yellow-900/20",
      bgHover: "group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/40",
      fg: "text-yellow-600 dark:text-yellow-400",
    },
  },
  {
    id: "vehicleFaults",
    label: "Vehicle Faults",
    path: "/vehicle-faults",
    icon: TriangleAlert,
    group: "equipment",
    color: {
      bg: "bg-red-100 dark:bg-red-900/20",
      bgHover: "group-hover:bg-red-200 dark:group-hover:bg-red-900/40",
      fg: "text-red-600 dark:text-red-400",
    },
  },
  {
    id: "baSkills",
    label: "BA Skills",
    path: "/ba-skills",
    icon: MaskVentilatorIcon,
    group: "equipment",
    color: {
      bg: "bg-teal-100 dark:bg-teal-900/20",
      bgHover: "group-hover:bg-teal-200 dark:group-hover:bg-teal-900/40",
      fg: "text-teal-600 dark:text-teal-400",
    },
  },
  // --- Brigade ---
  // Order here is the order tiles appear in the menu and dashboard grids.
  {
    id: "calendar",
    label: "Calendar",
    path: "/calendar",
    icon: CalendarRange,
    group: "brigade",
    // Events replaced the calendar tile on the dashboard; the calendar page
    // stays reachable from the menu.
    hideOnDashboard: true,
    color: {
      bg: "bg-purple-100 dark:bg-purple-900/20",
      bgHover: "group-hover:bg-purple-200 dark:group-hover:bg-purple-900/40",
      fg: "text-purple-600 dark:text-purple-400",
    },
  },
  {
    id: "bookings",
    label: "Bookings",
    path: "/bookings",
    icon: Calendar,
    group: "brigade",
    color: {
      bg: "bg-indigo-100 dark:bg-indigo-900/20",
      bgHover: "group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/40",
      fg: "text-indigo-600 dark:text-indigo-400",
    },
  },
  {
    id: "memberRecords",
    label: "Member Records",
    shortLabel: "Records",
    path: "/member-records",
    icon: ClipboardList,
    group: "brigade",
    color: {
      bg: "bg-rose-100 dark:bg-rose-900/20",
      bgHover: "group-hover:bg-rose-200 dark:group-hover:bg-rose-900/40",
      fg: "text-rose-600 dark:text-rose-400",
    },
  },
  {
    id: "links",
    label: "Links",
    path: "/links",
    icon: Link2,
    group: "brigade",
    color: {
      bg: "bg-cyan-100 dark:bg-cyan-900/20",
      bgHover: "group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/40",
      fg: "text-cyan-600 dark:text-cyan-400",
    },
  },
  // --- Support ---
  {
    id: "feedback",
    label: "Feedback",
    path: "/feedback",
    icon: MessageSquare,
    group: "support",
    hideOnDashboard: true,
    color: {
      bg: "bg-slate-100 dark:bg-slate-900/20",
      bgHover: "group-hover:bg-slate-200 dark:group-hover:bg-slate-900/40",
      fg: "text-slate-600 dark:text-slate-400",
    },
  },
];
