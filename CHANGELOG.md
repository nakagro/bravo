# Changelog

## [2026.11.12]
- Events: Organisers can send rostered and crewed members a notification with their shift or seat.
- Events: Members involved in an event can be told when it's cancelled, moved or back on.
- Availability: Crewing officers can tell members they've been crewed for a deployment.
- Events: Organisers can see a running list of the notifications already sent for an event.
- Events: Notify is now Message members, with a preview and a choice of the people involved or everyone.
- Events: Organisers and team leaders are told when someone who said yes, or was rostered or crewed, can't make it any more.
- Admin: Admins can edit the wording of crew, roster and event change notifications.
- Notifications: Deployment crew notifications have their own switch in Settings.

## [2026.11.10]
- Training Roll: Officers can add a short note to a member's mark, such as arriving late.
- Training Roll: Officers can switch a Tuesday between Training and the Brigade Meeting when the meeting moves.
- Events: An event can be set as needing no attendance record, when creating it or afterwards.

## [2026.11.07]
- Notifications: Members can choose which kinds of push notification they get in Settings.
- Notifications: Members without access to Availability no longer get the daily availability reminders.
- Admin: Admins can see and change a member's notification choices from User Management.

## [2026.10.14]
- General: Reminders and the overnight reset now keep their usual times through daylight saving.

## [2026.10.05]
- Training Roll: Officers can take the roll for training nights and brigade meetings, with apologies recorded ahead by the Duty Officer.

## [2026.10.04]
- Admin: Lieutenants can now be numbered 1st to 5th.
- Bookings: A booking can now repeat weekly, fortnightly or monthly.
- Events: Members who only offered for a shift no longer show as no-shows when they weren't rostered.

## [2026.10.01]
- Availability: You can now enter your work shifts ahead of time and be marked unavailable automatically.
- General: Pop-up forms on phones no longer jump around when the keyboard opens.

## [2026.09.29]
- Events: Who's coming is now an easy-to-scan list of names in columns instead of pills.
- Events: Anyone rostered who can't make it is now listed on its own line under their shift.
- Action Centre: Notices like a completed inventory check now show the day and time they came through.
- Action Centre: To-dos and updates now sit in separate sections, with the newest updates first and a Clear all.
- Action Centre: The bell's red number now counts only things you need to do, with a small dot for new updates.
- Action Centre: You can set your availability straight from the Action Centre.
- Brigade Tasks: The Brigade Tasks module has been removed.

## [2026.09.28]
- Events: An event can now need an appliance crewed, with a crew leader, driver and crew picked on the event page.
- Duty Crew: The duty week now runs Tuesday to Monday, changing over at training night instead of Monday.
- Inventory: An appliance check done on a Monday now counts toward the week that is ending.
- Duty Crew: Ticked checks now show the day and date they were done, not just the time.
- Duty Crew: The outgoing crew gets a push at 4pm Monday if station checks are still left to do.
- Duty Crew: A "Mine" filter on This Week shows just the checks allocated to you.
- Duty Crew: The Action Centre reminder now says how many of the checks left are allocated to you.
- Duty Crew: History now shows who ticked each item and when.
- Inventory: Taps on an item show straight away, and you're told if one didn't save.
- Inventory: Finishing a check twice no longer sends the officer two notices.
- Inventory: An in-progress check now shows who started it, when, and how far it got.
- Inventory: History loads more as you scroll back, and the appliance filter now finds older checks.
- Inventory: History now counts a miscounted item as an issue, not a pass.
- Inventory: Each answered item shows who answered it and when.
- Inventory: The Admin tab is reorganised into Overview, Records and Notify, with this week's progress for every appliance at a glance.

## [2026.09.24]
- Availability: Officers can now crew an appliance for a deployment day, and everyone can see it under Deployment → Crews.
- Availability: The Deployment tab's You, Brigade and Crews switch is now a full-width bar that's easier to tap on phones.
- General: Save and Cancel buttons in pop-up forms now look the same everywhere and sit clear of the bottom of the screen on phones.

## [2026.09.23]
- Duty Crew: Weeks now close themselves at the Monday boundary, no Complete button needed.
- Duty Crew: The duty crew officer is emailed what was and wasn't done when a week closes.
- Fire Danger: The dashboard widget now opens the Fire Danger page, which explains what each rating means.
- Fire Danger: "No Rating" now follows dark mode.
- Inventory: The item notes popup no longer jumps around when the keyboard opens.
- Inventory: The "All OK" button is gone, so each item must now be checked on its own.
- Hoses: New hose IDs must be two letters then four digits, e.g. WV3502.
- Availability: Long member names now shorten with "…" instead of pushing the update time onto a second line.
- Availability: Deployment notes now show "Saving…" and "Note saved", and failed changes tell you instead of silently undoing.

