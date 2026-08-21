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
          <span className="font-display text-xl text-wax">Medleys</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            Search
          </NavLink>
          <NavLink to="/songs" className={linkClass}>
            Library
          </NavLink>
          {user ? (
            <div className="flex items-center gap-2 pl-2">
              <span className="text-sm text-sepia">{user.email}</span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-sepia transition-colors hover:bg-parchment"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signIn}
              aria-label="Got invited? Sign in"
              className="group relative rounded-full bg-rust px-4 py-1.5 text-sm font-semibold text-cream transition-colors hover:bg-wax"
            >
              <span className="group-hover:hidden">Got invited?</span>
              <span className="hidden group-hover:inline">Sign in</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
