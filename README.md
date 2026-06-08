# WhaleX V12 — Production Database Version

This version replaces local JSON/file storage with:

- MongoDB Atlas for website data
- Cloudinary for uploaded files

## Where data is stored now

### MongoDB Atlas

Stores:

- User access logins
- Saved user profiles
- Access tickets
- Paid/trial requests
- Trial feedback
- Support tickets
- Reviews
- Profit screenshot records
- Videos
- Monthly reports
- Pricing/settings/product details

### Cloudinary

Stores uploaded files:

- Payment proofs
- Profit screenshots
- Support ticket attachments

## Setup

1. Rename `.env.example` to `.env`
2. Add your values:

```env
ADMIN_PASSWORD=yourStrongPassword
MONGO_URI=yourMongoDbUrl
CLOUDINARY_CLOUD_NAME=yourCloudName
CLOUDINARY_API_KEY=yourApiKey
CLOUDINARY_API_SECRET=yourApiSecret
```

3. Install and run:

```bash
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

Private admin:

```text
http://localhost:3000/whalex-admin
```

Login page:

```text
http://localhost:3000/login.html
```

My Access:

```text
http://localhost:3000/user.html
```

## Notes

- Do not commit `.env` to GitHub.
- For Render/Railway deployment, paste the same values under Environment Variables.
- TradingView access still needs to be granted manually from your TradingView account.
- Razorpay Payment Link can be managed from private admin settings.
- Razorpay webhook automation can be added later.


## V13 update — immediate status + logged-in user bar

### After access request

After paid access or 3-day trial request is submitted:

- User immediately sees a full request/status card.
- Ticket ID is shown clearly.
- Status check form is auto-filled with Ticket ID and Email.
- User sees the 48-hour access message.
- Latest ticket is saved in browser local storage for easier status checks.

### Logged-in user details

When a user is logged in, the website now shows a top user bar on public/user pages:

- Name
- Email
- Phone
- Telegram ID
- TradingView ID
- My Access shortcut
- Profile shortcut
- Logout button


## V14 update — hide login/create account for logged-in users

When user is already logged in:

- Navigation changes `Login / Create Account` to `Profile`.
- My Access page hides `Login / Create Account` CTA.
- My Access page hides `Login First` CTA.
- Helper text changes to logged-in user messaging.
- Login page acts as a Profile page and does not show create/login forms.


## V15 update — My Access Requests

Logged-in users now automatically see their own access requests under `My Access Requests`.

This includes:

- Paid access requests
- 3-day trial requests
- Ticket ID
- Payment status
- Access status
- Start/end date
- Trial feedback status

Users no longer need to manually search for their own trial request after login.


## V16 update — My Access layout cleanup

Changes:

- My Access Requests now appears first under the hero.
- Create Access Request appears after existing/requested access tickets.
- My Access heading and card font sizes reduced to medium.
- Logged-in user strip redesigned from heavy banner to cleaner compact glass bar.
- Access request cards are more compact and easier to scan.


## V17 update — layout and typography optimization

Global visual pass across pages:

- Reduced oversized hero headings on My Access, Login/Profile, Support, Admin, Products, Pricing, Results, Videos.
- Cards are narrower and more functional.
- Forms use medium field sizing.
- User top strip is more compact.
- Admin page uses dashboard-sized typography.
- Support/Login/My Access copy is shorter and cleaner.
- Mobile/tablet layout improved.


## V18 update — My Access priority and smaller fonts

Changes:

- Removed unnecessary My Access subline.
- Reduced My Access hero and card font sizes further.
- Forced Requested Access section to appear first.
- Existing trial/paid request cards appear before the Create Access Request form.
- Request cards redesigned to show status, payment, dates, Telegram, and TradingView in compact blocks.


## V19 update — pending request first

- Show Requested Access section at the top only when there is a pending/open request.
- If there is no pending request, hide that top section and keep the normal layout.
- When multiple requests exist, pending/open ones are prioritized first.


## V20 update — uniform layout cleanup

Changes:

- Removed extra subtitle/sub-lines from functional pages.
- Reduced functional-page hero heading sizes further.
- Made cards/forms uniform width across My Access, Login/Profile, Support, Buy Access, Submit Result, and Admin.
- Removed `Profile` from main navigation when user is logged in.
- Logged-in users now see only My Access / Logout in the visible user controls.
- Buy page layout and pricing typography reduced.


## V21 update — pending request on top

- Restored the missing pending-request section on **My Access**.
- If the user has any open/pending request, it now appears **first at the top** of the page.
- Create Access Request / Check Access Status / Trial Feedback stay below it.


## V22 update — duplicate access rule + status colors

Changes:

- Removed remaining unnecessary sub-lines from My Access/Login/Support/Buy/Admin pages.
- Added duplicate access request protection:
  - One active request per user per access type.
  - User cannot create the same access type again until the old request is completed/done/closed/cancelled.
- Added request status colors:
  - Open/Pending/In Progress/Not Granted: Orange
  - Cancelled/Rejected/Failed: Red
  - Done/Completed/Closed/Granted: Green
- Duplicate request error shows the existing active ticket.


## V23 update — only 3 access ticket statuses

Access ticket status is now restricted to:

- Open — Orange
- Done — Green
- Rejected — Red

Duplicate rule:

- A user can create only one Open request per access type.
- Once the request is Done or Rejected, the user can create a new request for that same access type.


## V24 update — Login spacing and font-size fix

Changes:

- Login page headings reduced.
- Existing User Login and New User cards now have balanced spacing.
- Inputs are smaller and uniform.
- Large blank gaps between labels and inputs removed.
- Login/create buttons reduced to normal height.
- Mobile layout remains one-column and compact.

Important:

- Real `.env` is not included in ZIP for security.
- Copy `.env` from your previous working version before starting.


## V25 update — one Open access request per user

Changes:

- A user can have only one Open access request at a time, across all access types.
- If any request is Open, the user cannot raise another Paid or Trial request.
- Duplicate request message stays visible for 1 minute:
  "You have already raised a request. Please wait until it is Done or Rejected before raising another request."
- My Access now shows only the current Open request at the top.
- If old duplicate Open requests already exist from testing, a warning note appears, but new duplicates are blocked.


## V26 update — login redirect to home

Changes:

- If user is already logged in and opens login.html, they are redirected to Home.
- After successful login, user lands on Home.
- After successful account creation, user lands on Home.
- Login/Create Account page no longer shows logged-in profile cards/forms.
- Logged-in users do not see Login/Create Account in navigation.
- Login page spacing remains compact.


## V27 update — meaningful sub-lines only

Changes:

- Removed generic/internal sub-lines from Login, My Access, Support, and Buy pages.
- Kept useful user-facing sub-lines, especially product/plan details such as WhaleX V1 Access.
- Removed confusing internal/testing wording.
- Current Open request message now says:
  "You already have an Open request. New requests are blocked until this request is Done or Rejected."


## V28 update — auth-gated Buy/My Access flow

Changes:

- Non-logged-in users can view public pages only.
- Clicking Buy / Pay Now / Request Trial / My Access / Submit Access Details redirects to Login/Create Account.
- user.html and submit-result.html require a valid login.
- Logged-out users cannot see access request forms or saved details.
- After login/create account, user returns to the protected page they originally clicked.
- Stale saved form values are not embedded in user.html.


## V29 update — Buy page sub-line cleanup

Changes:

- Removed generic Buy page text such as:
  "This page is only for pricing and payment..."
- Kept useful plan-level information under WhaleX V1 Access.
- Removed confusing/internal wording from public HTML/JS.
- Buy / Trial / Access actions remain login-gated.


## V30 update — Access Tracker first with request dropdown

Changes:

- Access Tracker appears first on My Access.
- Tracker uses a dropdown of the logged-in user's access requests.
- Ticket ID is not pre-filled as plain text.
- Email ID is not required in tracker.
- Current Open/Pending request appears after tracker.
- Create Access Request appears after tracker and Open request section.


## V31 update — login always lands on Home

Changes:

- After successful login, user lands on Home.
- After successful account creation, user lands on Home.
- If already logged in and user opens login.html, user is redirected to Home.
- Removed returnTo behavior from login flow.
- Buy/My Access pages remain protected for logged-out users.


## V32 update — remove My Access refresh buttons

Changes:

- Removed manual Refresh button from Access Tracker.
- Removed manual Refresh button from Current Open Request.
- Tracker and requests load automatically on My Access page load.
- After access request submission, tracker/request list refreshes automatically.


## V33 update — admin access cleanup, auto dates, notifications

Changes:

- Admin Access Tickets now use only 3 ticket statuses: Open, Done, Rejected.
- Removed unnecessary editable admin fields from Access Ticket cards.
- Payment Status and Access Status are computed automatically from Ticket Status.
- When status is Done:
  - Trial access duration defaults to 3 days.
  - Paid access duration defaults to 30 days.
  - Access Start Date is auto-filled if blank.
  - Access End Date is auto-filled from access type if blank.
  - Start Date must be before End Date.
- When status is Done, user receives:
  - in-app notification
  - email notification if SMTP is configured.
- User receives an in-app/email reminder 2 days before expiry if SMTP is configured and app is running.
- Admin receives notification for new access requests, support tickets, and user submissions.
- Added Notification modules for Admin and My Access.
- Added SMTP/env variables to .env.example.


## V34 update — selected Start Date auto-calculates End Date

Fixes:

- Paid access End Date now auto-fills as selected Start Date + 30 days.
- Trial access End Date now auto-fills as selected Start Date + 3 days.
- Admin End Date field is read-only and calculated automatically.
- Server also enforces the same rule, so stale/manual end dates cannot break the logic.
- Access Start Date must be before Access End Date.
- Access Ticket Status still only uses Open, Done, Rejected.
- Admin ticket form remains compact with only necessary editable fields:
  Ticket Status, Access Start Date, Access End Date (auto/read-only), Admin Note.


## V35 update — live End Date auto-fill

Fix:

- End Date now auto-fills immediately after selecting Start Date.
- It no longer waits for Ticket Status to become Done.
- Paid access: End Date = Start Date + 30 days.
- Trial access: End Date = Start Date + 3 days.
- End Date is read-only to avoid manual mistakes.
- Server still recalculates the End Date from Start Date when saving Done status.


## V36 update — UPI QR / barcode

Changes:

- Added QR/barcode below the Manual UPI ID on Buy Access page.
- QR is generated automatically from:
  - Website Settings -> UPI ID
  - Website Settings -> UPI Payee Name
  - Pricing -> Current Price
  - Pricing -> Plan Name
- Added Admin Setting: UPI Payee Name.
- Added server endpoint: /api/payment/upi-qr.svg
- Added dependency: qrcode.
- Rebuilt admin-v4.js cleanly to remove old duplicated notification-function fragments and keep previous fixes:
  - only Open / Done / Rejected for access tickets
  - live access end-date autofill
  - simplified access ticket admin fields
  - notifications module


## V37 update — admin notification fix

Fixes:

- New access request now always creates an admin in-app notification.
- New access request sends admin email if SMTP is configured.
- Admin notification is saved even if SMTP is missing or email fails.
- Admin Notifications section shows:
  - notification title
  - message
  - email recipient
  - email status
  - email error if any
- Added Admin button: Test Admin Email.
- Server logs admin notification status in Terminal.


## V38 update — admin access ticket visibility fix

Fixes:

- Admin data now explicitly returns accessTickets using safeTicket mapping.
- Added dedicated admin endpoint: /api/admin/access-tickets
- Added Admin Overview counts:
  - Access Tickets
  - Users
  - Support Tickets
  - Notifications
- Added Reload Access Tickets button.
- Added terminal log when access ticket is created:
  [Access ticket created]
- Added debug endpoint:
  /api/admin/debug-counts


## V39 update — Admin login Slide model fix

Fixes:

- Fixed admin login crash:
  ReferenceError: Slide is not defined
- Admin data now loads slides from saved settings:
  getSetting("slides", DEFAULTS.slides || [])
- No Slide Mongo model is required.
- Admin login should now work again.
- Keeps V38 fixes:
  - Admin access ticket visibility
  - Reload Access Tickets button
  - Admin overview counts
  - Admin notifications fix
  - UPI QR from V36
  - Live end-date autofill from V35


## V40 update — robust Admin Access Inbox

Fixes:

- Every user access request now writes:
  1. AccessTicket
  2. AccessRequestAudit fallback record
  3. Admin notification
  4. Admin email if SMTP is configured
- Admin Access Tickets now displays Access Inbox using both real tickets and fallback audit records.
- Added endpoint:
  /api/admin/access-inbox
- Updated endpoint:
  /api/admin/access-tickets now returns tickets + inbox.
- Access request submission no longer fails if admin notification/email fails.
- Terminal now shows:
  [Access ticket created]
  [Admin access inbox saved]
  [Admin notification]


## V41 update — trial request submission fix

Fixes from WhaleX Issues sheet:

- Fixed browser JavaScript syntax error in access.js.
- Restored missing renderRequestCard(ticket, options) function wrapper.
- 3-day trial request now shows success message immediately after submit.
- 3-day trial request now renders created ticket card immediately after submit.
- Buy Access -> Request Trial now opens My Access with 3-Day Trial selected.
- Added submit button loading state to avoid duplicate clicks.
- Server logs when access ticket response is sent:
  [Access ticket response sent]
- Keeps V40 Access Inbox fallback:
  [Access ticket created]
  [Admin access inbox saved]
  [Admin notification]


## V42 update — Login UI cleanup + Forgot Password

Fixes:

- Cleaned Login / Create Account layout.
- Balanced Existing User Login and New User Create Account columns.
- Fixed oversized/imbalanced Login button.
- Removed large blank spacing inside login card.
- Added Forgot Password link.
- Added forgot-password email flow:
  POST /api/user/forgot-password
- Added reset-password page:
  /reset-password.html
- Added reset-password endpoint:
  POST /api/user/reset-password
- Reset token expires in 30 minutes.
- Reset token is stored as a hash, not plain text.
- If SMTP is not configured, reset link is logged in Terminal for local testing.


## V43 update — Forgot Password popup modal

Fixes:

- Forgot Password no longer opens as a large inline section below login.
- Forgot Password opens as a clean popup modal.
- Added proper top-right X close button.
- Popup closes on:
  - X button
  - outside backdrop click
  - Escape key
- Login/Create Account page remains visually balanced behind the popup.
- Further polished login button and card spacing.


## V44 update — Live sync + notification bells

Fixes:

- Admin indicator detail changes now update on user portal/public pages automatically.
- Public pages poll /api/public every 5 seconds with no-cache:
  - products.html
  - pricing.html
  - results.html
  - videos.html
- User access/support request activity appears live in Admin without manual refresh.
- Admin panel polls /api/admin/live every 5 seconds:
  - Access Inbox
  - Support Tickets
  - Admin Notifications
  - Counts
- Added notification bell for User module:
  - unread badge
  - dropdown
  - mark one read
  - mark all read
  - live polling
- Added notification bell for Admin module:
  - unread badge
  - dropdown
  - mark one read
  - mark all read
  - live polling
- Added endpoints:
  GET /api/admin/live
  GET /api/admin/notifications
  PATCH /api/admin/notifications/:id/read
  PATCH /api/admin/notifications/read-all
  PATCH /api/user/notifications/:id/read
  PATCH /api/user/notifications/read-all
- Product update route now logs:
  [Indicator details updated]


## V45 update — Clickable notification navigation

Fixes:

- User notification click now marks read and navigates to the related page.
- Admin notification click now marks read and scrolls to the related admin section.
- User mapping:
  - access/trial/payment -> user.html#access
  - password -> login.html
  - support -> support.html
  - review/profit -> results.html
  - video -> videos.html
- Admin mapping:
  - access/trial/payment -> Access Tickets
  - support -> Support Tickets
  - review -> Reviews Approval
  - profit -> Profit Approval
  - video -> YouTube Videos
  - monthly/report -> Monthly Reports
  - product/indicator -> Indicator Details
  - fallback -> Notifications
- Added visual arrow indicator on notification hover.


## V46 update — Bell alignment fix

Fixes:

- User notification bell is now vertically centered in the logged-in user top bar.
- Bell height now matches My Access / Logout pill height.
- Bell icon is centered inside the circular button.
- Notification badge no longer shifts the bell alignment.
- Admin notification bell is also aligned with admin header links.


## V47 update — Admin Indicator Details live sync fix

RCA:

- Admin was saving indicator Product data, but the user portal could still show stale UI because:
  1. Browser could keep cached JS/CSS assets.
  2. Products page had static tab labels.
  3. There was no visible live-data marker to confirm the user portal was reading the latest API payload.

Fixes:

- Added no-cache middleware for HTML, assets, and public API.
- All HTML pages now load JS with ?v=47 cache-buster.
- /api/public returns publicVersion metadata.
- Added /api/public/products test endpoint.
- Product page rebuilds tabs from live MongoDB Product data.
- Product page content re-renders from /api/public every 5 seconds.
- Added visible live sync marker on products page.
- Admin save verifies /api/public/products after saving.
- Terminal log remains:
  [Indicator details updated]

Retest:

1. Start V47.
2. Open products.html.
3. Open Admin -> Indicator Details.
4. Change an indicator name/tag/description/features.
5. Save.
6. Admin should show alert: Public API now has 3 indicators.
7. products.html should update within 5 seconds.
8. Hard refresh once if browser still has old HTML open.


## V48 update — Standard success messages across Admin and User portals

Fixes:

- Added a shared toast notification system:
  public/assets/toast.js
- Every important Save / Save Changes / Submit action now shows a standard success message.
- Added cache-busting for V48 assets:
  ?v=48
- Admin success messages added for:
  - Access ticket save
  - Support ticket save
  - Pricing save
  - Settings save
  - Indicator save
  - Review add / approve / reject / delete
  - Profit/result add / approve / reject / delete
  - YouTube video add / approve / reject / delete
  - Monthly report generate
  - Test admin notification
  - Manual refresh
- User success messages added for:
  - Access request submit
  - Trial request submit
  - Trial feedback submit
  - Support ticket submit
  - Review submit
  - Profit/result submit
  - Forgot password reset link
  - Password reset
  - Login
  - Create account
- Toast behavior:
  - Top-right placement
  - Success/error/info styling
  - Auto-dismiss
  - Manual close button
  - Mobile responsive
- Keeps V47 admin-to-user live sync fixes.


## V49 update — Clean Admin Indicator sync, no visible live debug marker

RCA:
- The visible "Live sync" line was only a debug marker. It was not required for real users and has been removed.
- Admin save needed to be the exact source that /api/public uses.
- The user portal needed to render from the canonical server product source only, not from any static/local product content.

Fixes:
- Removed visible Live Sync marker from user-facing products page.
- Added canonical product source:
  Admin Save -> Mongo Product collection -> runtime latestProductsCache -> /api/public -> user portal render.
- /api/public/products now returns the same canonical product data that the user portal renders.
- Admin save now verifies that /api/public/products contains the exact saved product fields.
- Admin save broadcasts a local refresh event to other open user portal tabs.
- User portal still refreshes silently every 5 seconds, without showing debug text.
- Cache-busted scripts to ?v=49.

Retest:
1. Start V49.
2. Open products.html in one tab.
3. Open Admin -> Indicator Details in another tab.
4. Change WhaleX tag/name/description/features and save.
5. Admin should show: Indicator details saved and synced to the user portal.
6. products.html should update automatically within 5 seconds.
7. No "Live sync" marker should be visible on user portal.

Debug only if needed:
- Open http://localhost:3000/api/public/products
- Confirm it shows your latest saved indicator text.


## V49 debug note

Visible customer-facing debug text is removed. Debugging is still kept in:
- Browser console: [WhaleX public data refreshed]
- Server terminal: [Indicator details updated and synced]
- API check: /api/public/products

This keeps testing traceability without showing technical debug UI to normal users.


## V50 update — Home page Indicator Details sync

RCA:
- V49 fixed Products/Indicators page sync.
- Home page still had hardcoded indicator cards inside the Home slider:
  WX / OF / RM static content.
- Because of that, Admin -> Indicator Details updates showed correctly on products.html,
  but not on index.html.

Fix:
- Home page Suite slide now renders from the same /api/public products data.
- Home card names and descriptions now come from Admin Indicator Details.
- Home dashboard title also uses the first indicator name.
- Added hidden browser console log:
  [WhaleX home suite cards refreshed]
- Cache-busted scripts to ?v=50.

Retest:
1. Start V50.
2. Open index.html and products.html.
3. In Admin -> Indicator Details, update WhaleX / OrderFlow / Risk Manager.
4. Save.
5. products.html should update.
6. index.html Suite slide should also update within 5 seconds.


## V51 update — Home Suite cards forced to live Admin Indicator Details

RCA:
- Products/Indicators page was correctly reading live product data.
- Home page still had old static fallback cards in the Suite slide.
- V50 attempted to update the second slide, but the Home HTML still contained the old static cards.

Fix:
- index.html Suite slide now has a dedicated live container:
  #homeSuiteGrid
- The old static WX / OF / RM fallback cards are replaced with loading placeholders.
- slide-app.js now updates:
  - #homeSuiteGrid
  - #homeSuiteSlide .three-feature-screen
  - any [data-live-products='true'] grid
- Cache-busted scripts to ?v=51.
- Kept console debugging:
  [WhaleX home indicator cards refreshed]

Retest:
1. Start V51.
2. Hard refresh index.html once.
3. Admin -> Indicator Details -> update WhaleX/OrderFlow/Risk Manager.
4. Save.
5. products.html should update.
6. index.html Suite slide should update within 5 seconds.


## V52 update — UPI payment wording cleanup

RCA:
- The Buy Access page used the label “Backup UPI”, which is not meaningful enough for normal users.
- Users may not understand whether it means backup access, backup account, or backup payment method.

Fix:
- Changed “Backup UPI” to “Pay via UPI”.
- Changed “Manual UPI Transfer” to “Scan & Pay via UPI”.
- Added a clear helper line explaining when to use UPI QR/manual payment.
- Changed “Submit Access Details” to “Submit Payment Details”.
- Updated Home flow text from “backup UPI” to “UPI QR”.
- Cache-busted scripts to ?v=52.

Retest:
1. Open pricing.html.
2. Confirm UPI card says “Pay via UPI”.
3. Confirm heading says “Scan & Pay via UPI”.
4. Confirm button says “Submit Payment Details”.


## V53 update — Evidence screenshot preview + download

RCA:
- Users could upload payment proof, but the safe API response did not expose paymentProof to Admin/User views.
- Admin page only had a basic link, and because paymentProof was not returned by safeTicket, the screenshot was not visible.
- Support attachment fields were also not returned by safeSupport.
- If Cloudinary was not configured, uploaded files could fail instead of being stored locally.

Fixes:
- safeTicket now returns:
  - phone
  - paymentId / UTR
  - paymentProof screenshot/PDF URL
  - userNote
- safeSupport now returns:
  - phone
  - TradingView ID
  - message
  - attachment screenshot/PDF URL
- Admin Access Tickets now show:
  - Payment Proof / Screenshot preview
  - Open button
  - Download button
  - Missing evidence warning if no proof was uploaded
- Admin Support Tickets now show:
  - Attachment preview
  - Open button
  - Download button
- Admin Profit Approval now shows screenshot preview.
- User My Access request cards now show submitted payment proof screenshot/PDF.
- Uploads now use Cloudinary if configured, otherwise local fallback:
  /public/uploads/...
- Added protected admin download APIs:
  GET /api/admin/access-tickets/:id/payment-proof/download
  GET /api/admin/support-tickets/:id/attachment/download
- Cache-busted scripts to ?v=53.

Note:
- Existing old tickets will show evidence only if their paymentProof field was saved in MongoDB.
- If an old ticket was created without paymentProof saved, ask the user to submit/re-upload payment details again.


## V54 update — Notification bell UI fix

RCA:
- The top user bar CSS had a broad selector:
  .user-top-actions button
- That selector was applying 36px height to every button inside the notification dropdown.
- Notification rows are also buttons, so they became compressed and text overlapped.

Fix:
- Top-bar button sizing now applies only to direct top-bar buttons/pills.
- Notification dropdown buttons are reset separately.
- Notification rows now have proper auto height, padding, wrapping, and scroll behavior.
- Bell circle remains vertically centered.
- Dropdown row title/message/date no longer overlap.
- Applied to both User and Admin notification bells.
- Cache-busted scripts to ?v=54.


## V55 update — My Access escapeAttr error fix

RCA:
- V53 added payment-proof/evidence preview on the user My Access page.
- The user-side access.js called escapeAttr() while rendering evidence links.
- escapeAttr() existed in Admin JS but was missing in user access.js.
- This caused the Current Open Request block to show:
  escapeAttr is not defined

Fix:
- Added escapeAttr() helper to user access.js.
- Added renderUserEvidenceSafe() wrapper so evidence UI cannot break the whole My Access page.
- Added a safety helper to Admin JS too, if missing.
- Cache-busted scripts to ?v=55.

Retest:
1. Open user.html.
2. Current Open Request should render normally.
3. If payment proof exists, it should show preview/open/download.
4. If proof is missing, page should not throw any red error.


## V56 update — Notification bell badge count fix

RCA:
- User/Admin bell dropdowns could show notifications, but the badge count was calculated only from the visible notification array/readAt state.
- In some cases the API already had unreadCount, but frontend ignored it.
- Badge could also be clipped or hidden by parent button/host sizing.

Fix:
- User bell now uses /api/user/notifications unreadCount from server.
- Admin bell now uses /api/admin/live unreadCount or adminUnreadNotifications.
- Fallback count is calculated from notification.unread/readAt.
- If unread count is zero but notifications exist, badge shows total notification count in gold.
- If unread count is greater than zero, badge shows unread count in red.
- Added console debug:
  [User notification bell count]
  [Admin notification bell count]
- CSS now forces badge to remain visible and not clipped.
- Cache-busted scripts to ?v=56.

Retest:
1. Start V56.
2. Login as user.
3. Bell should show count when notifications exist.
4. Admin bell should show count when admin notifications exist.
5. Mark all read changes unread count; total count badge remains visible if notifications are still present.


## V57 update — Bell unread count + Mark all read fix

RCA:
- V56 made the bell badge show unread count in red.
- But when unread became 0, it still showed total notification count in gold.
- That was wrong for WhaleX because the bell count should mean unread only.
- Admin Mark all read also did not update data.adminUnreadNotifications immediately after the read-all response.

Fix:
- Bell badge is now unread-only.
- If unreadCount = 0, the badge disappears completely.
- User Mark all read now:
  - calls PATCH /api/user/notifications/read-all
  - takes unreadCount from server response
  - sets whaleXUserUnreadCount to 0
  - re-renders bell immediately
- Admin Mark all read now:
  - calls PATCH /api/admin/notifications/read-all
  - takes unreadCount from server response
  - sets data.adminUnreadNotifications to 0
  - re-renders bell immediately
- Read notifications still remain in the dropdown/list, but no count is shown.
- Cache-busted scripts to ?v=57.

Verified code paths:
- User bell render
- User single notification read
- User mark all read
- User polling refresh
- Admin bell render
- Admin single notification read
- Admin mark all read
- Admin live polling refresh


## V58 update — Backend data-flow test runner

Added automated backend test runner:

```bash
npm run test:backend-flow
```

The test runner verifies:

- `/api/health` and DB connection
- Admin login
- Admin indicator update syncs to `/api/public/products`
- User registration
- Access request creation with payment proof upload
- Admin live inbox sees the new request
- Admin can download payment proof
- Duplicate request blocking returns 409
- Admin grants access
- User sees granted access and proof
- User notification unread count
- User Mark all read clears unread count
- Admin notification unread count endpoint
- Admin Mark all read clears unread count

Run locally after starting the server:

```bash
cd ~/Downloads/whalex_v58_production_website
npm start
```

Open a second terminal:

```bash
cd ~/Downloads/whalex_v58_production_website
ADMIN_PASSWORD='your_admin_password' npm run test:backend-flow
```

Optional custom URL:

```bash
BASE_URL=http://localhost:3000 ADMIN_PASSWORD='your_admin_password' npm run test:backend-flow
```

Pass condition:

```text
ALL BACKEND FLOW TESTS PASSED ✅
```


## V59 update — Monthly access Payment ID / UTR mandatory

Fixes:
- Payment ID / UTR is now mandatory for monthly paid access.
- Trial access keeps Payment ID / UTR optional.
- User portal now shows clear help text explaining where to find UTR/Payment ID:
  PhonePe / Google Pay / Paytm / Bank App -> Transaction History -> successful payment -> UTR / UPI Ref No. / Transaction ID / Bank Reference No.
- Razorpay users can enter Razorpay Payment ID / Receipt ID.
- Frontend validation blocks monthly access submission without UTR.
- Backend validation also blocks paid access request without UTR with HTTP 400.
- Backend flow test now includes missing Payment ID / UTR validation.
- Cache-busted scripts to ?v=59.

Retest:
1. Login as user.
2. Open My Access.
3. Select WhaleX V1 Access.
4. Try submit without Payment ID / UTR -> should block with clear message.
5. Enter UTR/payment ID and submit -> should work.
6. Select 3-Day Trial Access -> Payment ID / UTR becomes optional.


## V60 update — Required field * markers across all forms

Fix:
- Added required `*` marker on all required fields across:
  - User login/register
  - Forgot/reset password
  - My Access / payment request
  - Support form
  - Review/result submission
  - Admin settings/pricing/indicator forms
  - Admin access/support/review/profit/video forms
- Added shared script:
  public/assets/required-marker.js
- The marker works for static forms and JavaScript-rendered dynamic forms.
- Added small legend:
  * Required fields
- Payment ID / UTR keeps dynamic behavior:
  - mandatory for monthly/paid access
  - optional for trial access
- Cache-busted scripts to ?v=60.

Technical:
- The script detects input/select/textarea fields with `required` or `aria-required="true"`.
- It finds linked or wrapped labels and appends the red `*`.
- MutationObserver keeps markers updated when Admin/User forms are re-rendered.


## V61 update — Removed required-fields legend/pill from all pages

Fix:
- Removed the visible `* Required fields` pill/legend from all pages.
- Required red `*` marks still remain beside required field labels.
- Added hard CSS fallback to hide any old required legend if browser cache keeps old markup.
- Cache-busted scripts to ?v=61.

RCA:
- V60 added a form-level legend automatically on every required form.
- It looked heavy and repeated too much.
- User requested to remove it from all pages.


## V62 update — Payment Proof mandatory for monthly paid access

Fix:
- For monthly/paid access, Payment Proof screenshot/PDF is mandatory.
- Backend blocks paid requests without Payment Proof using HTTP 400.
- Frontend blocks paid request submission if Payment Proof is missing.
- Payment ID / UTR remains mandatory for monthly/paid access.
- Trial access keeps Payment ID / UTR and Payment Proof optional.
- Payment Proof required `*` marker updates dynamically when user switches access type.
- Backend test runner now checks missing Payment Proof validation.
- Cache-busted scripts to ?v=62.

Expected behavior:
- Monthly paid access requires:
  1. Payment ID / UTR
  2. Payment Proof screenshot/PDF
- Trial access does not require payment details.


## V63 update — Required `*` marker inline everywhere

Fix:
- Required mark now appears inline with the field label:
  - Name*
  - Email ID*
  - Payment Proof*
  - Payment ID / UTR*
- The `*` will not appear on the next line.
- The fix applies globally across User and Admin forms.
- Older misplaced required stars are removed and reinserted in the correct inline position.
- Cache-busted scripts to ?v=63.

RCA:
- Earlier required-marker.js inserted `*` before wrapped input fields.
- Some labels use block layout, so the star appeared as a separate line.
- V63 inserts the star next to the actual label text instead.


## V64 update — Required star properly inline everywhere

Fix:
- Required `*` is now written directly into the label text.
- It will display exactly like:
  - Name*
  - Email ID*
  - Password*
  - Payment Proof*
  - Payment ID / UTR*
- Removed the old separate DOM star span layout issue.
- Old/cached `.required-star` spans are force-hidden as a fallback.
- Applies to User + Admin + dynamic JS-rendered forms.
- Cache-busted scripts to ?v=64.

RCA:
- Even after V63, the site form CSS could still layout the inserted star span as its own row.
- V64 does not rely on a visible span anymore. It updates the actual label text node itself.


## V65 update — Hide monthly payment-only fields for Trial access

Fix:
- When Access Type is `3-Day Trial Access`, these monthly-only fields are hidden:
  - Payment ID / UTR
  - UTR info card
  - Payment Proof
  - Note
- Hidden fields are disabled and cleared, so they are not submitted for trial requests.
- When Access Type is monthly/paid, the fields reappear and:
  - Payment ID / UTR is mandatory
  - Payment Proof is mandatory
  - Note is optional
- User request cards do not show Payment/Evidence rows for trial tickets.
- Admin Access Tickets do not show Payment ID / UTR or missing evidence panels for trial tickets.
- Cache-busted scripts to ?v=65.

Expected:
- Trial form should show only required identity/access fields.
- Monthly form should show payment fields.


## V66 update — Trial hides payment fields + preserves data

Fix:
- For Trial access, monthly-only fields are hidden:
  - Payment ID / UTR
  - UTR info card
  - Payment Proof
  - Note
- Switching Trial <-> Monthly no longer clears entered values.
- If user entered UTR/proof for monthly and switches temporarily to trial, data remains in the DOM and returns when monthly is selected again.
- Hidden trial payment fields are disabled so they are not submitted for trial.
- For monthly paid access:
  - Payment ID / UTR* is shown
  - Payment Proof* is shown
  - both are mandatory
- Required star cleanup now respects hidden paid-only fields.
- Cache-busted scripts to ?v=66.

RCA:
- V65 hid fields only after JS sync, but cleared their values.
- Some initial page states still showed monthly-only fields because the visibility sync did not run after all dynamic autofill/rendering finished.
- V66 runs the sync on load, delayed ticks, and access-type changes.


## V67 update — Monthly fields return correctly

RCA:
- The page URL could still contain `?plan=trial`.
- V66 mixed the old URL plan with the current dropdown value.
- So even after the user selected `WhaleX V1 Access`, the code still saw `trial` from the URL and kept Payment ID / Payment Proof hidden.

Fix:
- Current Access Type dropdown is now the source of truth.
- Old URL query is used only when there is no dropdown value.
- Selecting `WhaleX V1 Access` immediately shows:
  - Payment ID / UTR*
  - Payment Proof*
  - UTR info card
  - Note
- Selecting `3-Day Trial Access` hides those monthly-only fields.
- Values are preserved when switching Trial ↔ Monthly.
- Cache-busted scripts to ?v=67.


## V68 update — Access Type + Payment ID / UTR visible on access cards

Fix:
- User My Access cards now show:
  - Ticket ID
  - Access Type
  - Payment Status
  - Payment ID / UTR
  - TradingView
  - Telegram
  - Dates
  - Payment Proof / Screenshot
- Trial tickets do not show Payment ID / UTR or Evidence.
- Admin Access Tickets also show:
  - Access Type
  - Payment ID / UTR
  - Payment Proof / Screenshot
- UTR values wrap safely if long.
- Cache-busted scripts to ?v=68.

RCA:
- Backend had paymentId/paymentProof data, but user card display did not show Payment ID / UTR and Access Type clearly.


## V69 update — Removed Paste Saved Details button

Fix:
- Removed the `Paste Saved Details` button from Create Access Request.
- Logged-in user details are already auto-filled, so this helper button is no longer needed.
- `Create Access Request` now takes the full row width.
- Added CSS fallback to hide any cached `pasteDetailsBtn`.
- Cache-busted scripts to ?v=69.

RCA:
- The button was an old helper from the earlier flow where users manually pasted stored details.
- With current login/autofill flow, it creates confusion and is redundant.


## V70 update — Rejection notification + remove extra button

Fix:
- When Admin changes an access ticket to `Rejected`, user now receives:
  - in-app notification
  - email notification through the existing email system
- Notification type: `access_rejected`
- Notification click routes to My Access because it is an access notification.
- Admin note is included as rejection reason when provided.
- Removed the extra `Paste Saved Details` button from Create Access Request.
- Create Access Request button is full width.
- Backend test runner now verifies rejection notification flow.
- Cache-busted scripts to ?v=70.

Expected:
- User raises access request.
- Admin rejects it.
- User bell count increases.
- User notification says access request rejected.
- User email is attempted/sent depending on SMTP config.


## V71 update — Restore production content after backend tests

RCA:
- The automated backend-flow test updates the WhaleX product title to verify:
  Admin Indicator Details -> Public API -> User Portal sync.
- The test used a value like:
  `WhaleX Backend Test 1780138572140`
- Earlier versions did not restore the original product content after the test.
- Because the data is stored in MongoDB, it appeared on the Home page.

Fix:
- Backend test runner now stores original product details before the sync test.
- Backend test runner restores original product details after the sync test.
- Added one-command content restore script:
  `npm run restore:content`
- Added defensive UI cleanup so Backend Test text is not displayed if stale DB data exists.

Restore current MongoDB content:
```bash
cd ~/Downloads/whalex_v71_production_website
ADMIN_PASSWORD='WhaleXAdmin2026' npm run restore:content
```

Then hard refresh:
```text
Command + Shift + R
```

What this restores:
- WhaleX
- WhaleX OrderFlow
- WhaleX Risk Manager


## V72 update — Force-clean Backend Test content

RCA:
- The text `WhaleX Backend Test ...` was created by the backend-flow test while verifying Admin Indicator Details sync.
- V71 added restore logic, but if MongoDB already had stale test data or restore was not run against the same running server/DB, Home still read the stale name from `/api/public/products`.
- The affected places were:
  - MongoDB Product collection
  - `/api/public/products`
  - Home page slide title
  - Home product cards
  - Indicators/Product page tabs/details

Fix:
- Server now auto-cleans any Product data containing `Backend Test`:
  - during startup/default seeding
  - before `/api/public/products` response
  - during public data build
- Frontend now also refuses to display Backend Test names as a safety fallback.
- Backend test runner restores original product content and verifies no `Backend Test` text remains after restore.
- Restore command remains available:
  `npm run restore:content`

To clean your current DB:
```bash
cd ~/Downloads/whalex_v72_production_website
ADMIN_PASSWORD='WhaleXAdmin2026' npm run restore:content
```

Then restart and hard refresh:
```text
Command + Shift + R
```


## V73 update — Notification + email diagnostics/fixes

RCA:
- In-app notification and email delivery were mixed together.
- Email could be skipped/failed because SMTP was not fully configured, but the UI did not clearly expose why.
- Admin email could be missing if `ADMIN_EMAIL` and Admin Settings support email were placeholder values.
- User did not receive a notification immediately after submitting an access request.
- Support ticket user-side notifications were incomplete.

Fix:
- In-app notification is now saved first; email failure can never block bell notifications.
- Added admin recipient fallback:
  1. `ADMIN_EMAIL`
  2. Admin Settings support email
  3. `EMAIL_FROM`
  4. `SMTP_USER`
- Added user notification when access request is submitted.
- Existing Done/Rejected access notifications remain.
- Added support ticket submitted/updated user notifications.
- Added diagnostics endpoint:
  `GET /api/admin/notification-diagnostics`
- Added test endpoint:
  `POST /api/admin/test-email-notification`
- Backend-flow test now checks diagnostics and user submitted notification.
- Cache-busted scripts to ?v=73.

How to diagnose email:
```bash
curl -s http://localhost:3000/api/admin/notification-diagnostics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | python3 -m json.tool
```

Email requires:
```env
ADMIN_EMAIL=your_admin_email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_sending_gmail@gmail.com
SMTP_PASS=your_16_digit_google_app_password
EMAIL_FROM="WhaleX <your_sending_gmail@gmail.com>"
```

Important:
- In-app bell notifications work even if SMTP is not configured.
- Email will show `skipped` or `failed` in notification diagnostics if SMTP config is wrong.


## V74 update — Direct email smoke test

Why:
- If in-app notification works but email does not arrive, we need to test Gmail SMTP directly.
- This removes guessing and prints the exact SMTP error.

New command:
```bash
npm run test:email
```

Optional recipient:
```bash
TEST_EMAIL=your_receiver@gmail.com npm run test:email
```

Expected successful output:
```text
✅ SMTP connection verified.
✅ Email sent successfully.
```

If it fails, the terminal will show:
- SMTP_HOST / SMTP_USER / SMTP_PASS status
- SMTP verify error
- Gmail response code
- exact failure message

Important:
- `SMTP_PASS` must be the Google 16-character App Password.
- Spaces are okay; V74 removes spaces automatically before sending.
- `EMAIL_FROM` should use the same Gmail as `SMTP_USER`.
- Restart `npm start` after editing `.env`.

Startup also now prints:
```text
[WhaleX SMTP startup check]
```
This confirms whether the running server loaded `.env`.


## V75 update — Clear pending access wording

RCA:
- User My Access card showed:
  `Paid Access` + `Not granted`
- This sounded like a rejection, but technically it meant:
  request submitted, payment/admin verification pending.
- Raw backend status is `not_granted`, but user-facing copy should not expose that.

Fix:
- User card now shows:
  `Paid Access Request`
  `Verification Pending`
- Trial card now shows:
  `3-Day Trial Request`
  `Verification Pending`
- Rejected requests still show:
  `Rejected`
- Granted requests still show:
  `Granted`
- Admin Access Tickets now show:
  `Verification Pending`
  instead of raw `not_granted`
- Payment pending shows cleaner text in admin:
  `Payment Pending`
- Cache-busted scripts to ?v=75.

Meaning:
- `Verification Pending` = submitted successfully, waiting for WhaleX admin/payment verification.
- It is not rejected.


## V76 update — Email links + PDF attachments

Fix:
- Important emails now include direct clickable links.
- Important emails now include a PDF attachment with request/ticket details.
- User access request submitted email includes:
  - Track My Access link
  - Access request PDF
- User access activated email includes:
  - Open My Access link
  - Activated access PDF
- User access rejected email includes:
  - Open My Access link
  - Rejection details PDF
- Admin new access request email includes:
  - Admin Access Tickets link
  - Request details PDF
- Support ticket emails include:
  - Support/Admin link
  - Support ticket PDF
- Expiry reminder includes:
  - My Access link
  - Expiry reminder PDF
- Test email endpoint checks HTML link + PDF attachment.
- Added `APP_URL` env support for correct email links.

Recommended `.env`:
```env
APP_URL=http://localhost:3000
```

For live domain later:
```env
APP_URL=https://your-whalex-domain.com
```

Important:
- `npm install` is required because V76 adds `pdfkit`.


## V77 update — Fix `escapeHtml is not defined`

RCA:
- V76 added HTML email templates and PDF attachments.
- The email template used `escapeHtml()` while building safe HTML content.
- Backend runtime did not have that helper defined, so Admin ticket save could fail with:
  `escapeHtml is not defined`
- This happened when ticket save triggered user/admin email notification generation.

Fix:
- Added backend-safe `escapeHtml()` helper in `server.js`.
- Added frontend fallback helper in admin/access scripts if needed.
- Cache-busted scripts to `?v=77`.

Expected:
- Admin can save ticket as Done/Rejected without popup error.
- Email generation with links/PDF continues working.
- Bell notifications continue working.


## V78 update — 2-day reminders for Monthly + Trial users

Requirement:
- Send reminder 2 days before expiry for Monthly users.
- Send reminder 2 days before expiry for Trial users.
- Trigger both:
  - in-app bell notification
  - email notification
- Email includes meaningful message, link, and PDF attachment.

Implemented:
- Monthly reminder:
  - Title: `WhaleX monthly access expires in 2 days`
  - Message: monthly access is ending; renew before expiry to avoid interruption.
  - Notification type: `monthly_expiry_reminder_2_days`
- Trial reminder:
  - Title: `WhaleX trial ends in 2 days`
  - Message: trial is ending; upgrade to monthly access to continue without interruption.
  - Notification type: `trial_expiry_reminder_2_days`
- Both reminders include:
  - app bell notification
  - email notification
  - My Access link
  - PDF attachment with ticket/access details

Scheduler:
- Runs once 10 seconds after server startup.
- Runs every 1 hour after that.
- Only sends once per ticket because it stores `expiryReminder2DaySentAt`.

Eligibility:
- Ticket Status = `done`
- Access Status = `granted`
- Access End Date = today + 2 days
- Reminder not already sent

Admin test endpoint:
```text
POST /api/admin/run-expiry-reminders
```

Notes:
- Keep `APP_URL=http://localhost:3000` in `.env` for local links.
- For live domain later, set `APP_URL=https://your-domain.com`.


