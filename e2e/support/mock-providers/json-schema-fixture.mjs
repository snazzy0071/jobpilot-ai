// Walks a JSON Schema (the exact shape Anthropic's SDK builds from a
// zod schema via z.toJSONSchema — see src/lib/ai/service.ts's
// generateStructured) and produces a plausible, schema-valid dummy
// value — one generic responder that works for *every* structured AI
// call this app makes (ATS scan, job match, interview scoring, CV
// rewrite, keyword rewrite, ...) rather than hand-maintaining a fixture
// per prompt that would drift the moment a schema changes.

function fromString(schema) {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  const base = "Mocked E2E response text.";
  if (typeof schema.minLength === "number" && base.length < schema.minLength) {
    return base.padEnd(schema.minLength, " filler");
  }
  return base;
}

function fromNumber(schema) {
  const min = typeof schema.minimum === "number" ? schema.minimum : 0;
  const max = typeof schema.maximum === "number" ? schema.maximum : 100;
  const mid = Math.round((min + max) / 2);
  return schema.type === "integer" ? Math.round(mid) : mid;
}

export function generateFromJsonSchema(schema, depth = 0) {
  if (!schema || typeof schema !== "object" || depth > 8) return null;

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) return generateFromJsonSchema(schema.anyOf[0], depth + 1);
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) return generateFromJsonSchema(schema.oneOf[0], depth + 1);

  switch (schema.type) {
    case "object": {
      const result = {};
      const properties = schema.properties ?? {};
      for (const [key, propertySchema] of Object.entries(properties)) {
        result[key] = generateFromJsonSchema(propertySchema, depth + 1);
      }
      return result;
    }
    case "array": {
      const minItems = typeof schema.minItems === "number" ? schema.minItems : 1;
      const count = Math.max(minItems, 1);
      return Array.from({ length: count }, () => generateFromJsonSchema(schema.items, depth + 1));
    }
    case "string":
      return fromString(schema);
    case "number":
    case "integer":
      return fromNumber(schema);
    case "boolean":
      return false;
    case "null":
      return null;
    default:
      // No explicit `type` (e.g. a bare enum, or a schema this walker
      // doesn't recognise) — an empty object is at least JSON-valid and
      // harmless if the real schema.safeParse rejects it, which just
      // surfaces as this app's own normal "invalid_response" retry path.
      return Array.isArray(schema.enum) ? schema.enum[0] : {};
  }
}
