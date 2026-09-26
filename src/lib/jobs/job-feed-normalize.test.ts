import { describe, expect, it } from "vitest";
import { cleanFeedText, safeHttpUrl, safePostedAt } from "@/lib/jobs/text";
import { normalizeAdzunaJob } from "@/lib/jobs/adapters/adzuna/normalize";
import { normalizeReedJob, parseReedDate } from "@/lib/jobs/adapters/reed/normalize";

// The payload shapes below follow the providers' documented search responses (Adzuna /v1/api/jobs/gb/search, Reed
// /api/1.0/search) including fields this app ignores. They exercise the normalizers only; nothing here is stored.

const ADZUNA_RESULT = {
  id: "4712345678",
  title: "Senior Data Analyst",
  description: "Join our analytics team&hellip; You will build dashboards in SQL &amp; Power BI. <b>Hybrid</b> working, Leeds…",
  created: "2026-09-24T09:12:33Z",
  redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/4712345678?se=abc&v=123",
  company: { __CLASS__: "Adzuna::API::Response::Company", display_name: "Example Analytics Ltd" },
  location: { __CLASS__: "Adzuna::API::Response::Location", display_name: "Leeds, West Yorkshire", area: ["UK", "Yorkshire And The Humber", "West Yorkshire", "Leeds"] },
  salary_min: 45000,
  salary_max: 55000,
};

const REED_RESULT = {
  jobId: 51234567,
  employerId: 88,
  employerName: "Northern Health Trust",
  jobTitle: "Staff Nurse",
  locationName: "Manchester",
  minimumSalary: 30000,
  maximumSalary: 36000,
  currency: "GBP",
  expirationDate: "25/10/2026",
  date: "24/09/2026",
  jobDescription: "We are recruiting a Staff Nurse to join our ward team. Registered nurses only.",
  applications: 3,
  jobUrl: "https://www.reed.co.uk/jobs/staff-nurse/51234567",
};

describe("cleanFeedText", () => {
  it("strips markup, decodes entities and keeps block breaks", () => {
    expect(cleanFeedText("<p>Salary &pound;30k &amp; benefits</p><p>Apply&nbsp;now</p>")).toBe("Salary £30k & benefits\nApply now");
    expect(cleanFeedText("<ul><li>SQL</li><li>Python</li></ul>")).toContain("• SQL");
  });
  it("decodes numeric entities and leaves unknown ones alone", () => {
    expect(cleanFeedText("&#163;40k &#x2013; &bogus;")).toBe("£40k – &bogus;");
  });
  it("handles empty input", () => {
    expect(cleanFeedText(undefined)).toBe("");
    expect(cleanFeedText("   ")).toBe("");
  });
});

