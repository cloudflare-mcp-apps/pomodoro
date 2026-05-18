/**
 * Authentication Utilities for MCP Server
 *
 * User lookup functions for D1 database.
 */

/**
 * Query user from database by WorkOS user ID (JWT sub claim)
 */
export async function getUserByWorkosId(
  db: D1Database,
  workosUserId: string
): Promise<{ user_id: string; email: string; is_deleted: number } | null> {
  try {
    const result = await db
      .prepare('SELECT user_id, email, is_deleted FROM users WHERE workos_user_id = ? AND is_deleted = 0')
      .bind(workosUserId)
      .first<{ user_id: string; email: string; is_deleted: number }>();
    return result || null;
  } catch (error) {
    console.error('[Auth] Error querying user by workos_user_id:', error);
    return null;
  }
}
