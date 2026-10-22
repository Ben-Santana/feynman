import { checklistItems } from '../../frontend/src/rubricChecklist.js';
import { createClient } from '@supabase/supabase-js';
import { buildSignedConsent } from './consent.js';

export class AccountError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}
export const roles = ['student', 'instructor', 'admin'];
function adminCourseError(error) {
  if (error.code === '42501') return new AccountError('Admin access required.', 403);
  if (error.code === 'P0002') return new AccountError('Course not found.', 404);
  if (error.code === 'PGRST202' || error.code === '42P01') return new AccountError('Course administration is not configured. Apply the latest Supabase migrations, then retry.', 503);
  return new AccountError('Could not load courses. Please retry.', 503);
}
export function validAccountEmail(user) {
  return Boolean(user?.id && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email || ''));
}

export function createAccountService(env = process.env, clientFactory = createClient) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  function requireConfig() {
    if (!url || !key) throw new AccountError('Accounts are not configured. Contact the app administrator.', 503);
  }
  function adminClient() {
    requireConfig();
    if (!env.SUPABASE_SECRET_KEY) throw new AccountError('Account administration is not configured.', 503);
    return clientFactory(url, env.SUPABASE_SECRET_KEY, options);
  }
  return {
    async assertLearningSurvey(req, account) {
      if (account.role !== 'student') return;
      requireConfig();
      const client = clientFactory(url, key, { ...options, global: { headers: { Authorization: req.headers.authorization } } });
      const { data, error } = await client.rpc('learning_survey_status');
      if (error) throw new AccountError('Could not check the learning survey. Apply the latest database migration and retry.', 503);
      if (data && !data.submittedAt) throw new AccountError('Complete the learning survey before your next topic.', 403);
    },
    async authenticate(req, { allowPending = false } = {}) {
      requireConfig();
      const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
      if (!match) throw new AccountError('Sign in to your account.');
      const client = clientFactory(url, key, { ...options, global: { headers: { Authorization: `Bearer ${match[1]}` } } });
      const { data, error } = await client.auth.getUser(match[1]);
      if (error || !data?.user) throw new AccountError('Your login expired. Sign in again.');
      if (!validAccountEmail(data.user)) throw new AccountError('A valid email address is required.', 403);
      // The same database function protects direct REST/Storage access and
      // rejects password sessions after the setting switches to WPI SSO.
      const allowed = await client.rpc('account_signed_in');
      if (allowed.error?.code === 'PGRST202') throw new AccountError('Account setup is incomplete. Apply the account approval migration (202610160003_account_approval.sql) in Supabase, then retry.', 503);
      if (allowed.error) throw new AccountError('Could not verify the sign-in method. Contact the app administrator.', 503);
      if (allowed.data !== true) throw new AccountError('Use the enabled sign-in method with your email address.', 403);
      const [profile, assignment] = await Promise.all([
        client.from('profiles').select('*').eq('id', data.user.id).single(),
        client.from('user_roles').select('role').eq('user_id', data.user.id).single(),
      ]);
      if (profile.error || assignment.error || !roles.includes(assignment.data?.role)) throw new AccountError('Could not load your account. Please retry.', 503);
      let consentRequired = profile.data.consent_required === true;
      if (consentRequired) {
        const consent = await client.rpc('has_signed_consent');
        if (consent.error) throw new AccountError('Could not verify your consent agreement. Please retry.', 503);
        consentRequired = consent.data !== true;
      }
      if (!allowPending && consentRequired) throw new AccountError('Sign the consent agreement before continuing.', 403);
      if (!allowPending && profile.data.approved !== true) throw new AccountError('Your account is pending admin approval.', 403);
      return { ...profile.data, role: assignment.data.role, consent_required: consentRequired };
    },
    async signConsent(account, input) {
      const record = await buildSignedConsent(account, input);
      const { error } = await adminClient().from('signed_consents').insert(record);
      // An identical retry or simultaneous submission cannot replace a signature.
      if (error && error.code !== '23505') throw new AccountError('Could not save your signed agreement. Please retry.', 503);
      return { signed: true };
    },
    async downloadConsent(account, targetId = account.id) {
      if (targetId !== account.id && account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new AccountError('Choose a valid account.', 400);
      const { data, error } = await adminClient().from('signed_consents').select('pdf_base64').eq('user_id', targetId).maybeSingle();
      if (error) throw new AccountError('Could not load the signed agreement. Please retry.', 503);
      if (!data) throw new AccountError('No signed agreement is saved for this account.', 404);
      return Buffer.from(data.pdf_base64, 'base64');
    },
    async resolveAssignment(req, input) {
      requireConfig();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.assignmentSessionId || '') || typeof input.assignmentConceptId !== 'string' || input.assignmentConceptId.length > 200) throw new AccountError('Choose a valid assignment.', 400);
      const client = clientFactory(url, key, { ...options, global: { headers: { Authorization: req.headers.authorization } } });
      const { data, error } = await client.rpc('assignment_chat_configuration', { target_session: input.assignmentSessionId, target_concept: input.assignmentConceptId });
      if (error || !data?.concept) throw new AccountError('Assignment not found or enrollment required.', 403);
      const levels = ['remember', 'understand', 'apply', 'analyze'];
      if (!levels.includes(input.level) || levels.indexOf(input.level) > levels.indexOf(data.concept.target)) throw new AccountError('Choose an assigned learning level.', 400);
      return { ...input, topic: data.concept.name, learningType: data.learningType, criterion: data.concept.rubric[input.level], aspects: checklistItems(data.concept.rubric[input.level]) };
    },
    async listUsers(account, params) {
      if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      const page = Number(params.get('page') || 1);
      const search = (params.get('search') || '').trim();
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new AccountError('Enter a valid page and search.', 400);
      const { data, error } = await adminClient().rpc('admin_list_users', { actor_id: account.id, page_number: page, search_text: search });
      if (error) throw new AccountError(error.code === '42501' ? 'Admin access required.' : 'Could not load accounts.', error.code === '42501' ? 403 : 503);
      return data;
    },
    async listCourses(account, params) {
      if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      const page = Number(params.get('page') || 1);
      const search = (params.get('search') || '').trim();
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new AccountError('Enter a valid page and search.', 400);
      const { data, error } = await adminClient().rpc('admin_list_courses', { actor_id: account.id, page_number: page, search_text: search });
      if (error) throw adminCourseError(error);
      return data;
    },
    async viewCourse(account, id) {
      if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AccountError('Choose a valid course.', 400);
      const { data, error } = await adminClient().rpc('admin_view_course', { actor_id: account.id, target_course: id });
      if (error) throw adminCourseError(error);
      return data;
    },
    async approveAccount(account, id) {
      if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AccountError('Choose a valid account.', 400);
      const { data, error } = await adminClient().rpc('admin_approve_account', { actor_id: account.id, target_id: id });
      if (error) {
        const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 503;
        throw new AccountError(status === 404 ? 'Account not found.' : status === 403 ? 'Admin access required.' : 'Could not approve the account.', status);
      }
      return data;
    },
    async changeRole(account, id, role) {
      if (account.role !== 'admin') throw new AccountError('Admin access required.', 403);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !roles.includes(role)) throw new AccountError('Choose a valid account and role.', 400);
      const { data, error } = await adminClient().rpc('admin_set_role', { actor_id: account.id, target_id: id, new_role: role });
      if (error) {
        const status = error.code === '23514' ? 409 : error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 503;
        throw new AccountError(status === 409 ? 'The final admin cannot be removed.' : status === 404 ? 'Account not found.' : status === 403 ? 'Admin access required.' : 'Could not update the role.', status);
      }
      return data;
    },
  };
}
