# Theming

The **theme** is the look of everything around the product's screens: the backdrop, the intro, title and outro cards, the chapter pill, captions, callouts, highlight rings, and how they all move. The product's screens keep the product's own look, from the `--font-app` and `--color-app-*` tokens in `src/styles.css` and the components in `src/ui/`.

A theme is a JSON file in `src/themes/`. `video.config.json` names the one the video uses (`"theme": "acme"`), or holds one inline as an object. `?theme=<name>` overrides it in the player (which also has a theme menu), and so does `--theme` on `still.mjs` and `render.mjs`.

## Presets

| Preset | Character |
|---|---|
| `aurora` | Dark and expressive: brand-coloured glows, glass cards, springy motion, centred cards. The default. |
| `midnight` | Dark and minimal, like a developer tool: flat near-black, a faint grid, mono labels, no shadows. |
| `paper` | Light and editorial: warm paper with grain, serif headlines, calm motion, cards down the left. |
| `swiss` | Light and functional: flat grey, square corners, hairline borders, snappy motion, cards down the left. |
| `brutal` | Light and loud: thick black borders, hard offset shadows, a grotesk face, springy motion. |

## Fields

Only `colors.background`, `colors.foreground` and `colors.accent` are required. The other colours are derived from those three, and the other fields fall back to quiet defaults. `"extends": "<theme>"` starts from another theme and overrides it key by key, inside groups too: `{ "extends": "aurora", "colors": { "accent": "#0f62fe" } }` keeps every other aurora colour.

| Field | On screen | Values |
|---|---|---|
| `mode` | Picks the soft shadows and textures. Worked out from `background` when left out. | `dark`, `light` |
| `colors.background`, `background2` | The backdrop. `background2` is the top of its gradient. | CSS colours |
| `colors.surface` | Cards, pills and captions. Translucent when `material` is `glass`. | |
| `colors.foreground`, `muted` | Text, and secondary text such as roles and taglines. | |
| `colors.border` | Card and pill borders, dividers, the window's edge, and hard shadows. | |
| `colors.accent` | The step badge, the PBI pill, callouts, highlight rings and click ripples. | |
| `colors.accentForeground` | Text on the accent. | |
| `colors.glow` | A second brand colour, for the aurora glows. | |
| `colors.success` | The done tick. | |
| `fonts.display`, `body`, `mono` | Headlines and names; everything else; technical labels. | CSS font-family stacks |
| `text.displayWeight`, `displayTracking` | Headline weight and letter-spacing. | `600`, `"-0.02em"` |
| `text.labelCase`, `labelTracking`, `labelWeight`, `labelFont` | Small labels such as "Step 1 of 3" and "PBI #123 · Done". Write labels in sentence case; the theme sets the case. | `uppercase`/`none`, `"0.12em"`, `600`, `body`/`mono` |
| `shape.radius` | Card corners, and the ends of the accent bar and title rule. Captions and callouts get three quarters of it; highlight rings and the browser window are never rounder than 10px and 14px. | px |
| `shape.chip` | Pills and badges only: the chapter and brand pills, the step badge, the PBI pill. `999` is fully round. | px |
| `shape.border` | Border width. | px |
| `material` | `glass` blurs what is behind a translucent surface. | `glass`, `solid` |
| `shadow` | `hard` is a solid offset copy in the border colour. | `soft`, `hard`, `none` |
| `backdrop.style` | `image` also takes `image` (a path in `public/`) and `dim` (0–1, the background colour laid over it). | `aurora`, `gradient`, `solid`, `image` |
| `backdrop.texture` | A pattern over the backdrop. | `dots`, `grid`, `noise`, `none` |
| `motion` | How cards, pills, labels and callouts enter. See the table below. | `springy`, `smooth`, `snappy`, `calm` |
| `align` | Where the intro, title and outro cards sit. | `center`, `start` |

The four motions:

| `motion` | Durations | Easing | Overshoot |
|---|---|---|---|
| `springy` | 1× | ease-out; cards on a bouncy spring | Yes: cards, pills and callouts |
| `smooth` | 1× | ease-out; cards on a damped spring | No |
| `snappy` | 0.65× | quint ease-out | No |
| `calm` | 1.6× | ease-in-out | No |

Base durations are 10–14 frames (a third to half a second) for text and pills, and about 20 frames for a card to settle.

## Mapping a design system

### 1. Find the source

In order of preference:

- **Token files.** W3C design tokens, Tokens Studio or Style Dictionary JSON (values under `$value` or `value`), or a Figma variables export.
- **Code.** CSS custom properties, Tailwind's `@theme` (v4) or `tailwind.config` (v3), shadcn's `globals.css`, or a component library's theme object (MUI `createTheme`, Chakra, Mantine, Ant Design's `token`).
- **Docs.** The design system's site, a `DESIGN.md`, or a brand guidelines PDF.
- **The live site.** In a browser, read the computed styles of the page background, a heading, body text, a primary button and a card.

Map from semantic tokens (`primary`, `surface`, `text-secondary`) rather than palette steps (`blue-600`).

**Tokens set the colours, fonts and shapes; the system's own pages set the philosophy** (step 3). The video wraps the product, so it should match what the tokens build. When the marketing site looks different from the tokens, for example with a serif headline face or a coloured hero, offer that look as a second theme rather than mixing the two.

