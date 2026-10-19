import { AccountError } from './accounts.js';

// Explicit dependency injection for API unit tests; no runtime auth bypass.
export const testAuthorization = 'Bearer test-admin';
export function testAccountService(role = 'admin') {
  return {
    async authenticate(req) {
      if (req.headers.authorization !== testAuthorization) throw new AccountError('Sign in with your WPI account.');
      return { id: '11111111-1111-4111-8111-111111111111', email: 'test@wpi.edu', display_name: 'Test', role };
    },
  };
}
