

import * as Yup from "yup";
import { VALIDATION } from '@/constants';

// ============================================================================
// LOGIN FORM FIELD CONFIGURATION
// ============================================================================

export const LOGIN_FORM_FIELDS = [
  {
    name: "email",
    type: "email",
    label: "Email Address",
    required: true,
    placeholder: "Enter your email address",
    autoComplete: "email"
  },
  {
    name: "password",
    type: "password",
    label: "Password",
    required: true,
    placeholder: "Enter your password",
    autoComplete: "current-password"
  }
];

// ============================================================================
// LOGIN FORM VALIDATION SCHEMA
// ============================================================================

export const loginSchema = Yup.object().shape({
  email: Yup.string()
    .required(VALIDATION.MESSAGES.REQUIRED)
    .email(VALIDATION.MESSAGES.INVALID_EMAIL),

  password: Yup.string()
    .required(VALIDATION.MESSAGES.REQUIRED)
    .min(6, VALIDATION.MESSAGES.MIN_LENGTH(6)),
});
