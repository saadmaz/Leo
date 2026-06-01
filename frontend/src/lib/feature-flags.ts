// Client-safe feature flag defaults.
// Set NEXT_PUBLIC_EMPLOYEE_ADVOCACY_ENABLED=true in .env.local to enable the
// Employee Advocacy feature for local development / testing.
// In production the flag is controlled via the admin panel (/admin/feature-flags)
// and the default here acts as a safe fallback.

export const FEATURE_FLAGS = {
  employee_advocacy_enabled:
    process.env.NEXT_PUBLIC_EMPLOYEE_ADVOCACY_ENABLED === 'true',
} as const

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}
