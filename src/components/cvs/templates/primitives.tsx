import type { CSSProperties, ReactNode } from "react";
import { CV_FONT_STACKS } from "@/components/cvs/templates/fonts";
import { parseDescription } from "@/components/cvs/templates/content";
import { safeTracking } from "@/components/cvs/templates/design";
import type {
  BulletStyle,
  ColorRole,
  EntryLayout,
  FontRole,
  HeadingDesign,
  SkillsStyle,
  TemplateDesign,
} from "@/components/cvs/templates/design";

/**
 * Palette + per-region overrides a section renders with. The main column
 * uses the template's own colours; a sidebar swaps in the sidebar's, so
 * the same section components draw correctly on a dark or tinted column.
 */
export type Tone = {
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  rule: string;
  heading: HeadingDesign;
  skills: SkillsStyle;
  /** A sidebar always stacks its entries — a date gutter doesn't fit a narrow column. */
  entryLayout: EntryLayout;
  isSidebar: boolean;
};

export type Ctx = { design: TemplateDesign; tone: Tone };

export function mainTone(design: TemplateDesign): Tone {
  return {
    ...design.colors,
    heading: design.heading,
    skills: design.skills,
    entryLayout: design.entry.layout,
    isSidebar: false,
  };
}

export function sidebarTone(design: TemplateDesign): Tone {
  const side = design.sidebar;
  if (!side) return mainTone(design);
  return {
    ink: side.ink,
    muted: side.muted,
    accent: side.accent,
    accentSoft: side.rule,
    rule: side.rule,
    heading: { ...design.heading, ...side.heading, color: "accent", line: "accent", italic: false },
    skills: side.skills,
    entryLayout: "stacked",
    isSidebar: true,
  };
}

export function fontOf(design: TemplateDesign, role: FontRole): string {
  return CV_FONT_STACKS[design.fonts[role]];
}

export function colorOf(tone: Tone, role: ColorRole | undefined, fallback: ColorRole = "ink"): string {
  return tone[role ?? fallback];
}

/** Marks an element as an unbreakable unit for pagination — see a4-page.tsx and the print stylesheet. */
export const ATOM = { "data-cv-atom": "" } as const;
/** ...that must stay on the same page as whatever follows it (headings, entry title lines). */
export const KEEP = { "data-cv-keep": "" } as const;
export const ATOM_STYLE: CSSProperties = { breakInside: "avoid" };
export const KEEP_STYLE: CSSProperties = { breakInside: "avoid", breakAfter: "avoid" };

// ---- section heading -------------------------------------------------------

function headingTextStyle(design: TemplateDesign, tone: Tone): CSSProperties {
  const h = tone.heading;
  return {
    fontFamily: fontOf(design, h.font),
    fontSize: h.size,
    fontWeight: h.weight,
    fontStyle: h.italic ? "italic" : "normal",
    letterSpacing: `${safeTracking(h.tracking)}em`,
    textTransform: h.case === "upper" ? "uppercase" : "none",
    fontVariantCaps: h.case === "small-caps" ? "small-caps" : "normal",
    color: colorOf(tone, h.color),
    lineHeight: 1.2,
    margin: 0,
  };
}

