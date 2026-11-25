import { z } from 'zod';

/**
 * Robust Password Policy:
 * - Minimum 10 characters
 * - At least one uppercase letter [A-Z]
 * - At least one lowercase letter [a-z]
 * - At least one digit [0-9]
 * - At least one special symbol [!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]
 */
export const passwordPolicy = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special symbol');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: passwordPolicy,
    dob: z.coerce.date({
      required_error: 'Date of birth is required',
      invalid_type_error: 'Invalid date format'
    }),
    phone: z.string().trim().optional(),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Consent to hospital telemetry monitoring is required' })
    })
  })
  .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'Password cannot be equal to your email address',
    path: ['password']
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(true)
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordPolicy
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password cannot be the same as current password',
    path: ['newPassword']
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase()
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    newPassword: passwordPolicy
  })
  .refine((data) => data.newPassword.toLowerCase() !== data.email.toLowerCase(), {
    message: 'Password cannot be equal to your email address',
    path: ['newPassword']
  });

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1, 'Invitation token is required'),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    name: z.string().trim().min(2).optional(),
    password: passwordPolicy
  })
  .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'Password cannot be equal to your email address',
    path: ['password']
  });

export default {
  passwordPolicy,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema
};
