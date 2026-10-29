---
name: done-video
description: Makes a narrated, animated Done video or feature demo as code, styled to the user's design system. React scenes rebuild the product's real screens, a cursor and camera act them out on cue with the voiceover (ElevenLabs or a placeholder voice), and ffmpeg renders a 1080p MP4. Use when someone asks for a done video, a demo or walkthrough video of a feature, or to change, re-voice, re-theme or re-render a video made this way.
---

# Done video

Builds a 1–3 minute 1080p video that shows a finished piece of work: who is presenting, what got done, the feature working in the real product's UI, and a sign-off. Nothing is screen-recorded. Each scene is a React component, and every frame is a **pure** function of its frame number. Headless Chrome screenshots the frames in parallel and ffmpeg encodes them with the mixed soundtrack.

The voice drives the timing. `npm run voice` makes one clip per scene and records when each word is spoken. Each scene then **cues** its clicks, typing and zooms on those words, so editing a line re-times the picture by itself.

The **theme** sets the look around the product's screens: the backdrop, cards, captions, callouts, type, corners and motion. It is mapped from the user's design system, so the video looks like their brand rather than like this template.

`template/` next to this file is the starting project. It contains a short working example, a fictional "Acme Tasks" app exporting tasks to CSV, which shows every part of the engine in use.

## Requirements

Node 20+, `ffmpeg` and `ffprobe` on the PATH, and Google Chrome installed (rendering drives the system Chrome through `playwright-core`). Check these before scaffolding, and tell the user what to install if anything is missing.

## Steps

### 1. Brief

Find out:

- **What was done.** Read the PBI, issue or PR, and list its acceptance criteria. The video shows each one working.
- **Who presents.** Their name and role, for the intro card and the sign-off.
- **Audience.** Internal, client or public. For a public cut, check the terms of any third party whose logo or product appears.
- **Look.** Their design system, if they have one: token files, a stylesheet, a component library's theme, a style guide or a website. Without one, an accent colour and a preset from [references/theme.md](references/theme.md). Also a logo file (SVG or PNG).
- **Voice.** An ElevenLabs voice (their own clone or a stock voice) or the computer's placeholder voice. See [references/voice.md](references/voice.md).
- **Length.** A Done video is usually 30–90 seconds. A feature launch can run to 3 minutes.

The step is done when you can name every acceptance criterion the video has to show.

### 2. Find the real UI

Screens are rebuilt to match the product exactly: the same layout, labels, components, colours and wording. If the product's source is available, read the components and stylesheets behind every screen in the video, and copy the product's colour tokens into `src/styles.css`. If it isn't, ask the user for screenshots of each screen. Demo data is fictional (made-up companies, people and numbers), and never real customer data.

Find the design system's source too. It is often the product's own, in the same stylesheets.

The step is done when every screen in the video has a source (a file path or a screenshot), and so does the design system.

### 3. Script

Write `SCRIPT.md` for people to read: for each scene, what is on screen and the spoken line. Then write `scripts/scenes.mjs`, which is the copy the voice speaks. Each scene is one voice clip, and the comments at the top of that file explain each field. A Done video usually runs **intro** (who) → **title** (what is done, with the PBI number) → one scene per step of the feature working → **outro** (its status, then the sign-off). Write short spoken sentences with one action per clause, so each action has a word to cue on.

Show the user the script and get their approval before building any scenes. The words set the timing, so changing them later means re-timing scenes.

### 4. Scaffold

Copy `template/` to a new folder outside the product's repo, named for the video (for example `acme-csv-export-video`). In that folder, run `npm install`, then fill in `video.config.json`: the output file name, the brand's name and logo, and `voice.sayAs` for words the voice mispronounces. For ElevenLabs, copy `.env.example` to `.env` and have the user paste their key and voice ID into that file. Keys stay in `.env` and never appear in the conversation.

Replace the example: put the product's screens in `src/ui/`, put one file per scene in `src/scenes/`, and register each scene in `src/scenes/index.tsx` under its id from `scenes.mjs`. Swap `public/assets/logo.svg` for the real logo.

### 5. Voice

Run `npm run voice`. It writes `src/timeline.json`, which every scene reads, so it comes before building or previewing anything. Listen to each new take and re-roll any that come out wrong (see [references/voice.md](references/voice.md)).

### 6. Theme

Read [references/theme.md](references/theme.md), then write the theme: a file in `src/themes/` mapped from the design system, or a preset with the brand's accent. Name it in `video.config.json`. Render it with `node scripts/still.mjs --sheet --theme <name> …`, and show the user the sheet. The step is done when `still.mjs` prints no `[theme]` warnings and the user has approved the look.

### 7. Build the scenes

Read [references/scenes.md](references/scenes.md) before writing the first scene. It covers beats, cues, cursor and camera keys, callouts, sound effects, styling with the theme, and the rules that keep frames **pure** and targets measurable. Preview with `npm run dev` (http://localhost:5181: space plays, the arrow keys seek). `npm run check` must pass.

### 8. Check frames

Render stills at every beat, such as each click, menu, zoom and transition, using `node scripts/still.mjs --sheet <frames>`. Read `out/stills/sheet.png`, fix what is wrong, and repeat. Then go through every item in [references/review.md](references/review.md). The step is done when every item passes on the stills.

### 9. Mix, render, deliver

Run `npm run mix`, then `npm run render`. The video is written to `out/<output>`. Send it to the user and take their notes. Each round of changes re-voices only the lines that changed, then re-mixes and re-renders.

## Commands

| Command | Does |
|---|---|
| `npm run voice` | Voice clips and `src/timeline.json`. `--reroll=id,id` regenerates those scenes; `--placeholder` forces the computer's voice. |
| `npm run dev` | The player, with the mixed audio once it exists, and a menu to switch themes. |
| `node scripts/still.mjs <frames>` | PNGs in `out/stills`. Frames are written `120`, `2.5s` or `demo+3s`; `--sheet` also tiles them into `sheet.png`. `--theme a,b` renders them in each theme, a row per theme. |
| `npm run check` | Type-checks the scenes. |
| `npm run mix` | Voice, sound effects and music in `out/mix.wav`, at about −16 LUFS. `--stems` also writes each bus on its own. |
| `npm run render` | The MP4. `--from 300 --to 600` renders a slice; `--no-captions` leaves out the captions; `--theme <name>` renders another theme. |
| `node scripts/music.mjs` | Optional backing track from ElevenLabs Music, which replaces the synthesized pad. |
| `node scripts/wait-for-voice.mjs` | Waits for an ElevenLabs Professional Voice Clone to finish training. |
