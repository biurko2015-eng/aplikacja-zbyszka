// ─── Super Admin Configuration ───────────────────────────────────────────────
// Single source of truth for Super Admin emails.
// Super Admins are hardcoded and cannot be changed via the UI.
// They have all Administrator privileges PLUS the ability to manage Administrators.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_EMAILS = [
    'zbigniew.twardowski@b2bnetwork.pl',
    'igor.twardowski@b2bnetwork.pl',
] as const

/**
 * Check if an email belongs to a Super Admin.
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
    if (!email) return false
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase() as typeof SUPER_ADMIN_EMAILS[number])
}
