import { describe, expect, it } from "vitest";
import { countTermOccurrences } from "@/lib/cvs/ats-keyword-occurrences";

describe("countTermOccurrences", () => {
  it("counts a simple whole-word term case-insensitively", () => {
    expect(countTermOccurrences("Python", "Python developer. python is required. PYTHON!")).toBe(3);
  });

  it("returns 0 for a term that never appears", () => {
    expect(countTermOccurrences("Rust", "Python developer wanted.")).toBe(0);
  });

  it("returns 0 for an empty or whitespace-only term", () => {
    expect(countTermOccurrences("", "anything")).toBe(0);
    expect(countTermOccurrences("   ", "anything")).toBe(0);
  });

  it("does not match a term as a substring of a longer word", () => {
    // "Java" must not match inside "JavaScript".
    expect(countTermOccurrences("Java", "We use JavaScript extensively.")).toBe(0);
    expect(countTermOccurrences("Java", "We use Java and JavaScript.")).toBe(1);
  });

  it("matches a symbol-containing term like C++ even when followed by punctuation or a space", () => {
    expect(countTermOccurrences("C++", "C++ is a bonus, but not required.")).toBe(1);
    expect(countTermOccurrences("C++", "Experience with C++.")).toBe(1);
  });

  it("does not match C++ as a prefix of C++17", () => {
    expect(countTermOccurrences("C++", "We use C++17 exclusively.")).toBe(0);
  });

  it("matches a multi-word phrase exactly, not its individual words", () => {
    const text = "Looking for someone with excellent project management skills, not just management.";
    expect(countTermOccurrences("project management", text)).toBe(1);
  });

  it("treats regex special characters in the term as literal text", () => {
    expect(countTermOccurrences("C#", "C# and .NET experience required. C# is preferred.")).toBe(2);
  });

  it("trims surrounding whitespace on the term before matching", () => {
    expect(countTermOccurrences("  SQL  ", "Strong SQL skills required.")).toBe(1);
  });
});
