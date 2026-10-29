# Review checklist

Check every item on stills from `node scripts/still.mjs --sheet …` before rendering the full video. Then check it again on the rendered MP4 with sound.

## Picture

- **Screens match the product.** Each mockup shows the real layout, labels, components and copy, compared side by side with its source file or screenshot.
- **The look is the design system's.** The cards, type, corners and backdrop sit beside the design system's own pages without looking foreign, and `still.mjs` printed no `[theme]` warnings.
- **Demo data is fictional.** No real customers, people, email addresses or tokens appear anywhere on screen, including URL bars and avatars.
- **Clicks land.** Render a still on each click frame, zoomed in. The pointer's tip sits on the control it clicks.
- **The camera moves smoothly.** Render stills on both sides of every view change, menu close and dialog close. The shot carries on without jumping.
- **Transitions are clean.** Render stills a few frames into each scene. No two text cards or layouts show through each other.
- **Text reads at 1080p.** Small UI text is still readable at the scene's zoom. If it isn't, zoom in on it.
- **Callouts and captions are clear.** Neither one covers the thing being shown, and captions sit above any bar along the bottom of the window.

## Timing

- **Actions land on their words.** Each click, menu and zoom happens as the voice says it, not a beat before or after. Watch it at full speed in `npm run dev` with the mixed audio.
- **Every cue resolves.** `still.mjs` printed no `cue "…" not found` warnings.
- **Scene endings breathe.** A scene's last action and its confirmation (a toast, a final state) stay on screen long enough to be seen before the next one starts.

## Sound

- **The voice is right.** Every take sounds natural, with names pronounced as the user expects.
- **Sound effects are UI sounds only.** Clicks, pops, chimes and typing, each matching an action on screen.
- **The level is consistent.** `npm run mix` level-matches every clip and normalizes the whole mix to −16 LUFS, within about 1 LU. No clip should stick out louder or quieter than the rest.

## Before sharing

- **No secrets.** `.env` is git-ignored, and no keys appear in the script, the screens or the commits.
- **Third parties are cleared.** For a public video, the user has checked the terms of any third party whose logo or product appears. Partner programs often require approval before any public promotion.
