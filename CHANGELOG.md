# Changelog

## [2026.08.01]
- Events: Location and Address are now separate optional fields, use either or both, and whichever are set show under "Where".
- Calendar: Events can be saved with a start time and no finish time, shown as open-ended instead of assuming an end.

## [2026.07.17]
- Tooling: Adopted the new Vite+ (`vp`) toolchain. Linting moved from ESLint to Oxlint (now also runs on every commit), and a Vitest test suite was seeded covering availability backend logic and date utilities.
- CI: New GitHub Actions workflow runs lint, typecheck and tests on every push and pull request.
- Dependencies: Adopted TypeScript 7 and updated Convex, @convex-dev/auth, Radix UI, the date picker and many other libraries to their latest versions.
- Code cleanup across ~50 files from the stricter linter (no behaviour changes).

## [2026.07.03]
- Navigation: Replaced the hamburger dropdown with a full-screen navigation sheet, with a theme toggle and tighter, mobile-friendly layout.
- Duty Crew: Check templates can now be grouped by area (e.g. Kitchen, Toilets), and the weekly checklist shows who completed each item and when. Check items are now a single tap-anywhere row with an inline notes button.
- Duty Crew: New History tab, visible to all members, showing past check submissions grouped by month with a tap-to-view detail drawer and "Show earlier" paging. Filter by crew or view all.
- Duty Crew: Schedule tab redesigned, this week's crew gets a full card while future Sundays show as a compact list. Admins can override any Sunday's crew straight from the Schedule tab.
- Duty Crew: Admin tab reworked for mobile, Crews and Templates split into a segmented switcher, templates grouped by area with reordering, and cleaner create buttons.

## [2026.07.01]
- Kiosk: Added a BA Usage logging screen, log a BA wear with member, verifier, date, duration (custom keypad) and notes, right from the kiosk dashboard.
- Action Centre: Renamed from "Action Center" across the app, and added a BA Skills provider so expiring/overdue BA records now surface as actions.
- Dashboard/Menu: BA Skills is now linked from the Hamburger Menu and Dashboard.
- Backend: Added a simulation mode for member availability, used for testing only (disabled in production).

## [2026.06.26]
- Action Centre: New unified hub for outstanding tasks. BA Skills, Bookings, Events and more all report into one place, with priority handling and a bell/notification indicator.

## [2026.06.21]
- Events: Added shifts/slots support, members can express interest in specific shifts on an event, and admins can allocate them via a new dialog. Added an event delete confirmation dialog.
- Events: Admins can now manage event types (add, rename, recolour, reorder, activate/deactivate), download events as .ics calendar files, and members get an "Add to my calendar" button.
- Date picker and modal polish across the app (bounded year dropdown, no more horizontal overflow in side panels).

## [2026.06.20]
- Kiosk: Consolidated the three-tile launcher into a single live dashboard. Gate/door/shed status is now visible with zero taps, Firecall is one tap, and each element opens a focused control modal. Built as layout-as-data so future drag-and-drop editing can be added later.
- Kiosk: Firecall is now a press-and-hold action with a live countdown and cancel option; various layout and wording polish across Station Control, Community Lockup and gate screens.

## [2026.06.19]
- Added a mobile-friendly D14 Contact List, sharing its data layer with the Kiosk version.
- Kiosk: Inactivity timeout extended to 120 seconds, added an on-screen keyboard for custom location entry.

## [2026.06.13]
- Bookings: Admin access control added, plus UI polish to the Admin and Bookings tabs.
- BA Skills: Added CSV export for records and currency data, and a "My Currency" card showing your BA currency status at a glance.

## [2026.06.12]
- Bookings: Approving a booking now has an undo option. Added touch-friendly week navigation, a booking form that opens straight from the schedule, and a connection banner for WebSocket disconnections (later removed in favour of a simpler approach).

## [2026.05.09]
- More BA Skills page improvements to support upcoming release.

## [2026.05.04]
- BA Skills page improvements and maintenance

## [2026.04.23]
- Added D14 Contact list to the Kiosk page.

