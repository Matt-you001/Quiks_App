## Changes
- Update `src/lib/constants.ts:18` to include a new subject: `History` with slug `history`, icon `Landmark`, and description `Explore past events.`
- No other code changes required: subject selection (`src/app/page.tsx:16`), mode selection (`src/app/mode-select/page.tsx:13`), level selection (`src/app/level-select/page.tsx:12`), and test route (`src/app/test/[subject]/page.tsx:14`) already read from `SUBJECTS` and support dynamic slugs.

## Implementation Details
- Add entry to `SUBJECTS`:
  - `{ name: 'History', slug: 'history', icon: Landmark, description: 'Explore past events.' }`
- Reuse `Landmark` icon (already imported in `src/lib/constants.ts:1`), avoiding new dependencies.

## Verification
- Home grid shows a new History card with icon and description.
- Click History → flows through select-profile → mode-select → level-select → test page.
- Start quiz/training; question generation uses the `subject` string "History" via `src/ai/flows/generate-test-questions.ts:46` and requires no extra config.

## Rollback/Safety
- Single-line addition; easy to remove if needed. No stateful migrations or API changes.