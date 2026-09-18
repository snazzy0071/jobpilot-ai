import { z } from "zod";

// Mirrors src/lib/content/blocks.ts's own ContentBlock union exactly —
// that file is the render-side source of truth, this is the
// write-side validation of the same shape.
const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().trim().min(1) }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), id: z.string().trim().min(1), text: z.string().trim().min(1) }),
  z.object({ type: z.literal("list"), items: z.array(z.string().trim().min(1)).min(1) }),
  z.object({ type: z.literal("quote"), text: z.string().trim().min(1) }),
]);

// The block editor (src/components/admin/blog/content-block-editor.tsx)
// keeps its own ContentBlock[] state and serializes it into one hidden
// field on submit — there's no clean way to represent a dynamic,
// per-type-shaped array as individually-named form fields, so this
// parses that JSON string server-side instead of trusting it blind.
const contentJsonSchema = z
  .string()
  .transform((value) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  })
  .pipe(z.array(contentBlockSchema).min(1, "Add at least one content block"));

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(200)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only");

export const createBlogPostSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1, "Title is required").max(300),
  excerpt: z.string().trim().min(1, "Excerpt is required").max(500),
  categoryId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: contentJsonSchema,
  publishedAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value).toISOString() : null)),
});

export const updateBlogPostSchema = createBlogPostSchema.extend({ id: z.string().uuid() });

export const blogPostIdSchema = z.object({ id: z.string().uuid() });

export const createBlogCategorySchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Name is required").max(200),
});

export const createBlogAuthorSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Name is required").max(200),
  bio: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value ? value : null)),
});
