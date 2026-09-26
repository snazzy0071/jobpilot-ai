import { describe, expect, it } from "vitest";
import { createBlogPostSchema } from "@/lib/admin/blog/schemas";

const ID = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";
const base = { slug: "a-post", title: "A post", excerpt: "Short.", categoryId: ID, authorId: ID, publishedAt: "" };
const content = (blocks: unknown) => JSON.stringify(blocks);

describe("createBlogPostSchema", () => {
  it("accepts a draft (no publish date) with content", () => {
    const parsed = createBlogPostSchema.safeParse({ ...base, content: content([{ type: "paragraph", text: "Hello" }]) });
    expect(parsed.success && parsed.data.publishedAt).toBeNull();
  });

  it("says what is wrong with an empty block instead of a raw validation message", () => {
    const parsed = createBlogPostSchema.safeParse({ ...base, content: content([{ type: "paragraph", text: "  " }]) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toMatch(/needs some text/);
  });

  it("refuses no blocks, unreadable content and slugs with capitals or spaces", () => {
    expect(createBlogPostSchema.safeParse({ ...base, content: content([]) }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...base, content: "not json" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...base, slug: "Bad Slug!", content: content([{ type: "paragraph", text: "x" }]) }).success).toBe(false);
  });
});
