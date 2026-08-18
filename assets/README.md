# Assets

## `example-songs-import.json`

A working sample for the **Import JSON** button on the Library page
(`/songs` → "Add a song" panel).

The file is a JSON **array** of song objects. Each object uses the same shape as
the add-song form — chords are raw, comma-separated symbols **in the song's own
scale**; the backend translates them to scale-degree tokens on import.

| Field                  | Required | Notes                                            |
| ---------------------- | -------- | ------------------------------------------------ |
| `title`                | yes      | Non-empty                                        |
| `artist`               | yes      | Non-empty                                        |
| `bpm`                  | yes      | Positive integer (≤ 400)                         |
| `scale`                | yes      | Major-key root, e.g. `C`, `G`, `F#`              |
| `language`             | yes      | Free text, e.g. `English`                        |
| `verseChords`          | yes      | Comma-separated, e.g. `C, G, Am, F`              |
| `chorusChords`         | yes      | Comma-separated                                  |
| `bridgeChords`         | no       | Omit or `null` if absent                         |
| `alternateVerseChords` | no       | Omit or `null` if absent                         |

Import is **best-effort**: every valid row is added, and any invalid row is
skipped and reported by its position in the array (row 1 = first object).
