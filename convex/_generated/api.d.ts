/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeyAuth from "../apiKeyAuth.js";
import type * as applianceLocations from "../applianceLocations.js";
import type * as auth from "../auth.js";
import type * as authManagement from "../authManagement.js";
import type * as availability from "../availability.js";
import type * as availabilityActions from "../availabilityActions.js";
import type * as baSkills from "../baSkills.js";
import type * as baSkillsAudit from "../baSkillsAudit.js";
import type * as bookings from "../bookings.js";
import type * as brigadeTasks from "../brigadeTasks.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deploymentAvailability from "../deploymentAvailability.js";
import type * as dutyCrew from "../dutyCrew.js";
import type * as dutyCrewMembers from "../dutyCrewMembers.js";
import type * as emailSettings from "../emailSettings.js";
import type * as emails from "../emails.js";
import type * as equipment from "../equipment.js";
import type * as feedback from "../feedback.js";
import type * as fireReports from "../fireReports.js";
import type * as hoseAuditTrail from "../hoseAuditTrail.js";
import type * as hoseComments from "../hoseComments.js";
import type * as hoseDashboard from "../hoseDashboard.js";
import type * as hoseStatusSync from "../hoseStatusSync.js";
import type * as hoses from "../hoses.js";
import type * as http from "../http.js";
import type * as inventoryCheckRuns from "../inventoryCheckRuns.js";
import type * as inventoryTemplates from "../inventoryTemplates.js";
import type * as keyAuditTrail from "../keyAuditTrail.js";
import type * as keyComments from "../keyComments.js";
import type * as keyItems from "../keyItems.js";
import type * as keys from "../keys.js";
import type * as lib_logging from "../lib/logging.js";
import type * as links from "../links.js";
import type * as messagePresets from "../messagePresets.js";
import type * as messages from "../messages.js";
import type * as migrations_normalizeDeploymentDates from "../migrations/normalizeDeploymentDates.js";
import type * as modules from "../modules.js";
import type * as notificationAudit from "../notificationAudit.js";
import type * as notificationHistory from "../notificationHistory.js";
import type * as notificationSettings from "../notificationSettings.js";
import type * as passwordReset from "../passwordReset.js";
import type * as posthogAnalytics from "../posthogAnalytics.js";
import type * as pushNotificationAction from "../pushNotificationAction.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as qrCodes from "../qrCodes.js";
import type * as seed from "../seed.js";
import type * as serviceAccounts from "../serviceAccounts.js";
import type * as shortcuts from "../shortcuts.js";
import type * as skills from "../skills.js";
import type * as stationChecks from "../stationChecks.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as vehicleFaultAuditTrail from "../vehicleFaultAuditTrail.js";
import type * as vehicleFaultVehicleTypes from "../vehicleFaultVehicleTypes.js";
import type * as vehicleFaults from "../vehicleFaults.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeyAuth: typeof apiKeyAuth;
  applianceLocations: typeof applianceLocations;
  auth: typeof auth;
  authManagement: typeof authManagement;
  availability: typeof availability;
  availabilityActions: typeof availabilityActions;
  baSkills: typeof baSkills;
  baSkillsAudit: typeof baSkillsAudit;
  bookings: typeof bookings;
  brigadeTasks: typeof brigadeTasks;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deploymentAvailability: typeof deploymentAvailability;
  dutyCrew: typeof dutyCrew;
  dutyCrewMembers: typeof dutyCrewMembers;
  emailSettings: typeof emailSettings;
  emails: typeof emails;
  equipment: typeof equipment;
  feedback: typeof feedback;
  fireReports: typeof fireReports;
  hoseAuditTrail: typeof hoseAuditTrail;
  hoseComments: typeof hoseComments;
  hoseDashboard: typeof hoseDashboard;
  hoseStatusSync: typeof hoseStatusSync;
  hoses: typeof hoses;
  http: typeof http;
  inventoryCheckRuns: typeof inventoryCheckRuns;
  inventoryTemplates: typeof inventoryTemplates;
  keyAuditTrail: typeof keyAuditTrail;
  keyComments: typeof keyComments;
  keyItems: typeof keyItems;
  keys: typeof keys;
  "lib/logging": typeof lib_logging;
  links: typeof links;
  messagePresets: typeof messagePresets;
  messages: typeof messages;
  "migrations/normalizeDeploymentDates": typeof migrations_normalizeDeploymentDates;
  modules: typeof modules;
  notificationAudit: typeof notificationAudit;
  notificationHistory: typeof notificationHistory;
  notificationSettings: typeof notificationSettings;
  passwordReset: typeof passwordReset;
  posthogAnalytics: typeof posthogAnalytics;
  pushNotificationAction: typeof pushNotificationAction;
  pushNotifications: typeof pushNotifications;
  qrCodes: typeof qrCodes;
  seed: typeof seed;
  serviceAccounts: typeof serviceAccounts;
  shortcuts: typeof shortcuts;
  skills: typeof skills;
  stationChecks: typeof stationChecks;
  users: typeof users;
  utils: typeof utils;
  vehicleFaultAuditTrail: typeof vehicleFaultAuditTrail;
  vehicleFaultVehicleTypes: typeof vehicleFaultVehicleTypes;
  vehicleFaults: typeof vehicleFaults;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
