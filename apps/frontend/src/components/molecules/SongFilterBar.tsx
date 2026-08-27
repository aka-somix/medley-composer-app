import { FormField } from "./FormField.js";
import { Input } from "../atoms/Input.js";
import { Select } from "../atoms/Select.js";
import { Button } from "../atoms/Button.js";

interface SongFilterBarProps {
  q: string;
  artist: string;
  language: string;
  artists: string[];
  languages: string[];
  onChange: (next: { q: string; artist: string; language: string }) => void;
}

export function SongFilterBar({ q, artist, language, artists, languages, onChange }: SongFilterBarProps) {
  const hasFilters = q !== "" || artist !== "" || language !== "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="sm:flex-1 sm:min-w-[12rem]">
        <FormField label="Search" htmlFor="song-filter-q">
          <Input
            id="song-filter-q"
            type="search"
            placeholder="Title or artist…"
            value={q}
            onChange={(e) => onChange({ q: e.target.value, artist, language })}
          />
        </FormField>
      </div>

      <FormField label="Artist" htmlFor="song-filter-artist">
        <Select
          id="song-filter-artist"
          value={artist}
          onChange={(e) => onChange({ q, artist: e.target.value, language })}
        >
          <option value="">All</option>
          {artists.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Language" htmlFor="song-filter-language">
        <Select
          id="song-filter-language"
          value={language}
          onChange={(e) => onChange({ q, artist, language: e.target.value })}
        >
          <option value="">All</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </FormField>

      {hasFilters ? (
        <Button type="button" variant="ghost" onClick={() => onChange({ q: "", artist: "", language: "" })}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
