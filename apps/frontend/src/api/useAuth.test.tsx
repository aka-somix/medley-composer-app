import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./useAuth.js";
import { setToken } from "./token-store.js";

// Minimal GIS mock: capture the callback so the test can fire a credential.
let gisCallback: (resp: { credential: string }) => void;
beforeEach(() => {
  setToken(null);
  (globalThis as unknown as { google: unknown }).google = {
    accounts: {
      id: {
        initialize: (opts: { callback: (resp: { credential: string }) => void }) => {
          gisCallback = opts.callback;
        },
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
      },
    },
  };
});
afterEach(() => vi.restoreAllMocks());

function Probe() {
  const { user, signIn } = useAuth();
  return (
    <div>
      <button onClick={signIn}>sign in</button>
      <span data-testid="email">{user?.email ?? "anon"}</span>
    </div>
  );
}

describe("useAuth", () => {
  it("starts anonymous and becomes the invited user after a Google credential", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ email: "friend@gmail.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("email")).toHaveTextContent("anon");

    await userEvent.click(screen.getByText("sign in"));
    gisCallback({ credential: "google-jwt" });

    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("friend@gmail.com"));
  });
});
