import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/utils.js";
import { SongFilterBar } from "./SongFilterBar.js";

const artists = ["Adele", "Beyoncé"];
const languages = ["English", "Italian"];

describe("SongFilterBar", () => {
  it("calls onChange with typed q, preserving artist/language", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SongFilterBar q="" artist="Adele" language="Italian" artists={artists} languages={languages} onChange={onChange} />,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "x");

    expect(onChange).toHaveBeenLastCalledWith({ q: "x", artist: "Adele", language: "Italian" });
  });

  it("calls onChange with the selected artist", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SongFilterBar q="" artist="" language="" artists={artists} languages={languages} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Artist" }), "Beyoncé");

    expect(onChange).toHaveBeenLastCalledWith({ q: "", artist: "Beyoncé", language: "" });
  });

  it("calls onChange with the selected language", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SongFilterBar q="" artist="" language="" artists={artists} languages={languages} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "English");

    expect(onChange).toHaveBeenLastCalledWith({ q: "", artist: "", language: "English" });
  });

  it("does not render Clear filters when all filters are empty", () => {
    renderWithProviders(
      <SongFilterBar q="" artist="" language="" artists={artists} languages={languages} onChange={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("clears all filters when Clear filters is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SongFilterBar q="abc" artist="Adele" language="Italian" artists={artists} languages={languages} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith({ q: "", artist: "", language: "" });
  });
});
