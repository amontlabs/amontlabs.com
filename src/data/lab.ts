// Extras the showcase prototypes (src/pages/lab) derive from the films themselves: the colour at each film's edge
// (so the stage around a letterboxed film is the film's own ground) and the stills cut by scripts/make-frames.mjs.
import frames from "./frames.json";

export const ground: Record<string, string> = {
  silo: "#101214",
  sic: "#0b0c10",
  lcu: "#04060a",
  lastdrop: "#06101a",
};
export const stills = (id: string) =>
  ((frames as Record<string, number[]>)[id] ?? []).map((t) => ({ t, src: `/media/frames/${id}-${t}.webp` }));
// Fjord has no film: its sentence holds the stage for this long in a running programme
export const HOLD = 8;
