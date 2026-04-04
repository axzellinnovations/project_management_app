/**
 * Shared password validation utility for enterprise-grade password policy.
 * Policy: min 8 chars, uppercase, lowercase, digit, special character.
 */

export interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  strength: 'empty' | 'weak' | 'fair' | 'strong' | 'very-strong';
  score: number; // 0-5
  checks: PasswordChecks;
}

export function validatePassword(password: string): PasswordValidationResult {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const valid = Object.values(checks).every(Boolean);

  let strength: PasswordValidationResult['strength'] = 'empty';
  if (password.length === 0) {
    strength = 'empty';
  } else if (score <= 1) {
    strength = 'weak';
  } else if (score === 2) {
    strength = 'weak';
  } else if (score === 3) {
    strength = 'fair';
  } else if (score === 4) {
    strength = 'strong';
  } else {
    strength = 'very-strong';
  }

  return { valid, strength, score, checks };
}

export const PASSWORD_REQUIREMENTS = [
  { key: 'minLength' as keyof PasswordChecks, label: 'At least 8 characters' },
  { key: 'hasUppercase' as keyof PasswordChecks, label: 'One uppercase letter (A-Z)' },
  { key: 'hasLowercase' as keyof PasswordChecks, label: 'One lowercase letter (a-z)' },
  { key: 'hasDigit' as keyof PasswordChecks, label: 'One number (0-9)' },
  { key: 'hasSpecial' as keyof PasswordChecks, label: 'One special character (!@#$%...)' },
];
