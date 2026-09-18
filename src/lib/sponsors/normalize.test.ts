import { describe, expect, it } from "vitest";
import { collapseWhitespace, normalizeForMatch, escapeLikePattern } from "@/lib/sponsors/normalize";

describe("collapseWhitespace", () => {
  it("collapses runs of internal whitespace to a single space", () => {
    expect(collapseWhitespace("Acme    Ltd")).toBe("Acme Ltd");
    expect(collapseWhitespace("Acme\tLtd\n\nCo")).toBe("Acme Ltd Co");
  });

  it("trims leading and trailing whitespace", () => {
    expect(collapseWhitespace("  Acme Ltd  ")).toBe("Acme Ltd");
  });

  it("leaves an already-clean string unchanged", () => {
    expect(collapseWhitespace("Acme Ltd")).toBe("Acme Ltd");
  });
});

describe("normalizeForMatch", () => {
  it("lowercases and collapses whitespace together, matching how the importer stores company_name_normalized", () => {
    expect(normalizeForMatch("  ACME   Ltd  ")).toBe("acme ltd");
  });

  it("treats two differently-cased, differently-spaced inputs as the same key", () => {
    expect(normalizeForMatch("Acme Ltd")).toBe(normalizeForMatch("ACME    LTD"));
  });

  it("does not strip accents or non-ASCII characters — only case and whitespace", () => {
    expect(normalizeForMatch("Café Ltd")).toBe("café ltd");
  });
});

describe("escapeLikePattern", () => {
  it("escapes a literal percent sign so it can't act as a wildcard", () => {
    expect(escapeLikePattern("100% Ltd")).toBe("100\\% Ltd");
  });

  it("escapes a literal underscore so it can't act as a single-char wildcard", () => {
    expect(escapeLikePattern("A_B Consulting")).toBe("A\\_B Consulting");
  });

  it("escapes a literal backslash", () => {
    expect(escapeLikePattern("A\\B")).toBe("A\\\\B");
  });

  it("leaves a plain search term with none of these characters unchanged", () => {
    expect(escapeLikePattern("Acme Consulting")).toBe("Acme Consulting");
  });

  it("escapes multiple special characters in one string, each independently", () => {
    expect(escapeLikePattern("50%_off\\deal")).toBe("50\\%\\_off\\\\deal");
  });
});