## V79 update — Bell Mark all read clears count

Issue:
- Clicking `Mark all read` could leave the bell badge count visible.
- Cause was a mix of:
  - backend read-all only updating rows matching unread query
  - frontend polling/live sync sometimes re-rendering old unread count
  - returned notification objects not being force-normalized to read state

Fix:
- Backend read-all now marks every notification in the scoped audience/user query as read.
- Backend response now returns `unreadCount: 0`.
- Backend response normalizes returned notifications as `unread: false`.
- User bell clears count immediately before server response.
- Admin bell clears count immediately before server response.
- User/Admin frontend blocks stale polling/live responses for 3 seconds after Mark all read.
- Backend-flow test now verifies:
  - user unread count becomes 0
  - returned user notifications are read
  - admin unread count becomes 0
  - returned admin notifications are read

Expected:
- User: Mark all read immediately removes the red count badge.
- Admin: Mark all read immediately removes the red count badge.
- Refreshing/polling should not bring the count back unless a new notification is created after that.


## V80 update — Active Access Dashboard + remove Access page notification list

Decision:
- New access and renewal follow the same lifecycle.
- No separate renewal lifecycle is added in this version.
- If a user needs renewal, they use the same Create Access Request process.

Added:
- Active Access Dashboard on My Access page.
- Dashboard shows active access details:
  - Ticket ID
  - Access Type
  - Start Date
  - End Date
  - Days remaining
  - TradingView ID
  - Telegram ID
  - Payment Status
  - Access Status

