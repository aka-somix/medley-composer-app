import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { useAuth } from "../../api/useAuth.js";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
    isActive ? "bg-rust text-cream" : "text-sepia hover:bg-parchment",
  );

export function NavBar() {
  const { user, signIn, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-10 border-b border-dust bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-wax bg-grooves text-cream">◉</span>
          <span className="font-display text-xl text-wax">Tiny Medleys</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            Search
          </NavLink>
          <NavLink to="/songs" className={linkClass}>
            Library
          </NavLink>
          {user ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-sepia transition-colors hover:bg-parchment"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={signIn}
              aria-label="Got invited? Sign in"
              className="group ml-3 grid rounded-full bg-wax px-4 py-1.5 text-sm font-semibold text-cream transition-colors hover:bg-rust"
            >
              <span className="col-start-1 row-start-1 group-hover:invisible">Got invited?</span>
              <span className="col-start-1 row-start-1 invisible group-hover:visible">Sign in</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
