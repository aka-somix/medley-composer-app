import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { requireInvited, type TokenVerifier } from "./require-invited.js";
import type { InviteRepository } from "../repositories/invite.repository.js";

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const invited: InviteRepository = {
  isInvited: async (email) => email.toLowerCase() === "friend@gmail.com",
};

function verifier(payload: { email: string; email_verified: boolean }): TokenVerifier {
  return { verify: vi.fn().mockResolvedValue(payload) };
}

function throwingVerifier(): TokenVerifier {
  return { verify: vi.fn().mockRejectedValue(new Error("bad token")) };
}

describe("requireInvited", () => {
  it("401s when the Authorization header is missing", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the header is not a Bearer token", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: { authorization: "Basic abc" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the verifier rejects the token", async () => {
    const mw = requireInvited({ verifier: throwingVerifier(), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the email is not verified", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: false }), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the email is verified but not invited", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "stranger@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets req.user for an invited, verified email", async () => {
    const mw = requireInvited({ verifier: verifier({ email: "friend@gmail.com", email_verified: true }), invites: invited });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ email: "friend@gmail.com" });
  });

  it("lowercases a mixed-case invited, verified email before comparing/storing", async () => {
    const mw = requireInvited({
      verifier: verifier({ email: "Friend@Gmail.com", email_verified: true }),
      invites: invited,
    });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ email: "friend@gmail.com" });
  });

  it("routes an unexpected invite-repository error to next(err) instead of 401ing", async () => {
    const dbError = new Error("DB unavailable");
    const failingInvites: InviteRepository = {
      isInvited: async () => {
        throw dbError;
      },
    };
    const mw = requireInvited({
      verifier: verifier({ email: "friend@gmail.com", email_verified: true }),
      invites: failingInvites,
    });
    const req = { headers: { authorization: "Bearer x" } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