Behavior:
- If user has active granted access, dashboard shows latest active access.
- If user has no active access, dashboard shows a clear inactive message.
- If multiple active accesses exist, dashboard shows latest ending access and notes the count.

Removed:
- In-page `WhaleX Notifications` list from My Access page.
- Notifications are now handled only through the bell dropdown.

Unchanged:
- Access request flow.
- Payment proof/UTR logic.
- Admin approval/rejection flow.
- Email/PDF notifications.
- 2-day reminder logic.
- Bell notification system.


## V81 update — Clear dashboards for User + Admin

Added User Dashboard:
- Current Access status
- Access Type
- Pending Requests count
- Total Requests count
- Active access details:
  - Ticket ID
  - Access Type
  - Start Date
  - End Date
  - TradingView ID
  - Telegram ID
  - Payment Status
  - Access Status

Added Admin Dashboard:
- Total Users
- Active Paid users
- Active Trial users
- Pending Requests
- Payment Pending
- Expiring in 2 Days
- Expiring in 7 Days
- Expired access count
- Rejected requests
- Open Support tickets
- Unread Alerts
- Estimated Revenue
- Latest Pending Access Requests panel
- Expiry Watch panel

Decision maintained:
- New access and renewal use the same Create Access Request lifecycle.
- Notifications stay in the bell only.
- No separate renewal lifecycle added.

