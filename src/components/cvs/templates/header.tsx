import type { CSSProperties, ReactNode } from "react";
import { getContactItems, type ContactItem } from "@/components/cvs/templates/content";
import { ATOM, ATOM_STYLE, colorOf, fontOf, mainTone } from "@/components/cvs/templates/primitives";
import { PAGE_PAD_Y, safeTracking, type TemplateDesign } from "@/components/cvs/templates/design";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

function ContactLink({ item }: { item: ContactItem }) {
  if (!item.href) return <span>{item.text}</span>;
  return (
    <a href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
      {item.text}
    </a>
  );
}

function Contact({
  items,
  design,
  color,
  align,
}: {
  items: ContactItem[];
  design: TemplateDesign;
  color: string;
  align: "left" | "center" | "right";
}) {
  if (items.length === 0) return null;
  const h = design.header;
  const base: CSSProperties = { fontSize: design.type.small + 0.5, color, textAlign: align, margin: 0, lineHeight: 1.5 };

  if (h.contact === "stacked") {
    return (
      <div style={base}>
        {items.map((item) => (
          <div key={item.key}>
            <ContactLink item={item} />
          </div>
        ))}
      </div>
    );
  }

  if (h.contact === "grid") {
    return (
      <div style={{ ...base, display: "grid", gridTemplateColumns: "repeat(2, max-content)", columnGap: 28, rowGap: 1, justifyContent: align === "center" ? "center" : "start" }}>
        {items.map((item) => (
          <div key={item.key}>
            <ContactLink item={item} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <p style={base}>
      {items.map((item, index) => (
        <span key={item.key}>
          {index > 0 && <span style={{ whiteSpace: "pre" }}>{h.contactSeparator}</span>}
          <ContactLink item={item} />
        </span>
      ))}
    </p>
  );
}

/**
 * The name/headline/contact block. It owns its own horizontal padding (so
 * a "band" or "strip" can run edge to edge), and the bleeding variants pull
 * themselves up by `PAGE_PAD_Y` to reach the physical top of the page —
 * the document wrapper reserves that space on every page.
 */
export function CvHeader({ data, design, padX }: { data: CvTemplateContentData; design: TemplateDesign; padX: number }) {
  const { personal } = data;
  const h = design.header;
  const tone = mainTone(design);

  if (!personal?.fullName) {
    return (
      <p {...ATOM} style={{ ...ATOM_STYLE, padding: `0 ${padX}px`, marginBottom: h.gap, fontSize: design.type.base, color: tone.muted, fontStyle: "italic" }}>
        Add your personal details to see them here.
      </p>
    );
  }

  const onBand = h.variant === "band";
  const nameColor = onBand ? (h.ink ?? "#ffffff") : colorOf(tone, h.nameColor, "ink");
  const headlineColor = onBand ? (h.subInk ?? h.ink ?? "#ffffff") : colorOf(tone, h.headlineColor, "muted");
  const contactColor = onBand ? (h.subInk ?? h.ink ?? "#ffffff") : tone.muted;
  const align: "left" | "center" | "right" = h.variant === "center" || h.variant === "framed" ? "center" : "left";
  const items = getContactItems(personal).map((item) => (data.staticLinks ? { ...item, href: undefined } : item));

  const name: ReactNode = (
    <h2
      style={{
        margin: 0,
        fontFamily: fontOf(design, h.nameFont),
        fontSize: h.nameSize,
        fontWeight: h.nameWeight,
        fontStyle: h.nameItalic ? "italic" : "normal",
        letterSpacing: `${safeTracking(h.nameTracking)}em`,
        textTransform: h.nameCase === "upper" ? "uppercase" : "none",
        fontVariantCaps: h.nameCase === "small-caps" ? "small-caps" : "normal",
        lineHeight: 1.1,
        color: nameColor,
        textAlign: align,
        overflowWrap: "break-word",
      }}
    >
      {personal.fullName}
    </h2>
  );

  const headline: ReactNode = personal.headline ? (
    <p
      style={{
        margin: `${Math.round(h.nameSize * 0.2)}px 0 0`,
        fontFamily: fontOf(design, h.headlineFont ?? "body"),
        fontSize: h.headlineSize,
        fontWeight: h.headlineStyle === "caps" ? 600 : 500,
        fontStyle: h.headlineStyle === "italic" ? "italic" : "normal",
        textTransform: h.headlineStyle === "caps" ? "uppercase" : "none",
        letterSpacing: h.headlineStyle === "caps" ? `${safeTracking(0.14)}em` : undefined,
        color: headlineColor,
        textAlign: align,
        lineHeight: 1.3,
      }}
    >
      {personal.headline}
    </p>
  ) : null;

  const contact = (
    <div style={{ marginTop: personal.headline ? 10 : 8 }}>
      <Contact items={items} design={design} color={contactColor} align={align} />
    </div>
  );

  const ruleStyle: CSSProperties =
    h.rule === "hairline"
      ? { borderBottom: `1px solid ${tone.rule}`, paddingBottom: 14 }
      : h.rule === "thick"
        ? { borderBottom: `3px solid ${tone.accent}`, paddingBottom: 14 }
        : h.rule === "double"
          ? { borderBottom: `4px double ${tone.ink}`, paddingBottom: 14 }
          : {};

  switch (h.variant) {
    case "band":
      return (
        <header
          {...ATOM}
          style={{
            ...ATOM_STYLE,
            background: h.bg,
            margin: `-${PAGE_PAD_Y}px 0 ${h.gap}px`,
            padding: `${PAGE_PAD_Y + 24}px ${padX}px 24px`,
          }}
        >
          {name}
          {headline}
          {contact}
        </header>
      );

    case "strip":
      return (
        <>
          <div aria-hidden style={{ background: h.bg ?? tone.accent, height: 14, margin: `-${PAGE_PAD_Y}px 0 ${PAGE_PAD_Y + 6}px` }} />
          <header {...ATOM} style={{ ...ATOM_STYLE, padding: `0 ${padX}px`, marginBottom: h.gap }}>
            <div style={ruleStyle}>
              {name}
              {headline}
              {contact}
            </div>
          </header>
        </>
      );

    case "boxed":
      return (
        <header {...ATOM} style={{ ...ATOM_STYLE, padding: `0 ${padX}px`, marginBottom: h.gap }}>
          <div style={{ border: `1.5px solid ${tone.accent}`, padding: "18px 22px 16px" }}>
            {name}
            {headline}
            {contact}
          </div>
        </header>
      );

    case "framed":
      return (
        <header {...ATOM} style={{ ...ATOM_STYLE, padding: `0 ${padX}px`, marginBottom: h.gap }}>
          <div style={{ borderTop: `3px solid ${tone.ink}`, borderBottom: `1px solid ${tone.ink}`, padding: "16px 0 14px" }}>
            {name}
            {headline}
            {contact}
          </div>
        </header>
      );

    case "split":
      return (
        <header {...ATOM} style={{ ...ATOM_STYLE, padding: `0 ${padX}px`, marginBottom: h.gap }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, ...ruleStyle }}>
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              {name}
              {headline}
            </div>
            <div style={{ flex: "0 1 42%", minWidth: 0 }}>
              <Contact items={items} design={design} color={contactColor} align="right" />
            </div>
          </div>
        </header>
      );

    default:
      // "left", "center" and "oversize" share one structure — the design's own name size, contact layout and rule carry the difference.
      return (
        <header {...ATOM} style={{ ...ATOM_STYLE, padding: `0 ${padX}px`, marginBottom: h.gap }}>
          <div style={ruleStyle}>
            {name}
            {headline}
            {contact}
          </div>
        </header>
      );
  }
}
