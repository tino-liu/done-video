# Review checklist

Check the picture items on stills from `node scripts/still.mjs --sheet …` before rendering the full video. After rendering, run `npm run review` and check every item on its sheets in `out/review/`: each frame there is labelled with its time and the words being spoken, and each scene ends in a spectrogram of its sound with the words marked along it.

## Picture

- **Screens match the product.** Each mockup shows the real layout, labels, components and copy. Its `still.mjs --compare` overlay lines up with a capture of the real page or a screenshot, apart from the demo data.
- **The look is the design system's.** The cards, type, corners and backdrop sit beside the design system's own pages without looking foreign, and `still.mjs` printed no `[theme]` warnings.
- **Demo data is fictional.** No real customers, people, email addresses or tokens appear anywhere on screen, including URL bars and avatars.
- **Clicks land.** Render a still on each click frame, zoomed in. The pointer's tip sits on the control it clicks.
- **The camera moves smoothly.** Render stills on both sides of every view change, menu close and dialog close. The shot carries on without jumping. On the review, every "changes all at once" is a new page or a menu opening, never the camera or a layout snapping.
- **Every frame is whole.** The review finds no one-frame glitches, and every flat frame it lists is a card fading in or out.
- **Transitions are clean.** Render stills a few frames into each scene. No two text cards or layouts show through each other.
- **Text reads at 1080p.** Small UI text is still readable at the scene's zoom. If it isn't, zoom in on it.
- **Callouts and captions are clear.** Neither one covers the thing being shown, and captions sit above any bar along the bottom of the window.

## Timing

- **Actions land on their words.** Each click, menu and zoom happens as the voice says it, not a beat before or after. On the review sheets, the frame after each click is labelled with the word that names the action.
- **Every cue resolves.** `still.mjs` printed no `cue "…" not found` warnings, and the review found none in the render.
- **Scene endings breathe.** A scene's last action and its confirmation (a toast, a final state) stay on screen long enough to be seen before the next one starts.

## Sound

- **The voice is right.** Every take sounds natural, with names pronounced as the user expects.
- **Every line ends cleanly.** No static, hiss or stray sound after a line's last word or in its pauses, and no last word cut off. The review reports these. On a spectrogram, a stray sound is haze or a bright streak where no word is marked.
- **Sound effects are UI sounds only.** Clicks, pops, chimes and typing, each matching an action on screen.
- **The level is consistent.** `npm run mix` level-matches every clip and brings the whole mix to −16 LUFS, and the review checks it is within 1 LU, peaking under −1 dBTP. No clip should stick out louder or quieter than the rest.
- **The ending fades.** The soundtrack has faded to silence by the last frame.

## Before sharing

- **No secrets.** `.env` is git-ignored, and no keys appear in the script, the screens or the commits.
- **Third parties are cleared.** For a public video, the user has checked the terms of any third party whose logo or product appears. Partner programs often require approval before any public promotion.
