import config from "../../video.config.json"

export const brand = config.brand

/** The brand accent at `percent` opacity, for glows, rings and tints. */
export const accentA = (percent: number) => `color-mix(in srgb, var(--color-accent) ${percent}%, transparent)`

/** The secondary glow colour at `percent` opacity. */
export const glowA = (percent: number) => `color-mix(in srgb, var(--color-glow) ${percent}%, transparent)`

/** Puts the config's colours on :root, where Tailwind's accent classes and accentA() read them. */
export function applyBrand() {
  document.documentElement.style.setProperty("--color-accent", brand.accent)
  document.documentElement.style.setProperty("--color-glow", brand.glow)
}
