/**
 * Persistence boundary for the invite allow-list. The auth middleware depends
 * on this interface only, so the check can be faked in tests.
 */
export interface InviteRepository {
  /** True when `email` (compared lowercased) has been invited. */
  isInvited(email: string): Promise<boolean>;
}