export function SectionHeading({ children, ctx, align }: { children: ReactNode; ctx: Ctx; align?: "left" | "right" }) {
  const { design, tone } = ctx;
  const h = tone.heading;
  const line = colorOf(tone, h.line, "ink");
  const text = headingTextStyle(design, tone);
  const common = { ...ATOM, ...KEEP };
  const frame: CSSProperties = { ...KEEP_STYLE, textAlign: align ?? "left" };

  switch (h.style) {
    case "rule":
      return (
        <h3 {...common} style={{ ...frame, ...text, borderBottom: `1px solid ${h.line ? line : tone.rule}`, paddingBottom: 4 }}>
          {children}
        </h3>
      );
    case "rule-thick":
      return (
        <h3 {...common} style={{ ...frame, ...text, borderBottom: `2px solid ${line}`, paddingBottom: 4 }}>
          {children}
        </h3>
      );
    case "overline":
      return (
        <h3 {...common} style={{ ...frame, ...text, borderTop: `2px solid ${line}`, paddingTop: 6 }}>
          {children}
        </h3>
      );
    case "underline-short":
      return (
        <h3 {...common} style={{ ...frame, ...text }}>
          {children}
          <span aria-hidden style={{ display: "block", width: 30, height: 3, marginTop: 5, background: line }} />
        </h3>
      );
    case "bar-left":
      return (
        <h3 {...common} style={{ ...frame, ...text, borderLeft: `4px solid ${line}`, paddingLeft: 9, paddingTop: 1, paddingBottom: 1 }}>
          {children}
        </h3>
      );
    case "pill":
      return (
        <h3 {...common} style={{ ...frame, margin: 0 }}>
          <span
            style={{
              ...text,
              display: "inline-block",
              background: line,
              color: "#ffffff",
              padding: "3px 11px",
              borderRadius: 999,
            }}
          >
            {children}
          </span>
        </h3>
      );
    case "block":
      return (
        <h3 {...common} style={{ ...frame, ...text, background: tone.accentSoft, padding: "5px 10px" }}>
          {children}
        </h3>
      );
    case "flanked":
      return (
        <h3 {...common} style={{ ...frame, ...text, display: "flex", alignItems: "center", gap: 12 }}>
          <span aria-hidden style={{ flex: 1, height: 1, background: tone.rule }} />
          <span>{children}</span>
          <span aria-hidden style={{ flex: 1, height: 1, background: tone.rule }} />
        </h3>
      );
    case "square":
      return (
        <h3 {...common} style={{ ...frame, ...text, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ width: 8, height: 8, background: line, flexShrink: 0 }} />
          <span>{children}</span>
        </h3>
      );
    default:
      return (
        <h3 {...common} style={{ ...frame, ...text }}>
          {children}
        </h3>
      );
  }
}

// ---- bullets / descriptions -----------------------------------------------

const BULLET_INDENT: Record<BulletStyle, number> = { disc: 14, dash: 15, square: 14, chevron: 15, none: 0 };

function BulletMarker({ style, color, lineHeight }: { style: BulletStyle; color: string; lineHeight: number }) {
  if (style === "none") return null;
  const top = `${(lineHeight / 2).toFixed(3)}em`;
  const base: CSSProperties = { position: "absolute", left: 2, top, transform: "translateY(-50%)" };
  switch (style) {
    case "disc":
      return <span aria-hidden style={{ ...base, width: 4.5, height: 4.5, borderRadius: "50%", background: color }} />;
    case "square":
      return <span aria-hidden style={{ ...base, width: 4, height: 4, background: color }} />;
    case "dash":
      return <span aria-hidden style={{ ...base, width: 7, height: 1.5, background: color }} />;
    case "chevron":
      return (
        <span
          aria-hidden
          style={{
            ...base,
            left: 1,
            width: 4.5,
            height: 4.5,
            borderTop: `1.5px solid ${color}`,
            borderRight: `1.5px solid ${color}`,
            transform: "translateY(-50%) rotate(45deg)",
          }}
        />
      );
  }
}

