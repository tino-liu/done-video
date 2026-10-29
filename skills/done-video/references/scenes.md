# Writing scenes

`src/scenes/Demo.tsx` in the template is a working example of everything below. Read it alongside this file.

## The stage

The stage is 1920×1080 at 30 fps (`FPS` in `scripts/scenes.mjs`). `src/Stage.tsx` draws each frame in this order: the backdrop, the current scene (with the previous one during a transition), the chapter pill, then the captions. `BrowserWindow` sits at the same `WINDOW_BOX` in every scene, so a cut from one browser scene to the next lines up.

`html` has a font size of 20px, so UI written in `rem` comes out at 1.25× a real browser and stays readable at 1080p. Build the product's screens in `rem`, copying the product's own Tailwind classes where it uses Tailwind, and they scale with it.

## Pure frames

Every value on screen is computed from `f`, the frame number within the scene. The renderer draws frames out of order across up to eight Chrome tabs, so each frame has to come out the same however it was reached. Use the helpers in `src/lib/anim.ts` for all motion:

- `interp(f, [f0, f1], [v0, v1], easing)` maps a frame range to a value range, clamped, with easing.
- `keys(f, [[frame, value], …])` interpolates through several points.
- `spring(f - at, { damping })` is a 0 → 1 spring that starts at `at`.
- `enter(f, at, len)` is a 0 → 1 entrance.
- `typed(text, f, at, cps)` returns the text typed so far, and `typedEnd(text, at, cps)` the frame typing finishes.
- `caretOn(f)` blinks a caret.
- `sec(s)` converts seconds to frames.

For anything that should look random, derive it from the frame or an index, for example `Math.sin(i * 1.3 + f / 6)` for waveform bars. Write every animation this way: CSS transitions, keyframes, timers, `Date.now()`, `Math.random()` and React state would all render differently in each tab.

## A scene file

```tsx
function beats(h: Helpers) {
  // Frames (scene-local) of each event, cued to the words.
}
const cursorKeys = (b: Beats): CursorKey[] => [/* … */]
const camKeys = (b: Beats): CamKey[] => [/* … */]

function MyScene({ f, s, h }: SceneProps) {
  const b = beats(h)
  return <Camera f={f} keys={camKeys(b)}>{/* window, callouts, cursor */}</Camera>
}

export const myScene: SceneDef = { Component: MyScene, events: (h) => [/* sound effects */] }
```

Register it in `src/scenes/index.tsx` under the same id as its entry in `scripts/scenes.mjs`.

### Cues and beats

`h` holds the scene's timing, all in frames:

- `h.cue("phrase", occurrence?)` is the frame the phrase starts being spoken. Matching ignores case and punctuation.
- `h.cueEnd("phrase")` is the frame the phrase finishes.
- `h.voiceStart` and `h.voiceEnd` are when the line starts and ends.
- `h.dur` is the scene's length.

A phrase that isn't in the line logs `[scene] cue "…" not found` and falls back to the middle of the scene. `still.mjs` prints page warnings, so watch its output for that message.

Derive each beat from its cue, with a floor taken from the beat before it. That way actions keep their order and spacing even when the voice speaks quickly:

```ts
const menuOpen = exportClick + 2
const csvPick = Math.max(h.cue("CSV") + 4, menuOpen + 16)
```

Put the visual a few frames before the word for something appearing (`h.cue("ticket") - 4`), and a few frames after for a click the word describes (`h.cue("Export") + 2`). When an action needs time after the last word, such as a toast or a final click, raise the scene's `tail` or `minSeconds` in `scenes.mjs`.

## Targets

Every element the cursor, camera, a callout or a highlight points at carries `data-t="name"`. `measure()` in `src/lib/measure.tsx` reads positions through the offset chain, which ignores CSS transforms. That is why zooms and pop-in animations never move a target. Three rules follow from it:

