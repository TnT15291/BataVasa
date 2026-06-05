jest.mock('../services/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { localizeAuthError } from '../services/authErrors'
import type { Translations } from '../services/i18n'

const t = {
  auth_error_rate_limit: 'Too many requests',
  auth_error_invalid_credentials: 'Invalid email or password',
  auth_error_email_not_confirmed: 'Please confirm your email',
  auth_error_email_exists: 'Email already registered',
  auth_error_weak_password: 'Password too weak',
  auth_error_same_password: 'Choose a different password',
  auth_error_invalid_email: 'Invalid email address',
  auth_error_generic: 'Something went wrong',
} as unknown as Translations

describe('localizeAuthError', () => {
  describe('rate limit', () => {
    it('maps over_email_send_rate_limit code', () => {
      expect(localizeAuthError({ code: 'over_email_send_rate_limit' }, t)).toBe(t.auth_error_rate_limit)
    })
    it('maps over_request_rate_limit code', () => {
      expect(localizeAuthError({ code: 'over_request_rate_limit' }, t)).toBe(t.auth_error_rate_limit)
    })
    it('maps over_sms_send_rate_limit code', () => {
      expect(localizeAuthError({ code: 'over_sms_send_rate_limit' }, t)).toBe(t.auth_error_rate_limit)
    })
    it('maps message containing rate limit', () => {
      expect(localizeAuthError({ message: 'Too many requests — rate limit exceeded' }, t)).toBe(t.auth_error_rate_limit)
    })
    it('maps message containing too many requests', () => {
      expect(localizeAuthError({ message: 'too many requests' }, t)).toBe(t.auth_error_rate_limit)
    })
  })

  describe('invalid credentials', () => {
    it('maps invalid_credentials code', () => {
      expect(localizeAuthError({ code: 'invalid_credentials' }, t)).toBe(t.auth_error_invalid_credentials)
    })
    it('maps invalid_login_credentials code', () => {
      expect(localizeAuthError({ code: 'invalid_login_credentials' }, t)).toBe(t.auth_error_invalid_credentials)
    })
    it('maps message containing invalid login credentials', () => {
      expect(localizeAuthError({ message: 'Invalid login credentials' }, t)).toBe(t.auth_error_invalid_credentials)
    })
  })

  describe('email not confirmed', () => {
    it('maps email_not_confirmed code', () => {
      expect(localizeAuthError({ code: 'email_not_confirmed' }, t)).toBe(t.auth_error_email_not_confirmed)
    })
    it('maps message containing email not confirmed', () => {
      expect(localizeAuthError({ message: 'email not confirmed' }, t)).toBe(t.auth_error_email_not_confirmed)
    })
  })

  describe('email exists', () => {
    it('maps user_already_exists code', () => {
      expect(localizeAuthError({ code: 'user_already_exists' }, t)).toBe(t.auth_error_email_exists)
    })
    it('maps email_exists code', () => {
      expect(localizeAuthError({ code: 'email_exists' }, t)).toBe(t.auth_error_email_exists)
    })
    it('maps message containing already registered', () => {
      expect(localizeAuthError({ message: 'User already registered' }, t)).toBe(t.auth_error_email_exists)
    })
    it('maps message containing already been registered', () => {
      expect(localizeAuthError({ message: 'has already been registered' }, t)).toBe(t.auth_error_email_exists)
    })
  })

  describe('weak password', () => {
    it('maps weak_password code', () => {
      expect(localizeAuthError({ code: 'weak_password' }, t)).toBe(t.auth_error_weak_password)
    })
    it('maps message containing password should be', () => {
      expect(localizeAuthError({ message: 'Password should be at least 8 characters' }, t)).toBe(t.auth_error_weak_password)
    })
    it('maps message containing weak password', () => {
      expect(localizeAuthError({ message: 'weak password detected' }, t)).toBe(t.auth_error_weak_password)
    })
  })

  describe('same password', () => {
    it('maps same_password code', () => {
      expect(localizeAuthError({ code: 'same_password' }, t)).toBe(t.auth_error_same_password)
    })
    it('maps message containing different from the old password', () => {
      expect(localizeAuthError({ message: 'New password should be different from the old password' }, t)).toBe(t.auth_error_same_password)
    })
  })

  describe('invalid email', () => {
    it('maps validation_failed code', () => {
      expect(localizeAuthError({ code: 'validation_failed' }, t)).toBe(t.auth_error_invalid_email)
    })
    it('maps message containing unable to validate email', () => {
      expect(localizeAuthError({ message: 'Unable to validate email address' }, t)).toBe(t.auth_error_invalid_email)
    })
    it('maps message containing invalid email', () => {
      expect(localizeAuthError({ message: 'invalid email format' }, t)).toBe(t.auth_error_invalid_email)
    })
  })

  describe('generic fallback', () => {
    it('returns generic for unknown code', () => {
      expect(localizeAuthError({ code: 'some_unknown_code', message: 'unexpected' }, t)).toBe(t.auth_error_generic)
    })
    it('returns generic for empty error', () => {
      expect(localizeAuthError({}, t)).toBe(t.auth_error_generic)
    })
  })
})