describe("safeHttpUrl", () => {
  it("accepts only http(s) links", () => {
    expect(safeHttpUrl("https://www.reed.co.uk/jobs/1")).toBe("https://www.reed.co.uk/jobs/1");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("ftp://x.test/a")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(`https://x.test/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("safePostedAt", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  it("returns ISO for a valid date and null for anything else", () => {
    expect(safePostedAt("2026-09-24T09:12:33Z", now)).toBe("2026-09-24T09:12:33.000Z");
    expect(safePostedAt("garbage", now)).toBeNull();
    expect(safePostedAt(undefined, now)).toBeNull();
  });
  it("rejects a posting date in the future rather than letting it sort above everything real", () => {
    expect(safePostedAt("2027-01-01T00:00:00Z", now)).toBeNull();
  });
});

describe("normalizeAdzunaJob", () => {
  it("maps a real-shaped Adzuna result onto the jobs table", () => {
    const result = normalizeAdzunaJob(ADZUNA_RESULT);
    if ("error" in result) throw new Error(result.error);
    expect(result.job).toMatchObject({
      externalId: "4712345678",
      title: "Senior Data Analyst",
      titleNormalized: "senior data analyst",
      companyName: "Example Analytics Ltd",
      companyNameNormalized: "example analytics ltd",
      location: "Leeds, West Yorkshire",
      locationNormalized: "leeds, west yorkshire",
      url: "https://www.adzuna.co.uk/jobs/land/ad/4712345678?se=abc&v=123",
      postedAt: "2026-09-24T09:12:33.000Z",
      expiresAt: null, // Adzuna gives none; never invented
    });
    expect(result.job.description).toBe("Join our analytics team… You will build dashboards in SQL & Power BI. Hybrid working, Leeds…");
  });

  it("accepts a numeric id", () => {
    const result = normalizeAdzunaJob({ ...ADZUNA_RESULT, id: 4712345678 });
    expect("job" in result && result.job.externalId).toBe("4712345678");
  });

  it.each([
    ["id", { ...ADZUNA_RESULT, id: "" }],
    ["title", { ...ADZUNA_RESULT, title: "  " }],
    ["company", { ...ADZUNA_RESULT, company: {} }],
    ["url", { ...ADZUNA_RESULT, redirect_url: "javascript:x" }],
    ["description", { ...ADZUNA_RESULT, description: "" }],
  ])("skips a listing with a missing/invalid %s instead of throwing", (_field, raw) => {
    expect("error" in normalizeAdzunaJob(raw as never)).toBe(true);
  });

  it("nulls an unparseable created date and a missing location", () => {
    const result = normalizeAdzunaJob({ ...ADZUNA_RESULT, created: "yesterday", location: undefined });
    if ("error" in result) throw new Error(result.error);
    expect(result.job.postedAt).toBeNull();
    expect(result.job.location).toBeNull();
    expect(result.job.locationNormalized).toBeNull();
  });

  it("truncates to the column limits", () => {
    const result = normalizeAdzunaJob({ ...ADZUNA_RESULT, title: "T".repeat(500), description: "d".repeat(60_000) });
    if ("error" in result) throw new Error(result.error);
    expect(result.job.title).toHaveLength(300);
    expect(result.job.description).toHaveLength(50_000);
  });
});

describe("parseReedDate / normalizeReedJob", () => {
  it("parses Reed's dd/MM/yyyy and rejects impossible dates", () => {
    expect(parseReedDate("24/09/2026")).toBe("2026-09-24T00:00:00.000Z");
    expect(parseReedDate("1/2/2026")).toBe("2026-02-01T00:00:00.000Z");
    expect(parseReedDate("31/02/2026")).toBeNull();
    expect(parseReedDate("2026-09-24")).toBeNull();
    expect(parseReedDate(undefined)).toBeNull();
  });

  it("maps a real-shaped Reed result, including its real expiry", () => {
    const result = normalizeReedJob(REED_RESULT);
    if ("error" in result) throw new Error(result.error);
    expect(result.job).toMatchObject({
      externalId: "51234567",
      title: "Staff Nurse",
      companyName: "Northern Health Trust",
      companyNameNormalized: "northern health trust",
      location: "Manchester",
      url: "https://www.reed.co.uk/jobs/staff-nurse/51234567",
      postedAt: "2026-09-24T00:00:00.000Z",
      expiresAt: "2026-10-25T00:00:00.000Z",
    });
  });

  it("drops an expiry that precedes the posting date rather than failing the whole batch on the table's check", () => {
    const result = normalizeReedJob({ ...REED_RESULT, date: "24/09/2026", expirationDate: "01/09/2026" });
    if ("error" in result) throw new Error(result.error);
    expect(result.job.expiresAt).toBeNull();
  });

  it.each([
    ["jobId", { ...REED_RESULT, jobId: undefined }],
    ["jobTitle", { ...REED_RESULT, jobTitle: "" }],
    ["employerName", { ...REED_RESULT, employerName: undefined }],
    ["jobUrl", { ...REED_RESULT, jobUrl: "data:text/html,x" }],
    ["jobDescription", { ...REED_RESULT, jobDescription: "  " }],
  ])("skips a listing with a missing/invalid %s", (_field, raw) => {
    expect("error" in normalizeReedJob(raw as never)).toBe(true);
  });
});