Unchanged:
- Payment proof/UTR validations
- Access approval/rejection
- Email/PDF notifications
- 2-day reminders
- Bell Mark all read logic


## V82 update — Admin Waiting for Approval queue

Requirement:
- Admin should clearly see all requests waiting for approval.
- This is the most important operational item.

Added:
- New top priority panel inside Admin Dashboard:
  `Waiting for Admin Approval`
- Shows ALL open access requests waiting for admin action, not only latest few.
- Includes quick stats:
  - Total Waiting
  - Paid Requests
  - Trial Requests
  - Payment Pending
  - Missing Proof
- Each waiting request shows:
  - User name
  - Access type
  - Email
  - TradingView ID
  - Ticket ID
  - Created date
  - Payment status
  - Payment ID / UTR
  - Proof uploaded/missing
  - Review button to Access Tickets

Dashboard metrics updated:
- First metric is now `Waiting Approval`
- Added `Missing Proof`
- Kept active paid/trial, expiry, support, notifications, revenue estimate.

Reason:
- Admin should never miss a pending user request.
- Access Tickets remains the detailed action area.
- Dashboard is now the clear operational summary.


## V83 update — Clean and useful Admin Dashboard

Problem:
- V82 dashboard showed too much information at once.
- Admin dashboard should be an action screen, not a full report dump.

