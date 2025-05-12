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
import type * as hoseComments from "../hoseComments.js";
import type * as hoses from "../hoses.js";
import type * as http from "../http.js";
import type * as keyComments from "../keyComments.js";
import type * as keyItems from "../keyItems.js";
import type * as keys from "../keys.js";

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
  hoseComments: typeof hoseComments;
  hoses: typeof hoses;
  http: typeof http;
  keyComments: typeof keyComments;
  keyItems: typeof keyItems;
  keys: typeof keys;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
