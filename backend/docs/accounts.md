# Accounts

Feynman uses Supabase Auth, Postgres, and private Storage. Anyone can create an
account with an email address and an app password. No invite code or email
verification is required in email mode. New accounts wait for admin approval before
accessing learning, customization, or attachments. WPI Microsoft Entra SSO remains available
for a future cutover. Existing accounts and saved learning data are preserved.

## Enable email and password sign-in

1. Configure `frontend/.env` and `backend/.env` using their example files. Keep
   `SUPABASE_SECRET_KEY` on the backend only.
2. Apply all migrations in order, applying only missing migrations on an existing
   project: `202610130001_accounts.sql`, `202610130002_email_auth.sql`,
   `202610160001_invite_signup.sql`, `202610160002_open_email_signup.sql`,
   `202610160003_account_approval.sql`, `202610160004_signup_roles.sql`,
   `202610160005_pending_account_roles.sql`, `202610170001_courses.sql`, `202610170002_course_appearance.sql`.
   Open signup removes invite admission and email confirmation checks in email
   mode. The approval migration preserves existing accounts as approved and
   defaults future accounts to pending. Signup offers Instructor or Student; the role
   migration saves that selection at account creation and never accepts Admin. Pending
   accounts can switch between Instructor and Student until an admin approves them. The old invite table stays private and unused.
3. In Supabase Authentication, enable the Email provider and new signups, turn
   **Confirm email** off, and set minimum password length to **12**. Keep
   anonymous sign-ins and unsupported providers disabled. Azure can stay disabled
   until the WPI integration is ready.
4. Retain the Before User Created Postgres hook
   `public.before_wpi_user_created`. It now allows any valid email in email mode
   and retains the WPI-only Azure path. A database trigger also enforces the
   enabled provider if the hook is disabled.
5. Keep `public.account_auth_settings.mode` set to `email` for open signup.
   Create an account with an email and password, then approve it from an existing
   admin account in **Manage accounts**. The pending screen checks approval every
   15 seconds while visible and when the window regains focus. Passwords
   are managed by Supabase Auth, separate from WPI institutional passwords.
6. Configure custom SMTP for password resets. Set the Auth Site URL to the
   frontend origin and allow `/account/callback` and `/account/reset-password`
   for each deployed origin and localhost (`http://localhost:5173`). Reset links
   use PKCE and must be opened in the browser that requested them. Retain default
   reset email templates that link through Supabase's confirmation URL.
7. Set frontend/backend variables in Vercel too when deployed. Rebuild after
   changing `VITE_` values. Set `APP_ORIGIN` for a custom domain.

No WPI IT registration is required for email signup. Email ownership is not
verified in this mode; WPI SSO still requires a verified WPI identity.

## Enable WPI SSO later, retaining account data

The login UI, backend, and all database/Storage policies use one protected
setting in `public.account_auth_settings`. Ordinary users cannot change it.

1. Obtain WPI's Entra tenant ID and an app registration, arranging WPI IT approval
   or admin consent if required. Register the Supabase callback
   `https://<project-ref>.supabase.co/auth/v1/callback` as a Web redirect URI.
   Restrict the registration to WPI organizational accounts.
