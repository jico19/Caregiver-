import { z } from 'zod';

const optionalTrimmedString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

const trimName = (label, max) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

// Mirrors Pydantic rules in backend/app/schemas/caregivers.py, plus the
// signature requirement enforced in caregivers.py (_validate_signature).
export const caregiverApplicationSchema = z
  .object({
    state_id: z.coerce.number().int().min(1).max(3),
    first_name: trimName('First name', 100),
    last_name: trimName('Last name', 100),
    phone: optionalTrimmedString(20),
    address: z.string().trim().optional().or(z.literal('')),
    date_of_birth: z.string().optional().or(z.literal('')),
    ssn_last4: z
      .string()
      .regex(/^\d{4}$/, 'SSN last 4 must be exactly 4 digits.')
      .optional()
      .or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address.')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(6, 'Portal password must be at least 6 characters.')
      .max(128)
      .optional()
      .or(z.literal('')),
    confirmPassword: z.string().optional().or(z.literal('')),
    signature_data: z
      .string({ required_error: 'Please draw your signature.' })
      .min(1, 'Please draw your signature.')
      .refine((v) => v.startsWith('data:image/'), 'Signature must be a drawn image.'),
    signed_name: trimName('Full legal name', 200),
  })
  .superRefine((values, ctx) => {
    if (values.password && values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export const applicationDefaultValues = {
  state_id: 1,
  first_name: '',
  last_name: '',
  phone: '',
  address: '',
  date_of_birth: '',
  ssn_last4: '',
  notes: '',
  email: '',
  password: '',
  confirmPassword: '',
  signature_data: '',
  signed_name: '',
};

export function toApplicationPayload(values, { includeAuth }) {
  const payload = {
    state_id: Number(values.state_id),
    first_name: values.first_name,
    last_name: values.last_name,
    phone: values.phone || null,
    address: values.address || null,
    date_of_birth: values.date_of_birth || null,
    ssn_last4: values.ssn_last4 || null,
    notes: values.notes || null,
    signature_data: values.signature_data,
    signed_name: values.signed_name,
  };
  if (includeAuth) {
    payload.email = values.email;
    payload.password = values.password;
  }
  return payload;
}