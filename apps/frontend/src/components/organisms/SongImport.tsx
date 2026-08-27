import { useRef, useState, type ChangeEvent } from "react";
import type { CreateSongInput } from "@medleys/shared";
import { Button } from "../atoms/Button.js";
import { useImportSongs } from "../../api/hooks.js";

/** Read a File's text via FileReader (reliable across browsers and jsdom). */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}

/**
 * Bulk-add songs from an uploaded JSON file. The file must contain a JSON array
 * of song objects (raw chords in each song's own scale — the same shape the
 * add-song form submits). Rows are validated server-side; valid rows are
 * imported and skipped rows are reported per row.
 */
export function SongImport({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const importSongs = useImportSongs();

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file again still fires a change.
    e.target.value = "";
    if (!file) return;

    setParseError(null);
    importSongs.reset();

    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setParseError("Could not read that file.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setParseError("That file isn't valid JSON.");
      return;
    }
    if (!Array.isArray(parsed)) {
      setParseError("The file must contain a JSON array of songs.");
      return;
    }

    importSongs.mutate(parsed as CreateSongInput[], {
      onSuccess: () => onImported?.(),
    });
  };

  const result = importSongs.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={importSongs.isPending}
        >
          {importSongs.isPending ? "Importing…" : "Import JSON"}
        </Button>
        <span className="text-xs text-sepia/70">Bulk-add songs from a .json file</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import songs from JSON file"
          onChange={handleFile}
        />
      </div>

      {parseError ? (
        <p className="text-sm text-rust" role="alert">
          {parseError}
        </p>
      ) : null}

      {importSongs.isError ? (
        <p className="text-sm text-rust" role="alert">
          {(importSongs.error as Error).message}
        </p>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-teal">
            Imported {result.created.length}{" "}
            {result.created.length === 1 ? "song" : "songs"}
            {result.errors.length > 0
              ? `, skipped ${result.errors.length}.`
              : "."}
          </p>
          {result.errors.length > 0 ? (
            <ul className="text-sm text-rust" role="alert">
              {result.errors.map((err) => (
                <li key={err.row}>
                  Row {err.row}: {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
