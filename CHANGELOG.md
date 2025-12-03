# Changelog

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
