/**
 * Colourful animated backdrop for light heroes: a fine fading grid and four large, slowly morphing colour blobs
 * (blue, cyan, sun, coral). CSS-only and aria-hidden; reduced-motion users get the same picture standing still.
 */
export function HeroBackdrop({ intensity = "full" }: { intensity?: "full" | "soft" }) {
  const o = intensity === "full" ? "" : "opacity-60";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="bg-grid-light absolute inset-0" />
      <div className={o}>
        <div className="animate-blob absolute -top-32 -left-24 size-[28rem] bg-brand-cyan/40 blur-3xl" />
        <div className="animate-blob absolute -top-24 right-[-6rem] size-[32rem] bg-primary/30 blur-3xl [animation-delay:-6s]" />
        <div className="animate-blob absolute bottom-[-10rem] left-[30%] size-[26rem] bg-brand-sun/35 blur-3xl [animation-delay:-11s]" />
        <div className="animate-blob absolute right-[12%] bottom-[-6rem] size-[22rem] bg-brand-coral/30 blur-3xl [animation-delay:-3s]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-b from-transparent to-background" />
    </div>
  );
}
