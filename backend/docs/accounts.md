# Accounts

Feynman uses Supabase Auth, Postgres, and private Storage. Instructors can create
an account with an email address and app password. New email accounts require
admin approval. New WPI Microsoft Entra accounts start as students and are
approved automatically. Both paths require the signed consent agreement.

## Configure email sign-in

1. Configure `frontend/.env` and `backend/.env` using their example files. Keep
   `SUPABASE_SECRET_KEY` on the backend only.
2. Apply all migrations in order, including `202611030003_wpi_auto_approval.sql`
   through `202611050003_approve_linked_wpi_accounts.sql`. Apply only missing migrations on an
   existing project.
3. In Supabase Authentication, enable the Email provider and new signups, turn
   **Confirm email** off, and set minimum password length to **12**. Keep
   anonymous sign-ins, manual identity linking, and unsupported providers disabled.
   Retain the Before User Created Postgres hook `public.before_wpi_user_created`.
4. Configure custom SMTP for password resets. Set the Auth Site URL to the
   frontend origin and allow `/account/callback` and `/account/reset-password`
   for each deployed origin and localhost (`http://localhost:5173`). Reset links
   use PKCE and must be opened in the browser that requested them.
5. Set frontend and backend variables in Vercel when deployed. Rebuild after
   changing `VITE_` values. Set `APP_ORIGIN` for a custom domain.

New instructor accounts appear in **Manage accounts** for approval. The pending
screen checks approval every 15 seconds while visible and when the window regains
focus. Keep the database setting at `email` while WPI SSO is being configured.
Email-only mode also supports existing student password accounts.

## Enable both sign-in options

1. Obtain WPI's Entra tenant ID and an app registration, arranging WPI IT approval
   or admin consent if required. Register
   `https://<project-ref>.supabase.co/auth/v1/callback` as a Web redirect URI.
   Restrict the registration to WPI organizational accounts.
2. In Supabase's Azure provider, configure the app client ID, client secret, and
   `https://login.microsoftonline.com/<WPI-tenant-id>` as the tenant URL. Configure
   the `email` and `xms_edov` optional claims per
   [Supabase's Azure guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-azure).
   Confirm with WPI IT that the application is covered by their MFA policy.
   The app does not assert Supabase `aal2` for WPI's external MFA.
3. Verify an existing WPI student account can sign in through Azure with the same
   WPI email and UUID. Resolve alias differences before switching modes.
   Supabase can automatically link matching verified email identities.
   [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
4. Enable the Email provider and apply `202611050002_dual_sign_in.sql`. The
   migration switches existing WPI-only projects to combined mode. If the
   migration is already applied or the project is in email-only mode, set the
   shared mode in the SQL editor.

   ```sql
   update public.account_auth_settings set mode = 'both' where singleton;
   ```

   After reload, the login screen offers **Sign in with WPI SSO** and **Sign in
   with email**. The API, database, and Storage require students to use a verified
   WPI OAuth session. Email-origin instructors and admins can use app passwords.
   WPI SSO accounts are approved automatically, including existing accounts that
   link WPI SSO. Existing roles and learning data are retained. Existing
   password students need a matching WPI identity to keep using their account
   in this mode.
5. Test both paths, including consent, instructor approval, password reset,
   logout, WPI MFA, and rejection of non-WPI accounts.

Set the same database setting to `email` to return to email-only mode, or
`wpi` to require WPI SSO for every account.

## Bootstrap the first admin

Create your account through email or WPI SSO. In the Supabase SQL editor, run
this with your account’s exact email.

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

Run `npm test`, `npm run build`, and `npm run lint`. The tests execute the account
migrations in PGlite's PostgreSQL engine with fixtures for Supabase's platform
auth/storage schemas, and exercise cloud saving with the actual Supabase client
against a simulated REST/Storage service. No production account is created.

Before launch, additionally verify against your configured Supabase project:

- Instructor signup from WPI and other email domains, pending approval, admin
  approval, password login/reset, and logout. Verify student password sessions
  lose access in combined mode.
- WPI Azure login and callback, automatic approval for a new WPI account, MFA
  behavior, logout, and rejected foreign tenants, personal Microsoft accounts,
  non-WPI domains, and alternate login providers.
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
per account makes retries safe. Signed consents are retained after account
deletion as standalone records with no link to a live account.

Admins delete accounts from Manage accounts. `admin_delete_account` removes the
login, profile, chats, survey, scores, reports, enrollments, points, purchases,
customizations, usage events, and role history in one transaction, after the
backend removes the account's attachments and banners from Storage. Admins cannot
delete themselves, and accounts that own courses cannot be deleted, so enrolled
students keep their work. Chats remain undeletable otherwise.

Participants can download their copy after signing, while awaiting approval, or
from Profile. Approved admins can download copies from Manage accounts. The
authenticated download API checks the owner/admin and never returns a public URL.
The source agreement is versioned in `backend/assets` and `frontend/public/consent`;
keep these identical. The PDF preserves both original pages, fills the participant
fields, and appends an electronic signature record. The study-explainer signature
remains blank. A changed agreement needs a new version and an explicit migration
policy; this flow does not automatically re-consent existing participants.

## Admin courses

With `202611050001_admin_course_ownership.sql` applied, approved admins can
create and teach courses under **Courses**. Course editing and
enrollment management use the same ownership checks as for instructors.

**Administration → All courses** at `/admin/all-courses` is the read-only
directory. Admins can search by course name, code, or instructor and preview
draft and published topics, including learning type, concepts, target levels,
and rubrics. Student sessions and source attachments stay private. The backend
uses `SUPABASE_SECRET_KEY` to call service-only RPCs that recheck the actor's
approved admin role.
