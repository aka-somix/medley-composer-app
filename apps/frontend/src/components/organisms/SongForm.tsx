import { useState, type FormEvent } from "react";
import type { CreateSongInput, Song } from "@medleys/shared";
import { Button } from "../atoms/Button.js";
import { Input } from "../atoms/Input.js";
import { FormField } from "../molecules/FormField.js";
import { ConfirmDialog } from "../molecules/ConfirmDialog.js";
import { useCreateSong, useUpdateSong, useDeleteSong } from "../../api/hooks.js";
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
  alternateVerseChords: "",
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
    alternateVerseChords: transpose(song.alternateVerseDegrees, song.scale).join(", "),
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
  onDeleted,
}: {
  song?: Song;
  onCreated?: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const editing = Boolean(song);
  const [form, setForm] = useState<CreateSongInput>(song ? songToForm(song) : EMPTY);
  const createSong = useCreateSong();
  const updateSong = useUpdateSong(song?.id ?? "");
  const mutation = editing ? updateSong : createSong;
  const deleteSong = useDeleteSong();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    if (!song) return;
    deleteSong.mutate(song.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        onDeleted?.();
      },
    });
  };

  const set = <K extends keyof CreateSongInput>(key: K, value: CreateSongInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      ...form,
      bridgeChords: form.bridgeChords?.trim() ? form.bridgeChords : null,
      alternateVerseChords: form.alternateVerseChords?.trim() ? form.alternateVerseChords : null,
    };
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
      <FormField label="Alt Verse chords (optional)" htmlFor="altVerse">
        <Input
          id="altVerse"
          value={form.alternateVerseChords ?? ""}
          onChange={(e) => set("alternateVerseChords", e.target.value)}
        />
      </FormField>

      {mutation.isError || deleteSong.isError ? (
        <p className="text-sm text-rust" role="alert">
          {((mutation.error ?? deleteSong.error) as Error).message}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-teal">{editing ? "Changes saved." : "Song added."}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {editing
            ? mutation.isPending
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Adding…"
              : "Add song"}
        </Button>
        {editing && song ? (
          <Button
            type="button"
            variant="outline"
            className="text-rust"
            aria-label={`Delete ${song.title}`}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>

      {editing && song ? (
        <ConfirmDialog
          open={confirmOpen}
          title="Delete song?"
          message={`“${song.title}” will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="primary"
          busy={deleteSong.isPending}
          onConfirm={handleDelete}
          onCancel={() => {
            setConfirmOpen(false);
            deleteSong.reset();
          }}
        />
      ) : null}
    </form>
  );
}