## [2026.04.15]
- Switched BRAVO from semantic build numbering to date-based build numbering (`YYYY.MM.DD`).

## [1.0.80] - 2026-03-26
- Upgraded Vite from 6 to 8, build times now around 3 seconds with the new Rolldown bundler.
- Vendor chunk splitting: main JS bundle reduced from 2.6MB to 1.3MB, with PDF, React, UI, and Convex libs in separate cacheable chunks.
- Dev server warmup added for faster first page load during local development.
- Upgraded React 18 to 19.2.4.
- Removed forwardRef from all shadcn/ui components; ref is now a standard prop.
- Converted all React.FC usage to function declarations across the codebase.
- Upgraded jspdf 3→4.2.1 (security fix), jspdf-autotable, vite-plugin-pwa, lucide-react (7 renamed icons updated across ~46 files).
- Upgraded Convex 1.27→1.34 and @convex-dev/auth 0.0.86→0.0.91, deployed to VPS.
- Upgraded Zod 3→4.3.6.
- Cleaned up dead code in convex/availability/ and convex/users/.

## [1.0.77] - 2026-03-26
- Lots of refactoring, too many to list. Boring update to most, tons of change in the background.

## [1.0.76] - 2026-03-25
- Vehicle Faults Module: Overhauled with a full component restructure. Fault logging, comments, attachments, audit trail, and vehicle type administration are now properly separated into dedicated components.
- Duty Crew Module: Overhauled with a full component restructure. This week's crew, schedule view, crew management, station check templates and history are now properly separated.
- Availability - Brigade Tab: Now shows this week's duty crew assignment inline and fetches member skills in a single query (no more N+1 per member).
- Availability - You Tab: Duration input improvements with time, hours, and datetime entry modes.
- Bookings Module: Full UX overhaul. Booking and edit forms rebuilt with proper inline validation (React Hook Form + Zod). Rejection now uses a dedicated dialog instead of a browser prompt. Pending approvals extracted into its own reusable component shared across tabs.
- Bookings Module: New inline calendar date picker replacing the native date input, fixing compatibility issues across browsers and inside side panels.
- Shared: New ResponsiveModal component (Drawer on mobile, Sheet on desktop) standardising all form modals across the app.

## [1.0.73] - 2026-03-24
- Hose and Key Management page changes, various not worth listing. Lots of effeciency changes in the code, QoL to make it easier to navigate. 

## [1.0.72] - 2026-03-20
- QR code generator in Links - QR codes can be saved for retrieval or anonymously created.

## [1.0.71] - 2026-03-19
- Availability - You/Brigade Tab: Added a "At Station" button next to "Available - Station" and "WFH" to indicate you are physically at the station alongside with these status'
- Availability - Brigade Tab: On a desktop browser, Available - Station and Satellite will show as with 2 columns side by side.
- Availability - Brigade Tab: QoL change for the Appliance location edit modal - it will show who last updated the location and when.
- Availability - Admin Tab: Removed the banner that informed users that the appliance location permissions have been moved to the Brigade Tab.
- Availability - Deployment Tab: Design change to make it easier to differentiate between the days.

## [1.0.70] - 2026-03-12
- Equipment Module: QoL improvements
- Availability - Deployment Tab: Added a Quick Messages button also in the deployment tab next to the notes text field for easily using pre-set messages.

## [1.0.69] - 2026-03-07
- Availability - Messages Tab: Added a Quick Messages button to the Messages tab. Users can save 5 preset messages to quickly post in the messages tab.
- Improvements to the URL webhook feature backend and logic.

## [1.0.67] - 2026-02-24
- URL webhooks for Availability status'

## [1.0.66] - 2026-02-21
- Added Kiosk screen 

## [1.0.64] - 2026-02-14
- Changed the backend URL of the database

## [1.0.62] - 2026-02-9
- Availability - Admin Tab: Added a banner to the Admin Tab to inform users that the appliance location permissions have been moved to the Brigade Tab. Removed the Appliance Location selector from the Admin tab as it has been superseeded with the Brigade Tab.

