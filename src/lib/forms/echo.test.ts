import { describe, expect, it } from "vitest";
import { echoFields } from "@/lib/forms/echo";

describe("echoFields", () => {
  it("returns only the named text fields, so nothing else a form carries is ever sent back", () => {
    const form = new FormData();
    form.set("name", "Ada");
    form.set("email", "ada@example.com");
    form.set("password", "hunter2");
    form.set("upload", new File(["x"], "cv.pdf"));
    expect(echoFields(form, ["name", "email", "upload", "missing"])).toEqual({ name: "Ada", email: "ada@example.com" });
  });
});
