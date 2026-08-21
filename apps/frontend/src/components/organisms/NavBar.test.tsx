import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/utils.js";
import { NavBar } from "./NavBar.js";
import * as auth from "../../api/useAuth.js";

describe("NavBar", () => {
  it("shows a 'Got invited?' sign-in control when signed out", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: null,
      token: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderWithProviders(<NavBar />);
    expect(screen.getByRole("button", { name: /got invited/i })).toBeInTheDocument();
  });

  it("shows only a sign-out control (no email) when signed in", () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { email: "friend@gmail.com" },
      token: "t",
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderWithProviders(<NavBar />);
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByText("friend@gmail.com")).not.toBeInTheDocument();
  });
});
