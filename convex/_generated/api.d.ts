/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionCentre from "../actionCentre.js";
import type * as actionCentreProviders_availability from "../actionCentreProviders/availability.js";
import type * as actionCentreProviders_baSkills from "../actionCentreProviders/baSkills.js";
import type * as actionCentreProviders_bookings from "../actionCentreProviders/bookings.js";
import type * as actionCentreProviders_dutyCrew from "../actionCentreProviders/dutyCrew.js";
import type * as actionCentreProviders_events from "../actionCentreProviders/events.js";
import type * as actionCentreProviders_profile from "../actionCentreProviders/profile.js";
import type * as actionCentreProviders_tasks from "../actionCentreProviders/tasks.js";
import type * as actionCentreProviders_types from "../actionCentreProviders/types.js";
import type * as apiKeyAuth from "../apiKeyAuth.js";
import type * as applianceLocations from "../applianceLocations.js";
import type * as auth from "../auth.js";
import type * as authManagement from "../authManagement.js";
import type * as availability from "../availability.js";
import type * as availabilityActions from "../availabilityActions.js";
import type * as baCurrency from "../baCurrency.js";
import type * as baRecords from "../baRecords.js";
import type * as bookings from "../bookings.js";
import type * as brigadeTasks from "../brigadeTasks.js";
import type * as calendarProxy from "../calendarProxy.js";
import type * as calendarWrite from "../calendarWrite.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deploymentAvailability from "../deploymentAvailability.js";
import type * as dutyCrew from "../dutyCrew.js";
import type * as dutyCrewMembers from "../dutyCrewMembers.js";
import type * as emailSettings from "../emailSettings.js";
import type * as emails from "../emails.js";
import type * as equipment from "../equipment.js";
import type * as eventActions from "../eventActions.js";
import type * as eventTypes from "../eventTypes.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as fireReports from "../fireReports.js";
import type * as hoseAuditTrail from "../hoseAuditTrail.js";
import type * as hoseComments from "../hoseComments.js";
import type * as hoseDashboard from "../hoseDashboard.js";
import type * as hoseStatusSync from "../hoseStatusSync.js";
import type * as hoseTapeColors from "../hoseTapeColors.js";
import type * as hoses from "../hoses.js";
import type * as http from "../http.js";
import type * as inventoryCheckRuns from "../inventoryCheckRuns.js";
import type * as inventoryTemplates from "../inventoryTemplates.js";
import type * as keyAuditTrail from "../keyAuditTrail.js";
import type * as keyComments from "../keyComments.js";
import type * as keyItems from "../keyItems.js";
import type * as keys from "../keys.js";
import type * as lib_accountType from "../lib/accountType.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_memberKit from "../lib/memberKit.js";
import type * as lib_tapeColors from "../lib/tapeColors.js";
import type * as links from "../links.js";
import type * as memberKit from "../memberKit.js";
import type * as memberKitAdmin from "../memberKitAdmin.js";
import type * as messagePresets from "../messagePresets.js";
import type * as messages from "../messages.js";
import type * as migrations_migrateHoseTapeColors from "../migrations/migrateHoseTapeColors.js";
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
import type * as simulation from "../simulation.js";
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
  actionCentre: typeof actionCentre;
  "actionCentreProviders/availability": typeof actionCentreProviders_availability;
  "actionCentreProviders/baSkills": typeof actionCentreProviders_baSkills;
  "actionCentreProviders/bookings": typeof actionCentreProviders_bookings;
  "actionCentreProviders/dutyCrew": typeof actionCentreProviders_dutyCrew;
  "actionCentreProviders/events": typeof actionCentreProviders_events;
  "actionCentreProviders/profile": typeof actionCentreProviders_profile;
  "actionCentreProviders/tasks": typeof actionCentreProviders_tasks;
  "actionCentreProviders/types": typeof actionCentreProviders_types;
  apiKeyAuth: typeof apiKeyAuth;
  applianceLocations: typeof applianceLocations;
  auth: typeof auth;
  authManagement: typeof authManagement;
  availability: typeof availability;
  availabilityActions: typeof availabilityActions;
  baCurrency: typeof baCurrency;
  baRecords: typeof baRecords;
  bookings: typeof bookings;
  brigadeTasks: typeof brigadeTasks;
  calendarProxy: typeof calendarProxy;
  calendarWrite: typeof calendarWrite;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deploymentAvailability: typeof deploymentAvailability;
  dutyCrew: typeof dutyCrew;
  dutyCrewMembers: typeof dutyCrewMembers;
  emailSettings: typeof emailSettings;
  emails: typeof emails;
  equipment: typeof equipment;
  eventActions: typeof eventActions;
  eventTypes: typeof eventTypes;
  events: typeof events;
  feedback: typeof feedback;
  fireReports: typeof fireReports;
  hoseAuditTrail: typeof hoseAuditTrail;
  hoseComments: typeof hoseComments;
  hoseDashboard: typeof hoseDashboard;
  hoseStatusSync: typeof hoseStatusSync;
  hoseTapeColors: typeof hoseTapeColors;
  hoses: typeof hoses;
  http: typeof http;
  inventoryCheckRuns: typeof inventoryCheckRuns;
  inventoryTemplates: typeof inventoryTemplates;
  keyAuditTrail: typeof keyAuditTrail;
  keyComments: typeof keyComments;
  keyItems: typeof keyItems;
  keys: typeof keys;
  "lib/accountType": typeof lib_accountType;
  "lib/logging": typeof lib_logging;
  "lib/memberKit": typeof lib_memberKit;
  "lib/tapeColors": typeof lib_tapeColors;
  links: typeof links;
  memberKit: typeof memberKit;
  memberKitAdmin: typeof memberKitAdmin;
  messagePresets: typeof messagePresets;
  messages: typeof messages;
  "migrations/migrateHoseTapeColors": typeof migrations_migrateHoseTapeColors;
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
  simulation: typeof simulation;
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
