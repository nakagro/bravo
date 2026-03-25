# Changelog

## [1.0.74] - 2026-03-25
- Vehicle Faults Module: Overhauled with a full component restructure. Fault logging, comments, attachments, audit trail, and vehicle type administration are now properly separated into dedicated components.
- Duty Crew Module: Overhauled with a full component restructure. This week's crew, schedule view, crew management, station check templates and history are now properly separated.
- Availability - Brigade Tab: Now shows this week's duty crew assignment inline and fetches member skills in a single query (no more N+1 per member).
- Availability - You Tab: Duration input improvements with time, hours, and datetime entry modes.
- Bookings Module: Full UX overhaul — booking and edit forms rebuilt with proper inline validation (React Hook Form + Zod). Rejection now uses a dedicated dialog instead of a browser prompt. Pending approvals extracted into its own reusable component shared across tabs.
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