- **Centre clickable things with layout**, using `inset-x-0 mx-auto w-fit` or flex centring. `measure()` can't see a centre made with `-translate-x-1/2`, so the cursor lands half the element's width to one side.
- **Declare transform offsets.** When an ancestor fakes scrolling with a transform, put the offset on it as `data-tx` or `data-ty` so it is added back.
- **Targets stay mounted.** The camera and cursor resolve every key up to the current frame on every frame. A target that unmounts after its key makes the shot or the pointer jump. Keep screens, menus and dialogs mounted and hide them with `opacity` (plus `visibility: hidden` when fully hidden). The kit's `Select` and `Menu` already work this way, and `Demo.tsx` swaps views by crossfading two mounted layers. A move also starts `dur` frames before its `at`, so its target has to exist from then.

## Cursor

`<Cursor f={f} keys={…} start={{ x, y }} hideAfter={frame} />` goes inside the `Camera`. Each `CursorKey` has:

- `at`: the frame it arrives, which is the click frame when `click: true`.
- `target`, or `x` and `y`, plus a `dx`/`dy` offset from the target's centre.
- `dur`: how many frames the move takes (20 by default). A move starts at whichever is later: the previous key's `at`, or `at - dur`.

`clickFrames(keys)` returns the frames for the click sound, and `pressed(f, at)` gives the clicked control its pressed look for 7 frames. The cursor appears just before its first move.

## Camera

`<Camera f={f} keys={…}>` wraps the window, the overlays and the cursor. Each `CamKey` has:

- `at` and `dur` (26 by default).
- `target`: centre on it. Without a `scale`, the camera zooms to fit the target with `pad` around it, up to `maxScale` (2.2).
- `x`, `y` and `scale` set the shot directly. `{ x: 960, y: 540, scale: 1 }` is home.
- `dx` and `dy` nudge the centre after the target is resolved.

The zoom is interpolated in log space, and a zoomed shot is held inside the browser window. A control reads well at a scale of 1.3–1.6, and a detail at up to about 2.1. Start the zoom about 16 frames before the click it frames, and leave a couple of seconds between zoom changes.

## Pointing things out

- `<Callout f at until target side>` draws a label in the accent colour with an arrow and a ring. It keeps the same on-screen size at any zoom. Write it as the few words the viewer should remember, and show one at a time.
- `<Highlight f at until target>` draws just the ring, for pointing at a column or field while the voice names it.
- `Toast` from the kit shows a confirmation.

## Typing

```ts
const name = Math.max(h.cue("name") - 2, form + 8)
const next = typedEnd(PROJECT_NAME, name, NAME_CPS) + 4
```

```tsx
<Input target="name" value={typed(PROJECT_NAME, f, name, NAME_CPS)} focused={f >= name - 2 && f < next} f={f} />
```

Its sound is `{ at: name, type: "typing", len: typedEnd(PROJECT_NAME, name, NAME_CPS) - name }`.

## Sound effects

`events: (h) => SfxEvent[]` on the `SceneDef` lists the scene's sounds in scene frames. The available types are `click`, `pop`, `success`, `chime`, `typing` (with `len`), `countdown` and `rec`. Each is synthesized in the `SFX` table in `scripts/audio.mjs`. A new type goes there and into `SfxType` in `src/scenes/types.ts`. Keep the palette to UI sounds: clicks, pops, chimes and typing.

## Transitions, chapters and captions

The comments at the top of `scripts/scenes.mjs` describe each scene field. For transitions:

- **`dip`** for any scene that starts or ends on a text card or a zoomed shot, so two layouts never show through each other.
- **`fade`** only between scenes that show the same window at the same zoom.
- **`none`** where the picture carries straight on from the scene before.

Scenes that share a `chapter` share a "Step n of N" pill. Title cards set `captions: false`, because their words are already on screen.

## Recording scenes

Sometimes the presenter speaks inside a screen recording, for example when the feature captures a user describing a bug. Set `recording: true` on that scene. The mix makes it drier and closer, like a laptop mic, and the caption shows in italics with an "In the recording" badge. A REC pill or a screen-sharing bar on screen helps sell it. Raise the captions above any bar along the bottom with `captionBottom`.

## Product UI

`src/ui/kit.tsx` holds frame-driven controls: `Button`, `Input`, `Label`, `Select`, `Menu`, `Dialog`, `Toast` and `Spinner`. Their colours come from the `--color-app-*` tokens in `src/styles.css`, so restyle them to the product. `src/ui/app.tsx` is the example product. Replace it with the real product's screens, built from its own components, with the same structure, labels and copy.