Changed:
- Kept the most important approval queue at the top.
- Simplified approval queue copy and item layout.
- Removed noisy dashboard metrics:
  - Total Users
  - Payment Pending
  - Missing Proof
  - Expiring in 7 Days
  - Expired
  - Rejected
  - Revenue Estimate
  - Extra Expiry Watch panel

Kept only useful daily metrics:
- Waiting Approval
- Active Paid
- Active Trial
- Expiring in 2 Days
- Open Support
- Unread Alerts

Detailed information remains available in:
- Access Tickets
- User Accounts
- Support Tickets
- Monthly Reports
- Notifications


## V84 update — Clickable Admin Dashboard

Requirement:
- Whatever is shown in the Admin Dashboard should navigate to the respective detail section on click.

Added:
- Dashboard cards are now clickable shortcuts.
- Cards support mouse click and keyboard Enter/Space.
- Target section gets a small focus pulse after navigation.

Navigation mapping:
- Waiting Approval → Access Tickets
- Active Paid → User Accounts
- Active Trial → User Accounts
- Expiring in 2 Days → Access Tickets
- Open Support → Support Tickets
- Unread Alerts → Notifications

Also updated:
- Approval queue buttons now use the same smooth section navigation helper.


## V85 update — Admin notifications bell only

Requirement:
- Admin notification section is not required because Admin already has notification bell.
- Dashboard should not show bell/unread alert card.