**When the system has several themes** (light and dark, or Carbon's four), open its website to see which one it uses: that is the likely default. Make that theme and one for the strongest alternative, name the default in `video.config.json`, and let the user choose from the sheet in step 5.

### 2. Map the tokens

| Theme field | Usual token names |
|---|---|
| `background` | background, canvas, page, base, surface (Material) |
| `surface` | card, layer, surface-container, raised, popover |
| `foreground` | foreground, text-primary, on-surface, fg-default |
| `muted` | muted-foreground, text-secondary, on-surface-variant, fg-muted |
| `border` | border, border-subtle, outline-variant, divider |
| `accent` | primary, brand, interactive, action, button-primary |
| `accentForeground` | primary-foreground, on-primary, text-on-color |
| `glow` | secondary, brand-secondary, a second hero colour |
| `success` | success, positive, support-success |
| `fonts` | heading and body font-family tokens |
| `shape.radius` | the card or large radius |
| `shape.chip` | the button, badge or tag radius (`999` when their buttons are pills) |
| `shape.border` | border-width |

When several tokens could fill a field, use the one the system's own components use: `accent` is the primary button's fill, `accentForeground` the text on that button, `surface` the fill of a card or tile sitting on the page background, and `border` that card's border. Layer tokens can be lighter than the background in one theme and darker in another, so read each theme's values rather than reusing one theme's choice in the other.

shadcn names its brand colour `primary`. Its `accent` is a hover tint, so map shadcn's `primary` to the theme's `accent`.

### 3. Read the philosophy

Tokens don't set `material`, `shadow`, `backdrop`, `motion`, `align` or the label style. Choose each one from the design system's stated principles and from how its own pages look:

- **`motion`.** Expressive or playful guidance, springs, overshoot: `springy`. Functional guidance with short durations and standard easing: `snappy`. Editorial, luxurious, slow fades: `calm`. Otherwise `smooth`. When the system has two modes, such as Carbon's productive and expressive, follow the expressive one: the theme's motion moves title cards and callouts, which are the video's expressive moments.
- **`material`.** Translucency, blur or frosted materials: `glass`. Otherwise `solid`.
- **`shadow`.** An elevation scale of soft shadows: `soft`. Flat design that separates with borders or colour: `none`. Offset, unblurred shadows: `hard`.
- **`backdrop`.** Gradient glows in their hero sections: `aurora`. Quiet product pages: `solid` or `gradient`. Technical or blueprint feel: a `grid` texture. Print or editorial feel: `noise`. A key visual the user supplies: `image`.
- **`align`.** Grid-driven, left-aligned layouts: `start`. Centred hero layouts: `center`.
- **Labels.** Copy their eyebrow or overline style: its case, weight and tracking, and whether it is set in mono.

Tracking given in px converts to em by dividing by the font size it was given for: 0.32px at 12px is `0.027em`.

Add a short **Theme** section to `SCRIPT.md` (written in step 3) that names the source of each colour and font and the principle behind each of these choices, so the user can see why the video looks the way it does.

### 4. Fonts and logo

Every family in `fonts` needs an `@font-face` in `src/fonts.css`, so every machine renders the same frames. For a Google font, `npm install @fontsource-variable/<name>` and import it there. A variable package registers its family with " Variable" on the end, such as `"IBM Plex Sans Variable"`, and that is the name `fonts` must use. For a licensed brand font, use only the files the user supplies: put them in `public/fonts/` and declare them in `src/fonts.css`. Keep licensed fonts out of anything published. When the brand font isn't available, use the closest open font and tell the user which one.

Use the logo variant that reads on the theme's background, such as the white logo on a dark backdrop.

If the design system is the product's own, also put its font in `--font-app` in `src/styles.css`, so the product's screens match the product.

### 5. Check it

```bash
node scripts/still.mjs --sheet --theme acme intro+2s title+3s demo+6s outro+4s
```

For the third frame, use a step scene at a moment with the camera zoomed out, so the backdrop, the window's edge, the chapter pill and a caption all show, ideally with a callout. A step scene's chapter pill and captions render even before its scene file exists.

`still.mjs` prints a `[theme]` warning when:

- the foreground or muted text is below 4.5:1 on the background, `background2` or the surface;
- the text on the accent is below 4.5:1 (pills and callouts use small bold text);
- the success tick is below 3:1 on the surface;
- the accent is below 3:1 against the product's background, since callouts and rings sit on the product's screens;
- a font has no `@font-face`.

A bad field value stops it with a message naming the allowed values.

Open the design system's site or docs in a browser and compare the sheet against them: the backdrop against its page background, the cards against its cards or tiles, the pills against its tags or buttons, the headlines against its headings. The theme is right when the frames could pass for one of its own pages. When the mapping leaves a real choice open, such as light or dark, or the tokens' look or the marketing look, make one theme for each option and show the user both on one sheet with `--theme acme-light,acme-dark`.

The step is done when `still.mjs` prints no `[theme]` warnings, the SCRIPT.md theme section traces every choice, and the user has approved the sheet.

## Beyond the fields

- **Signature layouts and motifs.** The intro, title and outro are ordinary scenes. Build a design system's signature (a diagonal band, an oversized numeral, tinted tags, a flat rule instead of the title's fading one, an illustration style) into those scenes with the helpers in `src/lib/style.ts`, rather than adding theme fields.
- **A new backdrop.** Add a branch to `Backdrop` in `src/components/Overlays.tsx`, and its name to `CHOICES` and the `Theme` type in `src/lib/theme.ts`.
- **Drawing with the theme.** Scenes and overlays take every colour, corner, shadow and motion from the theme, so changing it restyles the whole video. `src/lib/style.ts` has the helpers, and [scenes.md](scenes.md#styling-with-the-theme) explains them.
