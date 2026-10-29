/** Colourful icon-tile gradients, cycled by index so a row of cards never looks the same colour twice in a row. */
export const TILE_GRADIENTS = [
  "bg-linear-to-br from-[#3350ff] to-[#1f8bff] shadow-[0_8px_20px_-6px_rgba(51,80,255,0.6)]",
  "bg-linear-to-br from-[#0a9fd8] to-[#12c2c9] shadow-[0_8px_20px_-6px_rgba(18,181,229,0.6)]",
  "bg-linear-to-br from-[#ff6a3d] to-[#ffb020] shadow-[0_8px_20px_-6px_rgba(255,106,61,0.6)]",
  "bg-linear-to-br from-[#ff5c8a] to-[#ff8a4c] shadow-[0_8px_20px_-6px_rgba(255,92,138,0.55)]",
] as const;

export function tileGradient(index: number) {
  return TILE_GRADIENTS[index % TILE_GRADIENTS.length];
}
