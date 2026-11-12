/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionAccountability from "../actionAccountability.js";
import type * as actionCentre from "../actionCentre.js";
import type * as actionCentreProviders_assignments from "../actionCentreProviders/assignments.js";
import type * as actionCentreProviders_availability from "../actionCentreProviders/availability.js";
import type * as actionCentreProviders_baSkills from "../actionCentreProviders/baSkills.js";
import type * as actionCentreProviders_bookings from "../actionCentreProviders/bookings.js";
import type * as actionCentreProviders_dutyCrew from "../actionCentreProviders/dutyCrew.js";
import type * as actionCentreProviders_events from "../actionCentreProviders/events.js";
import type * as actionCentreProviders_notices from "../actionCentreProviders/notices.js";
import type * as actionCentreProviders_profile from "../actionCentreProviders/profile.js";
import type * as actionCentreProviders_types from "../actionCentreProviders/types.js";
import type * as adminUsers from "../adminUsers.js";
import type * as apiKeyAuth from "../apiKeyAuth.js";
import type * as applianceLocations from "../applianceLocations.js";
import type * as assignmentNotices from "../assignmentNotices.js";
import type * as auth from "../auth.js";
import type * as authManagement from "../authManagement.js";
import type * as availability from "../availability.js";
import type * as availabilityActions from "../availabilityActions.js";
import type * as baCurrency from "../baCurrency.js";
import type * as baRecords from "../baRecords.js";
import type * as bookings from "../bookings.js";
import type * as brigadeCron from "../brigadeCron.js";
import type * as calendarProxy from "../calendarProxy.js";
import type * as calendarWrite from "../calendarWrite.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deploymentAvailability from "../deploymentAvailability.js";
import type * as deploymentCrews from "../deploymentCrews.js";
import type * as dutyCrew from "../dutyCrew.js";
import type * as dutyCrewMembers from "../dutyCrewMembers.js";
import type * as dutyCrewReminders from "../dutyCrewReminders.js";
import type * as emailSettings from "../emailSettings.js";
import type * as emails from "../emails.js";
import type * as equipment from "../equipment.js";
import type * as eventActions from "../eventActions.js";
import type * as eventChangeNotices from "../eventChangeNotices.js";
import type * as eventCrews from "../eventCrews.js";
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
import type * as labsMember from "../labsMember.js";
import type * as lib_accountType from "../lib/accountType.js";
import type * as lib_assignments_deploymentSource from "../lib/assignments/deploymentSource.js";
import type * as lib_assignments_eventSource from "../lib/assignments/eventSource.js";
import type * as lib_assignments_sources from "../lib/assignments/sources.js";
import type * as lib_assignments_types from "../lib/assignments/types.js";
import type * as lib_authUser from "../lib/authUser.js";
import type * as lib_bookingRecurrence from "../lib/bookingRecurrence.js";
import type * as lib_crewSeats from "../lib/crewSeats.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_dutyCrewRotation from "../lib/dutyCrewRotation.js";
import type * as lib_eventBackouts from "../lib/eventBackouts.js";
import type * as lib_eventChangeNotice from "../lib/eventChangeNotice.js";
import type * as lib_eventCrews from "../lib/eventCrews.js";
import type * as lib_hoseId from "../lib/hoseId.js";
import type * as lib_launches from "../lib/launches.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_memberKit from "../lib/memberKit.js";
import type * as lib_notificationDelivery from "../lib/notificationDelivery.js";
import type * as lib_notificationPrefs from "../lib/notificationPrefs.js";
import type * as lib_notificationTemplates from "../lib/notificationTemplates.js";
import type * as lib_notifyEvent from "../lib/notifyEvent.js";
import type * as lib_ranks from "../lib/ranks.js";
import type * as lib_rollNights from "../lib/rollNights.js";
import type * as lib_stationCheckAllocations from "../lib/stationCheckAllocations.js";
import type * as lib_statusValidators from "../lib/statusValidators.js";
import type * as lib_tapeColors from "../lib/tapeColors.js";
import type * as links from "../links.js";
import type * as memberKit from "../memberKit.js";
import type * as memberKitAdmin from "../memberKitAdmin.js";
import type * as messagePresets from "../messagePresets.js";
import type * as messages from "../messages.js";
import type * as migrations_migrateHoseTapeColors from "../migrations/migrateHoseTapeColors.js";
import type * as migrations_normalizeDeploymentDates from "../migrations/normalizeDeploymentDates.js";
import type * as migrations_rekeyAllocationsToTuesdayWeeks from "../migrations/rekeyAllocationsToTuesdayWeeks.js";
import type * as migrations_removeBrigadeTasks from "../migrations/removeBrigadeTasks.js";
import type * as modules from "../modules.js";
import type * as notificationAudit from "../notificationAudit.js";
import type * as notificationHistory from "../notificationHistory.js";
import type * as notificationPrefs from "../notificationPrefs.js";
import type * as notificationSettings from "../notificationSettings.js";
import type * as notificationTemplates from "../notificationTemplates.js";
import type * as passwordReset from "../passwordReset.js";
import type * as plannedShifts from "../plannedShifts.js";
import type * as posthogAnalytics from "../posthogAnalytics.js";
import type * as pushNotificationAction from "../pushNotificationAction.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as qrCodes from "../qrCodes.js";
import type * as seed from "../seed.js";
import type * as serviceAccounts from "../serviceAccounts.js";
import type * as shortcuts from "../shortcuts.js";
import type * as simulation from "../simulation.js";
import type * as skills from "../skills.js";
import type * as stationCheckAllocations from "../stationCheckAllocations.js";
import type * as stationChecks from "../stationChecks.js";
import type * as training from "../training.js";
import type * as userLaunches from "../userLaunches.js";
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
  actionAccountability: typeof actionAccountability;
  actionCentre: typeof actionCentre;
  "actionCentreProviders/assignments": typeof actionCentreProviders_assignments;
  "actionCentreProviders/availability": typeof actionCentreProviders_availability;
  "actionCentreProviders/baSkills": typeof actionCentreProviders_baSkills;
  "actionCentreProviders/bookings": typeof actionCentreProviders_bookings;
  "actionCentreProviders/dutyCrew": typeof actionCentreProviders_dutyCrew;
  "actionCentreProviders/events": typeof actionCentreProviders_events;
  "actionCentreProviders/notices": typeof actionCentreProviders_notices;
  "actionCentreProviders/profile": typeof actionCentreProviders_profile;
  "actionCentreProviders/types": typeof actionCentreProviders_types;
  adminUsers: typeof adminUsers;
  apiKeyAuth: typeof apiKeyAuth;
  applianceLocations: typeof applianceLocations;
  assignmentNotices: typeof assignmentNotices;
  auth: typeof auth;
  authManagement: typeof authManagement;
  availability: typeof availability;
  availabilityActions: typeof availabilityActions;
  baCurrency: typeof baCurrency;
  baRecords: typeof baRecords;
  bookings: typeof bookings;
  brigadeCron: typeof brigadeCron;
  calendarProxy: typeof calendarProxy;
  calendarWrite: typeof calendarWrite;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deploymentAvailability: typeof deploymentAvailability;
  deploymentCrews: typeof deploymentCrews;
  dutyCrew: typeof dutyCrew;
  dutyCrewMembers: typeof dutyCrewMembers;
  dutyCrewReminders: typeof dutyCrewReminders;
  emailSettings: typeof emailSettings;
  emails: typeof emails;
  equipment: typeof equipment;
  eventActions: typeof eventActions;
  eventChangeNotices: typeof eventChangeNotices;
  eventCrews: typeof eventCrews;
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
  labsMember: typeof labsMember;
  "lib/accountType": typeof lib_accountType;
  "lib/assignments/deploymentSource": typeof lib_assignments_deploymentSource;
  "lib/assignments/eventSource": typeof lib_assignments_eventSource;
  "lib/assignments/sources": typeof lib_assignments_sources;
  "lib/assignments/types": typeof lib_assignments_types;
  "lib/authUser": typeof lib_authUser;
  "lib/bookingRecurrence": typeof lib_bookingRecurrence;
  "lib/crewSeats": typeof lib_crewSeats;
  "lib/dates": typeof lib_dates;
  "lib/dutyCrewRotation": typeof lib_dutyCrewRotation;
  "lib/eventBackouts": typeof lib_eventBackouts;
  "lib/eventChangeNotice": typeof lib_eventChangeNotice;
  "lib/eventCrews": typeof lib_eventCrews;
  "lib/hoseId": typeof lib_hoseId;
  "lib/launches": typeof lib_launches;
  "lib/logging": typeof lib_logging;
  "lib/memberKit": typeof lib_memberKit;
  "lib/notificationDelivery": typeof lib_notificationDelivery;
  "lib/notificationPrefs": typeof lib_notificationPrefs;
  "lib/notificationTemplates": typeof lib_notificationTemplates;
  "lib/notifyEvent": typeof lib_notifyEvent;
  "lib/ranks": typeof lib_ranks;
  "lib/rollNights": typeof lib_rollNights;
  "lib/stationCheckAllocations": typeof lib_stationCheckAllocations;
  "lib/statusValidators": typeof lib_statusValidators;
  "lib/tapeColors": typeof lib_tapeColors;
  links: typeof links;
  memberKit: typeof memberKit;
  memberKitAdmin: typeof memberKitAdmin;
  messagePresets: typeof messagePresets;
  messages: typeof messages;
  "migrations/migrateHoseTapeColors": typeof migrations_migrateHoseTapeColors;
  "migrations/normalizeDeploymentDates": typeof migrations_normalizeDeploymentDates;
  "migrations/rekeyAllocationsToTuesdayWeeks": typeof migrations_rekeyAllocationsToTuesdayWeeks;
  "migrations/removeBrigadeTasks": typeof migrations_removeBrigadeTasks;
  modules: typeof modules;
  notificationAudit: typeof notificationAudit;
  notificationHistory: typeof notificationHistory;
  notificationPrefs: typeof notificationPrefs;
  notificationSettings: typeof notificationSettings;
  notificationTemplates: typeof notificationTemplates;
  passwordReset: typeof passwordReset;
  plannedShifts: typeof plannedShifts;
  posthogAnalytics: typeof posthogAnalytics;
  pushNotificationAction: typeof pushNotificationAction;
  pushNotifications: typeof pushNotifications;
  qrCodes: typeof qrCodes;
  seed: typeof seed;
  serviceAccounts: typeof serviceAccounts;
  shortcuts: typeof shortcuts;
  simulation: typeof simulation;
  skills: typeof skills;
  stationCheckAllocations: typeof stationCheckAllocations;
  stationChecks: typeof stationChecks;
  training: typeof training;
  userLaunches: typeof userLaunches;
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
