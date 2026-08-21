import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { invitedEmails } from "../db/schema.js";
import type { InviteRepository } from "./invite.repository.js";

export class DrizzleInviteRepository implements InviteRepository {
  constructor(private readonly db: Db) {}

  async isInvited(email: string): Promise<boolean> {
    const row = await this.db
      .select({ email: invitedEmails.email })
      .from(invitedEmails)
      .where(eq(invitedEmails.email, email.toLowerCase()))
      .get();
    return row !== undefined;
  }
}