export function Description({ text, ctx, marginTop = 5 }: { text: string | null | undefined; ctx: Ctx; marginTop?: number }) {
  const blocks = parseDescription(text);
  if (blocks.length === 0) return null;
  const { design, tone } = ctx;
  const bullet = design.entry.bullet;
  const markerColor = tone.isSidebar ? tone.accent : tone.muted;

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const top = blockIndex === 0 ? marginTop : 3;
        if (block.kind === "paragraph") {
          return (
            <p key={blockIndex} {...ATOM} style={{ ...ATOM_STYLE, margin: `${top}px 0 0`, color: tone.ink }}>
              {block.text}
            </p>
          );
        }
        return (
          <ul key={blockIndex} style={{ margin: `${top}px 0 0`, padding: 0, listStyle: "none" }}>
            {block.items.map((item, itemIndex) => (
              <li
                key={itemIndex}
                {...ATOM}
                style={{
                  ...ATOM_STYLE,
                  position: "relative",
                  paddingLeft: BULLET_INDENT[bullet],
                  marginTop: itemIndex === 0 ? 0 : 2.5,
                  color: tone.ink,
                }}
              >
                <BulletMarker style={bullet} color={markerColor} lineHeight={design.type.lineHeight} />
                {item}
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}

// ---- entry -----------------------------------------------------------------

export type EntryProps = {
  ctx: Ctx;
  index: number;
  title: string;
  subtitle?: string;
  /** Pre-formatted (e.g. "Mar 2022 – Present"). */
  dates?: string | null;
  /** Extra small lines under the title block (a grade, a URL). */
  extra?: ReactNode;
  description?: string | null;
  /** Experience/education can lead with the organisation; projects and certifications never do. */
  swappable?: boolean;
};

export function Entry({ ctx, index, title, subtitle, dates, extra, description, swappable = false }: EntryProps) {
  const { design, tone } = ctx;
  const e = design.entry;
  const small = design.type.small;
  const hasBody = parseDescription(description).length > 0;

  let layout: EntryLayout = tone.entryLayout;
  if (layout === "employer-led" && !(swappable && subtitle)) layout = "dates-right";

  const hairline = e.divider === "hairline" && index > 0;
  const top = index === 0 ? 0 : design.spacing.entry;

  const titleStyle: CSSProperties = {
    fontFamily: fontOf(design, e.titleFont),
    fontWeight: e.titleWeight,
    fontSize: design.type.base + 0.5,
    color: tone.ink,
    lineHeight: 1.3,
  };
  const metaStyle: CSSProperties = {
    fontFamily: fontOf(design, e.metaFont),
    fontStyle: e.metaItalic ? "italic" : "normal",
    color: colorOf(tone, e.metaColor, "muted"),
  };
  const dateStyle: CSSProperties = {
    fontFamily: fontOf(design, e.dateFont),
    fontSize: small,
    color: tone.muted,
    textTransform: e.dateCase === "upper" ? "uppercase" : "none",
    letterSpacing: e.dateCase === "upper" ? "0.04em" : undefined,
    whiteSpace: "nowrap",
  };
  const extraEl = extra ? <div style={{ fontSize: small, color: tone.muted, marginTop: 1 }}>{extra}</div> : null;

  const blockStyle = (paddingLeft?: number): CSSProperties => ({
    ...(hasBody ? KEEP_STYLE : ATOM_STYLE),
    ...(hairline
      ? { marginTop: top / 2, paddingTop: top / 2, borderTop: `1px solid ${tone.rule}` }
      : { marginTop: top }),
    ...(paddingLeft ? { paddingLeft } : null),
  });
  const attrs = hasBody ? { ...ATOM, ...KEEP } : ATOM;
  const body = <Description text={description} ctx={ctx} />;

  if (layout === "dates-left") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `${e.dateWidth}px minmax(0, 1fr)`, columnGap: 14, alignItems: "baseline" }}>
        <div style={{ ...dateStyle, whiteSpace: "normal", marginTop: top }}>{dates}</div>
        <div>
          <div {...attrs} style={blockStyle()}>
            <div style={titleStyle}>{title}</div>
            {subtitle && <div style={metaStyle}>{subtitle}</div>}
            {extraEl}
          </div>
          {body}
        </div>
      </div>
    );
  }

  if (layout === "timeline") {
    return (
      <div style={{ marginTop: top, marginLeft: 4, borderLeft: `1.5px solid ${tone.rule}`, paddingLeft: 17 }}>
        <div {...attrs} style={{ ...(hasBody ? KEEP_STYLE : ATOM_STYLE), position: "relative" }}>
          <span aria-hidden style={{ position: "absolute", left: -21.75, top: 4, width: 8, height: 8, background: tone.accent }} />
          {dates && <div style={{ ...dateStyle, color: tone.accent, fontWeight: 600, marginBottom: 1 }}>{dates}</div>}
          <div style={titleStyle}>{title}</div>
          {subtitle && <div style={metaStyle}>{subtitle}</div>}
          {extraEl}
        </div>
        {body}
      </div>
    );
  }

  if (layout === "stacked") {
    return (
      <div>
        <div {...attrs} style={blockStyle()}>
          <div style={titleStyle}>{title}</div>
          {subtitle && <div style={metaStyle}>{subtitle}</div>}
          {dates && <div style={{ ...dateStyle, whiteSpace: "normal", marginTop: 1 }}>{dates}</div>}
          {extraEl}
        </div>
        {body}
      </div>
    );
  }

  // "dates-right" and "employer-led": a two-line header with the dates on the first line's right edge.
  const swapped = layout === "employer-led";
  const primary = swapped ? subtitle! : title;
  const secondary = swapped ? title : subtitle;
  return (
    <div>
      <div {...attrs} style={blockStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14 }}>
          <div style={titleStyle}>{primary}</div>
          {dates && <div style={dateStyle}>{dates}</div>}
        </div>
        {secondary && <div style={metaStyle}>{secondary}</div>}
        {extraEl}
      </div>
      {body}
    </div>
  );
}