## [1.0.61] - 2026-02-09
- Availability - Brigade Tab: Refactored the 'Appliance Location' section, Drivers can now change locations of appliances. Added a time stamp of when the appliance locations were last changed.
- Availability - Admin Tab: Shifted the 'Scheduled Status Change' values around so Time Remaining is at the end.

## [1.0.59] - 2026-02-05
- Temporarily disabled calendar on the dashboard page. 

## [1.0.58] - 2026-02-04
- Changes made to the way The Availability page loads and queries data. Done in batches and not n+1 query for each user who has set their status.

## [1.0.57] - 2026-02-04
- Improvements made to the Auth Management page in Admin Settings to purge expired sessions and refresh tokens.

## [1.0.55] - 2026-01-13
- Availability page, Deployment tab: Trying to fix the deployment duplicate bug again and also added a minor visual change to this view too.

## [1.0.54] - 2025-12-26
- Availability page, Deployment tab: discovered a bug that was introduced by 1.0.53 that was showing the wrong days on the brigade view tab.

## [1.0.53] - 2025-12-25
- Deployment tab on the Availability page was doubling up on the days and duplicating them, bug has been fixed that was causing it.

## [1.0.52] - 2025-12-20
- Backend work to support some upcoming features.
- Fixed some bugs with the new Equipment's module.

## [1.0.51] - 2025-12-19
- Ground work being laid for an upcoming Equipment's module. 
- Inventory Module: some tweaks based on a trial run with some members, such as a yes/no being selected when the user adjusted the QTY found and an easy to reference indication at the top of a historical check what the deviations were.

## [1.0.50] - 2025-12-14
- Force Update button added at the bottom of the User Settings page. Useful if the user wants to force the latest update instead of waiting for it.
- Inventory module; refactored a lot of the code into management smaller components, added the display of the deviations found (such as marking an item as no and/or an item with a QTY that doesn't match the template) at the top when checking previously done inventories so its easier to find what wasn't found as excpected.

## [1.0.48] - 2025-12-05
- 🔥 Extras 🔥

## [1.0.47] - 2025-12-04
- Added Fire Danger Ratings for today, tomorrow and the day after on the Dashboard page

## [1.0.46] - 2025-11-30
- Fixed some bugs and added some features to the Booking module:
    - Multi-day bookings with a time frame were not displaying the correct dates (yay Timezones)
    - Added an option for a resource approver to book on behalf of another user.
    - Added an option to block out a resource for a time frame (such as blocking the FCV out while on Strike Team roster)
    - Added the option for a resource to be approver only bookable or open bookable by anyone

## [1.0.45] - 2025-11-28
- Created a Booking module, this module is still being tested and only certain users can access it. This system allows for users to book a resource, such as the FCV, with an approval chain attached to persons responsible for said resource. 

## [1.0.44] - 2025-11-24
- Improved the Inventory module; added expected quantity field to inventory templates, improved layout on mobile.
- Hose and Key Inventory modules given some visual improvements to the pop up modal when Adding/Editing a hose or key.

## [1.0.43] - 2025-11-21
- Added a connection status indicator next to the version number in the menu; green = connected, amber = disconnected/reconnecting
- Enhanced User Management in Admin Settings; users email is now displayed, the "Reset Password" section is now an accordian and the modal is scrollable when the content display is too long
- Email Address field on the sign in page is no longer case sensitive
- Visual changes to the Tab navigation of every module so they are consistent - red, bolded and underline animation on the active tab

## [1.0.41] - 2025-11-19
- AuthSessions should last 365 days and not 30, this should stop the recent monthly forced sign out
- Refactored this About page to read from a markdown file instead of a JSON file for the change log
- Removed automated versioning as part of the About page refactoring
- Added an option to view feedback items in the Admin Settings page

## [1.0.32] - 2025-11-15
- Started tracking failed log on attempts
- Fixed some broken workflows with the new created reset password workflow.

## [1.0.27] - 2025-11-15
- Created a "reset my password" workflow, this means users can reset their own passwords now.

## [1.0.25] - 2025-11-15
- Backend API development

## [1.0.24] - 2025-11-09
- Added this new About page with a changelog 
- Multiple version bumps to align versions across multiple files
