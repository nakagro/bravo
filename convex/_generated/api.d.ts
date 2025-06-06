/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as availability_getStatuses from "../availability/getStatuses.js";
import type * as availability_updateStatus from "../availability/updateStatus.js";
import type * as availability from "../availability.js";
import type * as dashboard from "../dashboard.js";
import type * as deploymentAvailability from "../deploymentAvailability.js";
import type * as dutyCrew from "../dutyCrew.js";
import type * as dutyCrewMembers from "../dutyCrewMembers.js";
import type * as hoseComments from "../hoseComments.js";
import type * as hoses from "../hoses.js";
import type * as http from "../http.js";
import type * as keyComments from "../keyComments.js";
import type * as keyItems from "../keyItems.js";
import type * as keys from "../keys.js";
import type * as messages from "../messages.js";
import type * as modules from "../modules.js";
import type * as skills from "../skills.js";
import type * as stationChecks from "../stationChecks.js";
import type * as users_getRoles from "../users/getRoles.js";
import type * as users_getUsers from "../users/getUsers.js";
import type * as users_roles from "../users/roles.js";
import type * as users_updateUserRank from "../users/updateUserRank.js";
import type * as users_updateUserRoles from "../users/updateUserRoles.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "availability/getStatuses": typeof availability_getStatuses;
  "availability/updateStatus": typeof availability_updateStatus;
  availability: typeof availability;
  dashboard: typeof dashboard;
  deploymentAvailability: typeof deploymentAvailability;
  dutyCrew: typeof dutyCrew;
  dutyCrewMembers: typeof dutyCrewMembers;
  hoseComments: typeof hoseComments;
  hoses: typeof hoses;
  http: typeof http;
  keyComments: typeof keyComments;
  keyItems: typeof keyItems;
  keys: typeof keys;
  messages: typeof messages;
  modules: typeof modules;
  skills: typeof skills;
  stationChecks: typeof stationChecks;
  "users/getRoles": typeof users_getRoles;
  "users/getUsers": typeof users_getUsers;
  "users/roles": typeof users_roles;
  "users/updateUserRank": typeof users_updateUserRank;
  "users/updateUserRoles": typeof users_updateUserRoles;
  users: typeof users;
  utils: typeof utils;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
