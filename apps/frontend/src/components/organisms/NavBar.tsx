import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { useAuth } from "../../api/useAuth.js";
import { Sheet } from "../molecules/Sheet.js";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-11 items-center rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
    isActive ? "bg-rust text-cream" : "text-sepia hover:bg-parchment",
  );

const authClass =
  "inline-flex min-h-11 items-center rounded-full px-4 py-1.5 text-sm font-semibold transition-colors";

export function NavBar() {
  const { user, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = (
    <>
      <NavLink to="/" className={linkClass} end onClick={() => setMenuOpen(false)}>
        Search
      </NavLink>
      <NavLink to="/songs" className={linkClass} onClick={() => setMenuOpen(false)}>
        Library
      </NavLink>
    </>
  );

  const authControl = user ? (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        signOut();
      }}
      className={cn(authClass, "text-sepia hover:bg-parchment")}
    >
      Sign out
    </button>
  ) : (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        signIn();
      }}
      className={cn(authClass, "ml-3 bg-wax text-cream hover:bg-rust")}
    >
      Got invited? Sign in
    </button>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-dust bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex min-h-11 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-wax bg-grooves text-cream">◉</span>
          <span className="font-display text-xl text-wax">Tiny Medleys</span>
        </NavLink>
        <nav className="hidden items-center gap-1 sm:flex">
          {links}
          {authControl}
        </nav>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="nav-sheet"
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-full text-2xl text-sepia transition-colors hover:bg-parchment sm:hidden"
        >
          ☰
        </button>
      </div>
      <Sheet id="nav-sheet" open={menuOpen} onClose={() => setMenuOpen(false)} label="Menu">
        <nav className="flex flex-col items-start gap-2">
          {links}
          {authControl}
        </nav>
      </Sheet>
    </header>
  );
}
