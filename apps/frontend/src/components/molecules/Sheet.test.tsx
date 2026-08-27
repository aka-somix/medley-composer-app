import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sheet } from "./Sheet.js";

describe("Sheet", () => {
  it("renders children only while open", () => {
    const { rerender } = render(
      <Sheet open={false} onClose={vi.fn()} label="Menu">
        <p>panel body</p>
      </Sheet>,
    );
    expect(screen.queryByText("panel body")).not.toBeInTheDocument();

    rerender(
      <Sheet open onClose={vi.fn()} label="Menu">
        <p>panel body</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByText("panel body")).toBeInTheDocument();
  });

  it("wires onClose to the dialog's native close event (Esc / backdrop dismissal)", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} label="Menu">
        <p>panel body</p>
      </Sheet>,
    );
    // jsdom does not implement Esc-to-close for <dialog>; fire the event the
    // browser would dispatch instead.
    fireEvent(screen.getByRole("dialog", { name: "Menu" }), new Event("close"));
    expect(onClose).toHaveBeenCalled();
  });
});
