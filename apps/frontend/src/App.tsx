import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/organisms/NavBar.js";
import { SearchPage } from "./pages/SearchPage.js";
import { SongsPage } from "./pages/SongsPage.js";
import { ChainPage } from "./pages/ChainPage.js";

export function App() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/songs" element={<SongsPage />} />
          <Route path="/chain/:songId" element={<ChainPage />} />
        </Routes>
      </main>
    </div>
  );
}