2. In Supabase's Azure provider, configure the app client ID, client secret, and
   `https://login.microsoftonline.com/<WPI-tenant-id>` as the tenant URL. Configure
   the `email` and `xms_edov` optional claims as described in
   [Supabase's Azure guide](https://supabase.com/docs/guides/auth/social-login/auth-azure).
   Confirm with WPI IT that the application is covered by their MFA policy.
   The app does not assert Supabase `aal2` for WPI's external MFA.
3. Test Azure with a existing email account using the exact same WPI email.
   [Supabase automatically links matching verified email identities](https://supabase.com/docs/guides/auth/auth-identity-linking).
   Only accounts using the exact matching WPI email can carry over automatically.
   Accounts using another email cannot sign in after a WPI-only cutover.
   Confirm the Supabase user UUID is unchanged and that saved sessions,
   customization, files, and the assigned role are retained. If Azure returns
   a different alias, resolve that identity mismatch before cutover. Do not
   automatically merge different addresses or delete the existing account.
4. In the Supabase SQL editor, switch the shared setting:

   ```sql
   update public.account_auth_settings set mode = 'wpi' where singleton;
   ```

   After reload, the login screen offers **Continue with WPI**. New password
   registrations are rejected. The API, direct database access, and private
   Storage reject existing password sessions immediately, including sessions
   belonging to accounts that already have a linked Azure identity. An SSO
   session must include Supabase's signed OAuth authentication-method claim.
   Newly signed-in users keep the existing UUID and its data.
5. Disable the Email provider in Supabase, leaving only Azure enabled. Disabling
   email authentication does not delete the existing app accounts. Retain the
   signup hook. Test login/logout, MFA, existing data, and rejected non-WPI users.

To roll back before a completed cutover, enable the Email provider without email
confirmation, then set the same database setting back to `email`. No code changes
or account deletion are needed. WPI SSO remains an external integration that
requires real tenant credentials and IT consent to verify.

## Bootstrap the first admin

Create your email account (or sign in with WPI SSO after cutover)
to create its default student role. From the
Supabase SQL editor, run this with your account’s exact email:

```sql
update public.profiles set approved = true where email = 'you@example.com';
update public.user_roles
set role = 'admin'
where user_id = (
  select id from public.profiles where email = 'you@example.com'
);
```

Refresh Feynman, open the account menu, and choose **Manage accounts**. Subsequent
changes through `/admin` are audited with actor, target, previous/new roles, and
timestamp. An advisory transaction lock prevents simultaneous role changes from
demoting every admin. Direct privileged SQL administration is outside this UI
guard; use it only for initial bootstrap or deliberate recovery.

Students and instructors have the same permissions in this release. Admins can
list accounts, approve new accounts, and change roles, but cannot view others' learning sessions or
attachments. Local ChatGPT connections and developer prompts/playground/traces
are admin-only. Hosted deployments continue offering Anthropic. AI preferences
and local developer playground records are scoped to the signed-in account.

## Saving and conflicts

Sessions use one versioned JSON document per session, with private Storage
references for draft files and submitted whiteboard images. Cloud files are
downloaded into the existing runtime File/data-URL formats when sessions load.
Existing upload limits continue to apply. The storage bucket allows at most
5,000,000 bytes per object. Content hashes let repeated saves reuse identical
attachments.

Writes are debounced for typing and queued per session. Submitted turns and
navigation flush saves. Database RPCs atomically check the expected revision;
direct session writes are denied. A conflict preserves local work and offers
**Load server version** or **Save local copy**. The copy receives a new ID so the
other device's work is preserved. Deletions also check revisions.

Account-scoped IndexedDB recovery retains pending work through refreshes and
failed requests. Retry saving from the status control. Unfinished chat answers
remain drafts until the full AI turn succeeds. Customization failures preserve
a per-account recovery draft and keep the studio open. Full offline editing and
background synchronization are not included. Browser recovery can still be
removed by the browser or its user.

Storage objects are private even when a session is deleted. Currently unused
objects are retained rather than risking removal of an attachment referenced by
unsaved recovery work; periodic privileged garbage collection can be added once
a retention policy is chosen.

## Validation

Run `npm test`, `npm run build`, and `npm run lint`. The tests execute all five actual
migrations in PGlite's PostgreSQL engine with fixtures for Supabase's platform
auth/storage schemas, and exercise cloud saving with the actual Supabase client
against a simulated REST/Storage service. No production account is created.

Before launch, additionally verify against your configured Supabase project:

- Open signup from WPI and other email domains without an invite or email
  confirmation, pending approval, admin approval, password login/reset, and logout. Verify password signups and existing password sessions
  lose access after switching to SSO.
- WPI Azure login and callback, MFA behavior, logout, and rejected foreign tenants,
  personal Microsoft accounts, non-WPI domains, and alternate login providers.
- Two users cannot read each other's rows or attachments through direct API calls.
- The admin page changes roles, blocks final-admin demotion, and adds audit rows.
- Sessions, papers, progress, files, whiteboards, and blob customization restore on
  a second device; concurrent edits show a conflict instead of overwriting work.
- Losing the network preserves drafts; retry and logout/account switching do not
  expose one account's work in another account.
- The Entra client secret has an owner and a rotation process before its expiry.

## Course data permissions

Apply `202610170001_courses.sql` after the account migrations. Approved
instructors manage only their own courses and module drafts. Approved students
join courses by code; pending/rejected enrollments can see their course status
but cannot read modules or start assignments. Database RPCs enforce these rules
for direct REST callers as well as the UI. Enrollment-setting changes and joins
lock the same course row; assignment starts serialize per student and enforce a
unique student/module link.

Published modules contain only fixed assignment configuration. Assignment saves
retain the same rubric, targets, learning type, title, and course link. Assignment
chat resolves that configuration using the student's JWT and the publishable key.
Instructor progress uses `course_progress`, a restricted projection; the existing
owner-only policies for learning sessions, profiles, and Storage remain in place.
Admins do not receive an implicit course-data access exception.

Course appearance uses `202610170002_course_appearance.sql`. Only the owning
instructor can rename a course, change its cover, or upload to the private
`course-banners` bucket. Cover reads follow course visibility; anonymous users
and unrelated accounts have no access. JPG, PNG, and WebP uploads are limited to
5 MB. Referenced covers cannot be deleted or overwritten; unused uploads can be
removed by the instructor. Metadata writes compare `appearance_revision` and
preserve enrollment admission behavior.

Dashboard banners use `202610180001_dashboard_banner.sql`. Each approved account
can save its own banner separately from its avatar. The private
`dashboard-banners` bucket accepts JPG, PNG, and WebP files up to 5 MB. Only the
owner can read or upload images; referenced images cannot be deleted or
overwritten. Saves compare `dashboard_banner_revision` to prevent stale edits
from overwriting another device's changes.

## Signed research consent

Apply `202610190006_consent.sql` before deploying the consent UI. Configure the
backend `SUPABASE_SECRET_KEY` (also used for account administration). Every new
account, including SSO accounts, must review the supplied agreement and type a
signature before continuing to approval or learning. Existing accounts retain
access. Both API authorization and `account_allowed()` enforce the requirement.

Signed PDFs are stored as base64 files in the private `public.signed_consents`
table alongside the name, account email/UUID, server UTC timestamp, agreement
version, original SHA-256, signed-file SHA-256, and electronic-consent statement.
The PDF and record are inserted atomically; clients cannot insert, update, delete,
or read this table. The service role can select/insert only. One immutable record
per account makes retries safe. Account deletion requires an explicit retention
decision because the signature record intentionally restricts profile deletion.

Participants can download their copy after signing, while awaiting approval, or
from Profile. Approved admins can download copies from Manage accounts. The
authenticated download API checks the owner/admin and never returns a public URL.
The source agreement is versioned in `backend/assets` and `frontend/public/consent`;
keep these identical. The PDF preserves both original pages, fills the participant
fields, and appends an electronic signature record. The study-explainer signature
remains blank. A changed agreement needs a new version and an explicit migration
policy; this flow does not automatically re-consent existing participants.

## Admin course browser

Apply `202610180002_admin_courses.sql` after the earlier migrations. Approved admins
can open **Administration → View courses** at `/admin/courses`, search by course
name, code, or instructor, and inspect draft and published modules. Module previews
show learning type, concepts, target levels, and rubrics. These tools are read-only;
they do not expose student sessions or source attachments and do not grant course
editing permissions. The backend uses `SUPABASE_SECRET_KEY` to call service-only
RPCs that recheck the actor's approved admin role.
