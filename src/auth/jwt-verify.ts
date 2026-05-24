/**
 * JWT Verification via WorkOS AuthKit JWKS
 *
 * Verifies access tokens issued by AuthKit using the public JWKS endpoint.
 * The JWKS is lazily initialized and cached by jose across requests in the same isolate.
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { logger } from '../shared/logger';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(authkitDomain: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${authkitDomain}/oauth2/jwks`));
  }
  return jwks;
}

export interface JwtVerifyResult {
  workosUserId: string;
}

export async function verifyJwt(
  token: string,
  authkitDomain: string
): Promise<JwtVerifyResult | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(authkitDomain), {
      issuer: `https://${authkitDomain}`,
    });
    if (!payload.sub) {
      logger.warn({ event: 'auth_attempt', method: 'oauth', success: false, reason: 'missing_sub_claim' });
      return null;
    }
    return { workosUserId: payload.sub };
  } catch (error) {
    const reason = error instanceof Error ? (error as { code?: string }).code ?? error.message : String(error);
    logger.warn({ event: 'auth_attempt', method: 'oauth', success: false, reason });
    return null;
  }
}
