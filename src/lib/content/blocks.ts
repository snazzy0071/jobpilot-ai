// Shared structured-content shape for any long-form page rendered from
// data instead of hand-written JSX — currently the blog and the legal
// pages (Privacy, Terms, Cookies, Accessibility). Typed blocks instead of
// markdown/HTML means the renderer never needs dangerouslySetInnerHTML,
// and a table of contents can be built straight from heading blocks.
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; id: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string };
