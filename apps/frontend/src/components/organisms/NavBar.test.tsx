import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("reveals the nav links and auth control inside the sheet when the burger is opened", async () => {
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: null,
      token: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderWithProviders(<NavBar />);
    const burger = screen.getByRole("button", { name: "Menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(burger);

    expect(burger).toHaveAttribute("aria-expanded", "true");
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    expect(within(sheet).getByRole("link", { name: "Search" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Library" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /got invited/i })).toBeInTheDocument();
  });
});