## [2026.09.20]
- Sign in: Sign in with a 6-digit code sent to your email, password is still there as a fallback.
- Sign in: One sign-in now carries over to other brigade apps.

## [2026.09.15]
- Events: An event can now let members bring guests.
- Events: Organisers can set a max number of guests per member.
- Events: Optionally ask for dietary requirements, visible only to the organiser and team leaders.
- Events: Organisers can see when each member responded and when they changed it.
- Events: New "Response activity" list showing every change to responses, newest first.

## [2026.08.28]
- Inventory: Appliance templates now have a lifecycle. A template can be active, taken out of service, or archived, instead of only existing or being destroyed. Out of service suits a spare appliance that isn't in use, archived retires a template while keeping every check ever done against it.
- Inventory: A template that has been checked at least once can no longer be permanently deleted. Archiving is the end state, so the history behind a check can't be wiped by accident.
- Duty Crew: An "Inventory Checks" item can now be tied to the real inventory template it stands for. Those rows can't be ticked by hand any more. They tick themselves once the matching inventory check is actually completed that week, and tapping one takes you to that check in the Inventory module. A one tap claim that an appliance was inventoried is no longer possible.
- Duty Crew: A linked row whose appliance is out of service or archived drops off the weekly checklist, so a spare that isn't in use stops being an outstanding job.
- Duty Crew: Fixed the week boundary. The checking week was being worked out in UTC, which meant a check done on a Monday morning, the usual time, counted toward the week that had just finished. Weeks now run Monday to Sunday in Melbourne time, so Inventory and Duty Crew agree on what "this week" means. Daylight saving is handled properly rather than assumed.
- Events: Fixed the same timezone issue when deciding whether an event has already happened.
- Testing: A separate UAT environment has been made to test potentially breaking backend and frontend changes before reaching production users first.

## [2026.08.21]
- Events: After an event has been and gone, the organiser or a team leader can confirm who actually turned up. It starts from who said they were coming, so it's a matter of adjusting the list rather than building it, and the confirmed attendance is then shown on the event.
- Events: An event can now have team leaders. A team leader gets the organiser's tools for that one event only: editing it, allocating shifts, setting who's going, opening and closing responses, notifying members, and seeing the full response list including who hasn't answered. It grants nothing anywhere else in Events, and permanently deleting an event still needs Events Admin. Set them under "Team leaders" when creating or editing an event; the organiser or an Events Admin can appoint, and a team leader can't appoint others.
- Events: Team leaders are named on the event page so everyone knows who to find on the day, tagged beside their name wherever they appear in a roster, and shown a "Team leader" badge on their own events in the Upcoming list.
- Events: The organiser of an event can now manage it even if they aren't an officer or Social Admin. Handing an event over previously left the new organiser unable to edit it, despite being told they could.
- Events: On the Upcoming list, a shift event you've put your hand up for now says "RSVP sent" instead of "On a shift", which read as though a shift had already been given to you. Once the organiser allocates you, it changes to "You're rostered" in the same colour the event page uses for a shift you're rostered on.

## [2026.08.19]
- Duty Crew: A submitted week now keeps a record of the crew who were on that week, so looking back at past weeks shows who was actually rostered rather than whoever is in that crew today.

## [2026.08.17]
- Admin: Create User moved into a collapsible section, so User Management is the first thing on the page.
- Events: Member lists on an event, the shift board, the attending list and the response breakdown, are now sorted alphabetically by the name shown on screen.

## [2026.08.16]
- Duty Crew: Template checks can now include required subitems for the individual steps that must be completed alongside a larger check. Each subitem is shown under its parent check and can be ticked off separately, while completed weeks keep the exact checklist they were submitted with.
- Duty Crew: Crew leaders can optionally allocate a whole area, an individual check or a subitem to someone in that week's crew. Individual allocations override an area allocation, and everyone can see who each task is assigned to.
- BA Skills / Kiosk: BA usage logged from the station tablet now records and displays the tablet service account as the submitter, instead of making it appear that the verifying member submitted it.
- Events: An existing event can now be handed over to another member by changing its organiser. The new organiser gains edit access and responsibility for managing responses.
- Dashboard: Upcoming Events now includes events created in BRAVO alongside the external calendar feed, including multi-day events that are already in progress. BRAVO events link directly to their event and RSVP details.
- Admin: Member accounts can now be disabled and later re-enabled without losing their history, or permanently deleted when appropriate. Disabling signs the member out and removes them from active member lists, rosters and reminders.
- Admin: When a module has both role and minimum-rank requirements, admins can choose whether members must meet both requirements or either one.

