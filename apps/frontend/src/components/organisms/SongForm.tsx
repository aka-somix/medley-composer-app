import { useState, type FormEvent } from "react";
import type { CreateSongInput, Song } from "@medleys/shared";
import { Button } from "../atoms/Button.js";
import { Input } from "../atoms/Input.js";
import { FormField } from "../molecules/FormField.js";
import { useCreateSong, useUpdateSong } from "../../api/hooks.js";
import { transpose } from "../../lib/scales.js";

const EMPTY: CreateSongInput = {
  title: "",
  artist: "",
  bpm: 120,
  scale: "C",
  language: "English",
  verseChords: "",
  chorusChords: "",
  bridgeChords: "",
};

/** Turn a stored song into editable form values (degrees → chords in its own scale). */
function songToForm(song: Song): CreateSongInput {
  return {
    title: song.title,
    artist: song.artist,
    bpm: song.bpm,
    scale: song.scale,
    language: song.language,
    verseChords: transpose(song.verseDegrees, song.scale).join(", "),
    chorusChords: transpose(song.chorusDegrees, song.scale).join(", "),
    bridgeChords: transpose(song.bridgeDegrees, song.scale).join(", "),
  };
}

/**
 * Create or edit a song. With no `song` it creates; with a `song` it pre-fills
 * from that song and saves changes via PUT. Remount (via `key`) to switch songs.
 */
export function SongForm({
  song,
  onCreated,
  onSaved,
}: {
  song?: Song;
  onCreated?: () => void;
  onSaved?: () => void;
}) {
  const editing = Boolean(song);
  const [form, setForm] = useState<CreateSongInput>(song ? songToForm(song) : EMPTY);
  const createSong = useCreateSong();
  const updateSong = useUpdateSong(song?.id ?? "");
  const mutation = editing ? updateSong : createSong;

  const set = <K extends keyof CreateSongInput>(key: K, value: CreateSongInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, bridgeChords: form.bridgeChords?.trim() ? form.bridgeChords : null };
    mutation.mutate(body, {
      onSuccess: () => {
        if (editing) {
          onSaved?.();
        } else {
          setForm(EMPTY);
          onCreated?.();
        }
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      aria-label={editing ? "Edit song" : "Add song"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Title" htmlFor="title">
          <Input id="title" required value={form.title} onChange={(e) => set("title", e.target.value)} />
        </FormField>
        <FormField label="Artist" htmlFor="artist">
          <Input id="artist" required value={form.artist} onChange={(e) => set("artist", e.target.value)} />
        </FormField>
        <FormField label="BPM" htmlFor="bpm">
          <Input
            id="bpm"
            type="number"
            min={1}
            max={400}
            required
            value={form.bpm}
            onChange={(e) => set("bpm", Number(e.target.value))}
          />
        </FormField>
        <FormField label="Music scale" htmlFor="scale" hint="Major-key root, e.g. C, G, F#">
          <Input id="scale" required value={form.scale} onChange={(e) => set("scale", e.target.value)} />
        </FormField>
        <FormField label="Language" htmlFor="language">
          <Input id="language" required value={form.language} onChange={(e) => set("language", e.target.value)} />
        </FormField>
      </div>

      <FormField label="Verse chords" htmlFor="verse" hint="Comma-separated, in the song's own scale: C, G, Am, F">
        <Input id="verse" required value={form.verseChords} onChange={(e) => set("verseChords", e.target.value)} />
      </FormField>
      <FormField label="Chorus chords" htmlFor="chorus" hint="Comma-separated: F, C, G, Am">
        <Input id="chorus" required value={form.chorusChords} onChange={(e) => set("chorusChords", e.target.value)} />
      </FormField>
      <FormField label="Bridge chords (optional)" htmlFor="bridge">
        <Input
          id="bridge"
          value={form.bridgeChords ?? ""}
          onChange={(e) => set("bridgeChords", e.target.value)}
        />
      </FormField>

      {mutation.isError ? (
        <p className="text-sm text-rust" role="alert">
          {(mutation.error as Error).message}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-teal">{editing ? "Changes saved." : "Song added."}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={mutation.isPending}>
          {editing
            ? mutation.isPending
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Adding…"
              : "Add song"}
        </Button>
      </div>
    </form>
  );
}