Changed:
- Removed Admin sidebar `Notifications` menu item.
- Removed Admin `Notifications` page section.
- Removed `Unread Alerts` dashboard card.
- Admin notifications remain available through the bell dropdown only.
- Bell mark-all-read behavior remains unchanged.

Dashboard now keeps:
- Waiting Approval
- Active Paid
- Active Trial
- Expiring in 2 Days
- Open Support


## V86 update — Pricing + Payment Settings from Admin

Added:
- Admin can manage current Monthly pricing:
  - Plan Name
  - Old Price
  - Current Monthly Price
  - Discount Text
  - Monthly Label
  - Monthly Days
  - Monthly enabled/disabled
- Admin can manage Trial:
  - Trial Label
  - Trial Days
  - Trial enabled/disabled
- Future plan structure is now ready:
  - Quarterly
  - Half Yearly
  - Yearly
  - All disabled by default until admin enables them
- Admin payment settings:
  - UPI ID
  - UPI Payee Name
  - Razorpay / payment link
  - Live QR preview generated from UPI ID + price

User-facing:
- Buy Access page reflects admin pricing live.
- Buy Access page reflects admin UPI ID / Payee / QR live.
- My Access request form now shows payment details/QR for paid access.
- Trial still hides payment fields.
- Paid access still requires Payment ID / UTR and Payment Proof.

