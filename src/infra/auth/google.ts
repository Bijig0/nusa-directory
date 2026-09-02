import { Google, generateState, generateCodeVerifier, decodeIdToken } from 'arctic';

export interface GoogleClaims {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export const googleClient = (clientId: string, clientSecret: string, redirectUri: string) => new Google(clientId, clientSecret, redirectUri);

export const googleAuthUrl = (client: Google): { url: URL; state: string; verifier: string } => {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = client.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']);
  return { url, state, verifier };
};

export const googleExchange = async (client: Google, code: string, verifier: string): Promise<GoogleClaims> => {
  const tokens = await client.validateAuthorizationCode(code, verifier);
  const claims = decodeIdToken(tokens.idToken()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  return { sub: claims.sub, email: claims.email, emailVerified: Boolean(claims.email_verified), name: claims.name };
};
