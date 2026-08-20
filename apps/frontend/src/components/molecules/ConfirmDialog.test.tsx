import { afterEach, describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { renderWithProviders } from "../../test/utils.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const base = {
  title: "Delete song?",
  message: "This cannot be undone.",
  onConfirm: () => {},
  onCancel: () => {},
};

describe("ConfirmDialog", () => {
  it("shows the title and message when open", () => {
    renderWithProviders(<ConfirmDialog {...base} open />);
    expect(screen.getByRole("heading", { name: /delete song\?/i })).toBeInTheDocument();
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument();
  });

  it("does not render its content when closed", () => {
    renderWithProviders(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByText(/this cannot be undone/i)).not.toBeInTheDocument();
  });

  it("fires onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog {...base} open onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog {...base} open onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while busy", () => {
    renderWithProviders(<ConfirmDialog {...base} open busy />);
    expect(screen.getByRole("button", { name: /working/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
  });
});