Backend:
- Public API now returns normalized pricing plans.
- Access ticket creation uses enabled plan metadata.
- UPI QR uses current admin pricing.

Unchanged:
- New access and renewal use the same Create Access Request lifecycle.
- Admin approval/rejection flow remains same.
- Bell/email/PDF notifications remain same.


## V87 update — Notification Channels + Telegram/TradingView Access Tracking

Added:
- Admin channel settings:
  - Email enable/disable
  - WhatsApp enable/disable placeholders
  - Telegram enable/disable
  - Telegram Bot Token
  - Telegram Group/Chat ID
  - Telegram Invite Expiry Hours
- Admin can generate Telegram invite links from Access Tickets.
- Telegram invite is sent to user through app notification + email when email channel is enabled.
- Admin can update Telegram Group status:
  - Pending
  - Invite Generated
  - Joined
  - Left
  - Removed
- Admin can update TradingView Access status:
  - Pending
  - Given
  - Removed
- Admin receives activity updates when Telegram/TradingView status changes.
- User sees Telegram Group and TradingView Access status in My Access.
- Ticket-level activity log added for access actions.

Notes:
- Telegram bot must be admin in the Telegram group and must have permission to create invite links.
- WhatsApp is added as a channel option/foundation. Actual WhatsApp sending still needs WhatsApp Business API/provider credentials and approved templates.
- TradingView access remains manual, but status is now tracked clearly inside WhaleX.

Unchanged:
- Access request lifecycle.
- Payment proof/UTR rules.
- Admin approve/reject flow.
- Bell/email/PDF notification foundation.


## V88 update — Multiple Telegram Groups / Channels

Added:
- Admin can add multiple Telegram destinations using one field:
  `Telegram Destinations — one per line`
- Format:
  `Display Name | Chat ID or @channelusername | enabled`
- Example:
  `WhaleX Main Group | -1001234567890 | enabled`
  `WhaleX VIP Channel | @whalexvip | enabled`
  `WhaleX OrderFlow Group | -1009876543210 | enabled`

Telegram invite behavior:
- Admin clicks `Generate Invites for All Enabled`.
- Backend creates separate invite links for every enabled destination.
- Ticket stores all generated Telegram links.
- User receives all Telegram links through app bell + email if email channel is enabled.
- Admin sees per-destination invite/status inside Access Tickets.
- User sees all available Telegram links inside My Access.

Per-destination tracking:
- Admin can update each Telegram destination separately:
  - Pending
  - Invite Generated
  - Joined
  - Left
  - Removed
- Admin and user notifications are created when status changes.
- Ticket activity log records each destination update.

Backward compatible:
- Existing single `Telegram Group / Chat ID` still works as fallback if no Telegram Destinations are configured.

Important:
- The bot must be admin in every group/channel.
- The bot must have permission to create invite links in every destination.


## V89 update — UPI/payment loading fix

Fixed:
- My Access page payment card could keep showing `UPI ID: Loading...`.
- Access page now explicitly loads `/api/public` on page load.
- Payment card now reads UPI ID from `public.payment.upiId` first, then falls back to settings.
- Removed accidental recursive call inside payment detail rendering.
- Added backend fallback for legacy UPI setting keys.

Automation info cross-check:
- Current user details are enough for:
  - Creating access request
  - Sending email/app updates
  - Generating Telegram invite links
  - Admin manual TradingView add/remove tracking
- Fully automatic Telegram join/leave/remove tracking later will need Telegram numeric user ID captured through bot `/start` or Telegram member update webhook.
- Fully automatic TradingView add/remove is not included because TradingView invite-only access should stay manual-confirmed unless an official stable API is available.


## V90 update — Required user automation fields

Added:
- `Telegram Numeric User ID` as a required field during:
  - New user account creation
  - Create Access Request
- Field is stored on:
  - User account
  - Access ticket
  - Access request audit
- Field is shown in:
  - Admin Access Tickets
  - User My Access dashboard
  - User access request cards
  - PDF/email access request details

Why:
- Telegram username/@ID is enough for visible communication, but not enough for reliable future automation.
- Telegram numeric user ID is required later for exact user tracking/removal workflows.
- TradingView remains manual-confirmed with TradingView ID.

Current must-have user data:
- Name
- Email
- Phone / WhatsApp number
- Telegram ID / username
- Telegram Numeric User ID
- TradingView ID
- Payment ID / UTR for paid access
- Payment proof for paid access

Note:
- Full Telegram connect flow via bot `/start` can be added later to capture numeric Telegram user ID automatically.


## V91 update — Trial Feedback Popup

Changed:
- Trial feedback now appears as a popup when feedback is due.
- Popup appears after My Access tickets load.
- Popup auto-fills:
  - Trial Ticket ID
  - Email ID
- User can submit feedback directly from the popup.
- User can click "Remind me later"; popup is snoozed only for that browser session/day.
- Normal feedback form remains available on the page.

Why:
- Feedback hidden at the bottom of the page can be missed.
- Popup makes feedback visible without changing the existing backend feedback endpoint.