## [2026.08.08]
- Duty Crew: Fixed ticked items not being remembered. Checks are saved as you go, so you can tick off an item or two, leave the page, and pick up where you left off, you no longer have to finish the whole week in one sitting. Previously a week's checks could only be found again if everything lined up exactly, so they often came back blank.
- Duty Crew / Inventory: Admins can send themselves a test notification from the Notify section, to confirm the right people will be told before relying on it.
- Inventory: Fixed the layout on phones. Template names on the Checks tab were being cut off by the Start button, and in the template editor an item's name was clipped to a few characters by the quantity box and the icons beside it. On a phone the buttons now sit on their own line, so names get the full width and wrap instead of being chopped off. Tablet and desktop are unchanged.
- Inventory: A checklist that can't be started because an admin has unpublished changes now says so on the card. Previously it just showed a dead button with no explanation. It's also no longer flagged in red, which read as something being wrong when it's only waiting on an admin.
- Inventory: The description and photo editor for lockers and items now uses the pull-up panel used elsewhere in the app, instead of the old centred pop-up. It no longer drops the cursor straight into the description box, so the on-screen keyboard doesn't jump up and shove the form around the moment it opens. It also can't be swiped away by accident while you're typing.
- Inventory: Removed the duplicate "in progress" count from the page heading, it's already on the Checks tab. In the template editor an item's quantity is no longer printed twice on the same row, and the drag handle is now labelled for screen readers.

## [2026.08.07]
- Duty Crew and Inventory checklists now look and behave the same way. Both have a progress ring that stays in view as you scroll and a bottom bar that tells you how many items are left, tap it to jump to the next one. Sections can be collapsed, show their own count, and the notes, confirmation and empty screens are now identical across the two.
- Inventory: Browser pop-ups replaced with proper in-app confirmations, and the tab you're on is now part of the address, so a link to an inventory check opens where you expect.
- Inventory: When a check is completed, the people responsible are now told automatically, in the Action Centre and by email, with anything that came up short named in the notice. Choose who gets told under Inventory → Admin → Notify.

## [2026.08.06]
- Events: Organisers can now close member responses, useful once a roster is set. Members see a "Can't attend" button instead of the usual RSVP, so late changes still get through without reopening the whole event to everyone.
- Events: Responses can be closed from the start when creating an event, and switching between open and closed asks what to do with people who have already responded.

## [2026.08.02]
- Duty Crew: Check items can now be marked "couldn't be completed" (N/A) with a required reason, so one genuinely un-doable item no longer blocks the whole week from being submitted. N/A items show distinctly in the weekly list and in History, with the reason and who marked them.
- Duty Crew: The progress bar now sticks to the bottom of the weekly checklist. When items are outstanding it's a button, tap it to jump to the next unresolved item. Area headings show their own count (e.g. KITCHEN 2/4).
- Duty Crew: Safer taps throughout, bigger week arrows and Reopen button, breathing room between a check row and its notes/delete buttons, a confirmation before deleting an ad-hoc item, and an undo toast when a save overwrites another member's tick. Editing a completed week now tells you it's been reopened instead of doing it silently.
- Duty Crew: Template items can be flagged "Priority", shown red-edged and sorted to the top of the weekly list.
- Duty Crew: Your Action Centre now reminds you when it's your crew's week, with the number of items still outstanding. It clears once the week's checks are submitted.
- Duty Crew: The Schedule tab marks your own crew with a green badge, and Admin → Crews lists members who aren't in any crew yet, with one-tap adding.
- Duty Crew: When a crew submits their weekly checks, the people responsible for duty crew are now told automatically, in the Action Centre and by email. The notice names anything marked N/A or left with a note, so nothing needing attention goes unnoticed.
- Duty Crew: Choose who gets told under Duty Crew → Admin → Notify. Pick people by name, by role (survives a handover without editing the list), or by rank, and turn the Action Centre notice and email on or off independently.
- Action Centre: Some items can now be dismissed with an × when you no longer need to see them. Your duty crew week reminder is the first, dismissing it clears it for that week only and it returns next week. Outstanding obligations like unset availability can't be dismissed.

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
