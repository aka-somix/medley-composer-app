import type { RequestHandler } from "express";
import { OAuth2Client } from "google-auth-library";
import type { InviteRepository } from "../repositories/invite.repository.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { email: string };
    }
  }
}

/** Verifies a Google ID token and returns the fields we rely on. Throws on any invalid/expired token. */
export interface TokenVerifier {
  verify(idToken: string): Promise<{ email: string; email_verified: boolean }>;
}

/** Production verifier: validates signature, expiry, issuer, and audience via Google. */
export class GoogleTokenVerifier implements TokenVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<{ email: string; email_verified: boolean }> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("token has no email");
    return { email: payload.email, email_verified: payload.email_verified === true };
  }
}

/** Guard for write routes: require a valid Google token whose email is invited. */
export function requireInvited(deps: {
  verifier: TokenVerifier;
  invites: InviteRepository;
}): RequestHandler {
  return (req, res, next) => {
    return (async () => {
      const header = req.headers.authorization ?? "";
      const [scheme, token] = header.split(" ");
      if (scheme !== "Bearer" || !token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      let payload: { email: string; email_verified: boolean };
      try {
        payload = await deps.verifier.verify(token);
      } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      if (!payload.email_verified) {
        res.status(401).json({ error: "Not invited" });
        return;
      }
      let isInvited: boolean;
      try {
        isInvited = await deps.invites.isInvited(payload.email);
      } catch (err) {
        next(err);
        return;
      }
      if (!isInvited) {
        res.status(401).json({ error: "Not invited" });
        return;
      }
      req.user = { email: payload.email.toLowerCase() };
      next();
    })();
  };
}