Behavior:
- Popup shows only for trial tickets where:
  - Access type is trial
  - Feedback is not submitted
  - Feedback due date has arrived
- After submission:
  - Popup closes
  - Feedback status updates
  - My Access reloads
  - User sees success toast


## V92 update — Trial Feedback Attachment / Profit Screenshot

Added:
- Optional attachment upload in the normal Trial Feedback form.
- Optional attachment upload in the Trial Feedback popup.
- User can upload:
  - Profit screenshot
  - Result screenshot
  - Supporting image
  - PDF proof
- Backend stores attachment on the trial access ticket.
- Admin Access Tickets now show trial feedback details and attachment preview/download.
- User request card shows link to submitted feedback attachment.
- Admin receives notification when trial feedback is submitted.

Backend:
- `/api/user/trial-feedback` now supports multipart form submission.
- Added admin download endpoint:
  `/api/admin/access-tickets/:id/trial-feedback-attachment/download`

Unchanged:
- Feedback text and rating are still required.
- Attachment is optional.
- Feedback popup behavior remains same.


## V93 update — Multiple Telegram Bots

Requirement:
- User has 3 Telegram channels/groups with 3 different bots.

Added:
- Telegram Destinations now supports per-destination bot token.

New format:
`Display Name | Chat ID or @channelusername | Bot Token | enabled`

Example:
`WhaleX Main Group | -1001234567890 | 123456789:AAA_MAIN_BOT_TOKEN | enabled`
`WhaleX VIP Channel | -1009876543210 | 987654321:BBB_VIP_BOT_TOKEN | enabled`
`WhaleX OrderFlow Group | @whalex_orderflow | 555555555:CCC_OF_BOT_TOKEN | enabled`

Backward compatible:
- Old format still works if all destinations use the same global bot:
  `Display Name | Chat ID | enabled`
- In that case, the global Telegram Bot Token field is used as fallback.

Important:
- Each bot must be admin in its respective group/channel.
- Each bot must have permission to create invite links.
- The backend masks bot tokens in admin-generated destination rows.


## V94 update — Auto Telegram Invites on Approval

Requirement:
- Telegram invite link should be there automatically on approval.
- Telegram destination status should default to Invite Generated after approval.
- Manual Generate button should only be a retry/regenerate option.

Changed:
- When Admin changes an access ticket to `Done`, backend now automatically tries to generate Telegram invite links.
- Generated links are saved to the ticket before user access activation notification/PDF is sent.
- User access activation details now include Telegram invite links if generation succeeds.
- Telegram status defaults to `Invite Generated` after successful auto-generation.
- Manual button text changed:
  - No links yet: `Generate Invites Now`
  - Links already exist: `Regenerate / Retry Invites`
- Manual route supports regeneration by clearing old invite links and creating new ones.

Safety:
- Approval is not blocked if Telegram is disabled or misconfigured.
- If Telegram auto-generation fails, access approval still succeeds and the failure is recorded in the access activity log.


## V95 update — Rejection email says Access Not Granted

Requirement:
- When admin rejects a ticket, the email header should also say the same: access not granted.

Changed user-facing rejection copy:
- Email subject/title:
  `WhaleX access not granted`
- Email intro:
  `Your WhaleX access was not granted...`
- PDF title:
  `WhaleX Access Not Granted Details`
- PDF/email footer:
  `PDF copy of your access not granted details is attached.`

Unchanged:
- Internal backend notification type remains `access_rejected`.
- Admin ticket status still remains `Rejected` internally.
- User-facing wording is now softer and clearer: `Not Granted`.


## V96 update — Telegram Numeric User ID save/block fix

Fixed:
- Existing users entering `Telegram Numeric User ID` in Create Access Request were getting blocked.
- The access submit handler was overwriting newly typed values with old profile values before submit.
- Telegram Numeric User ID now gets saved back to the User profile when the access request is created.
- Ticket creation now stores the numeric ID correctly.
- Better validation message:
  `Telegram Numeric User ID should contain numbers only. Example: 123456789`

Root cause:
- Existing users created before V90 did not have `telegramNumericId` in profile.
- Frontend called `setFormValues(form, currentUser)` just before submit, which replaced typed value with empty old profile value.

Changed:
- Submit now uses `setMissingFormValues`, which only fills empty fields and never overwrites typed fields.
- Backend updates user profile from access request fields after validation.


## V97 update — Compact Optional Telegram Numeric ID

Changed:
- Telegram Numeric ID is no longer mandatory for account creation or access request.
- Removed the large user-facing explanation card.
- Replaced it with a small optional field note:
  `Optional for future auto tracking`
- Ticket creation will not be blocked if Telegram Numeric ID is blank.
- If user enters it, it is validated as numbers only and saved.
- If user leaves it blank, access request continues normally.

Reason:
- Telegram Numeric ID is useful for future exact auto-removal/tracking.
- It is not needed for the current access request + invite link flow.
- Better UX: later replace this with a proper `Connect Telegram` button.


## V98 update — Optional marks cleanup

Requirement:
- Optional fields should not show a `*`.
- Do not show a big `Optional` badge or extra explanation.
- Payment fields should follow the same rule:
  - Monthly/Paid access: Payment ID / UTR and Payment Proof are required and show `*`.
  - Trial access: payment fields are hidden/disabled and do not show `*`.

Changed:
- Telegram Numeric ID now appears as a simple optional field with no star and no badge.
- Removed bulky optional explanation from login/create account and access request form.
- Payment labels are cleaned so required marker can add `*` only when monthly access is selected.
- Required marker refresh is preserved after plan changes.


## V99 update — Remove Telegram Numeric ID from user-facing forms

Changed:
- Removed Telegram Numeric ID field completely from:
  - Login / Create Account page
  - Create Access Request form
  - User My Access cards/dashboard
- No `Optional` label, no optional badge, no helper text.
- Backend still supports `telegramNumericId` as optional for future use.

Reason:
- Telegram Numeric ID is not needed for the current access lifecycle.
- Current flow only needs Telegram ID/username and TradingView ID.
- Future exact Telegram tracking/removal should be handled through a clean `Connect Telegram` bot flow, not by asking users to paste numeric IDs manually.


## V100 update — Production Deployment Readiness

Purpose:
- Freeze V99 as the clean UI baseline.
- Prepare the project for production hosting/deployment without changing core user/admin flow.

Added:
- `/api/health` endpoint for deployment checks.
- `scripts/deployment-check.js`.
- `npm run check:deploy`.
- `npm run health`.
- `.env.example` template with placeholders only, no real secrets.
- Package version updated to `100.0.0`.

Health endpoint:
- Local:
  `http://localhost:3000/api/health`
- Production:
  `https://your-domain.com/api/health`

Deployment check:
```bash
cd ~/Downloads/whalex_v100_production_website
npm run check:deploy
```

Required `.env` copy step:
```bash
SRC=$(find ~/Downloads -maxdepth 2 -type f -name ".env" -print | while read f; do grep -q "^MONGO_URI=" "$f" && echo "$f"; done | sort -V | tail -1)
echo "Copying from: $SRC"
cp "$SRC" ~/Downloads/whalex_v100_production_website/.env
```

Then:
```bash
cd ~/Downloads/whalex_v100_production_website
npm install
npm run check:deploy
npm start
```

Important:
- Do not put real secrets inside ZIP.
- Use `.env.example` only as a template.
- Real `.env` must be copied from the last working local version or configured directly in hosting environment variables.


## V101 update — Restore Login/Create Account page

Fixed regression:
- Login page had only one broken form.
- Existing User Login was showing the wrong field/button.
- New User — Create Account form was missing.

Restored:
- Left panel: Existing User Login
  - Email ID
  - Password
  - Forgot password
  - Login button
- Right panel: New User — Create Account
  - Name
  - Email ID
  - Phone Number
  - Telegram ID
  - TradingView ID
  - Password
  - Create Account button

Still removed:
- Telegram Numeric ID remains removed from user-facing forms.
- Backend still keeps optional field for future Connect Telegram flow.

Cross-check done:
- login.html has both loginForm and registerForm.
- login endpoint fields match server: email + password.
- register endpoint fields match server.
- Telegram Numeric ID is not present in login.html.
