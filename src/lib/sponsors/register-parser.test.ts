import { describe, expect, it } from "vitest";
import * as parser from "../../../scripts/sponsor-register-parser.mjs";

// Every row below is a real line from the Home Office register (the publication the importer downloads), including
// the awkward ones the importer's comments cite: quoted names containing commas, "T/A" trading names, leading spaces,
// provisional / B-rating / SME+ ratings, and one company appearing once per route.

const HEADER = "Organisation Name,Town/City,County,Type & Rating,Route";
const REAL_CSV = [
  HEADER,
  `" PINAL DAYA, T/A LONDIS",NORTHAMPTON,,Worker (A rating),Skilled Worker`,
  `Rolls-Royce plc,Derby,,Temporary Worker (A rating),Global Business Mobility: Graduate Trainee`,
  `Rolls-Royce plc,Derby,,Worker (A rating),Global Business Mobility: Senior or Specialist Worker`,
  `Rolls-Royce plc,Derby,,Worker (A rating),Skilled Worker`,
  `Rolls-Royce plc,Derby,,Worker (A rating),Skilled Worker`, // an exact duplicate row is collapsed
  `Rolls-Royce plc,Bristol,,Worker (A rating),Skilled Worker`, // same company, another town = another sponsor
  ` BRANOS OXFORD LTD T/A LILO,Oxford,,Worker (A rating),Skilled Worker`,
  `A Better Carehome Ltd T/As Breton Court ,Tenterden ,Kent ,Worker (B rating),Skilled Worker`,
  `English National Ballet,London,,Worker (A (SME+)),Skilled Worker`,
  ` RAINBOW POLYCARBONATE INDUSTRY TRADE LTD,London,,Worker (UK Expansion Worker: Provisional ),Global Business Mobility: UK Expansion Worker`,
  `No Town Ltd,,,Worker (A rating),Skilled Worker`,
  `,London,,Worker (A rating),Skilled Worker`, // a blank organisation name identifies nothing
  `Routeless Ltd,London,,Worker (A rating),`, // no route: nothing to rate it by
  "",
].join("\r\n");

describe("parseCsv", () => {
  it("keeps commas inside quoted fields and handles CRLF + a trailing blank line", () => {
    const rows = parser.parseCsv(REAL_CSV);
    expect(rows[0]).toEqual(["Organisation Name", "Town/City", "County", "Type & Rating", "Route"]);
    expect(rows[1]).toEqual([" PINAL DAYA, T/A LONDIS", "NORTHAMPTON", "", "Worker (A rating)", "Skilled Worker"]);
    expect(rows.at(-1)).toEqual(["Routeless Ltd", "London", "", "Worker (A rating)", ""]);
  });

  it("un-doubles escaped quotes", () => {
    expect(parser.parseCsv(`"The ""Best"" Co",X,,Worker (A rating),Skilled Worker\n`)[0][0]).toBe('The "Best" Co');
  });
});

describe("validateHeader", () => {
  it("accepts the register's five columns", () => {
    expect(() => parser.validateHeader(HEADER.split(","))).not.toThrow();
  });
  it("refuses a changed format rather than misreading it", () => {
    expect(() => parser.validateHeader(["Name", "Town", "County", "Rating", "Route"])).toThrow(/Unexpected CSV header/);
    expect(() => parser.validateHeader(["Organisation Name", "Town/City", "County", "Type & Rating"])).toThrow(/Unexpected CSV header/);
  });
});

describe("bucketRating", () => {
  it.each([
    ["Worker (A rating)", "a_rating"],
    ["Temporary Worker (A rating)", "a_rating"],
    ["Worker (A (SME+))", "a_rating"],
    ["Worker (UK Expansion Worker: Provisional )", "a_rating_provisional"],
    ["Worker (B rating)", "b_rating"],
    ["Something the Home Office invents next year", "other"],
  ])("%s -> %s", (raw, expected) => {
    expect(parser.bucketRating(raw)).toBe(expected);
  });
});

describe("splitLegalAndTradingName", () => {
  it("splits legal and trading halves and trims leftover punctuation", () => {
    expect(parser.splitLegalAndTradingName("PINAL DAYA, T/A LONDIS")).toEqual({ legalName: "PINAL DAYA", tradingName: "LONDIS" });
    expect(parser.splitLegalAndTradingName("HAH Hospitality Limited t/a Indian Affair Ancoats")).toEqual({
      legalName: "HAH Hospitality Limited",
      tradingName: "Indian Affair Ancoats",
    });
    expect(parser.splitLegalAndTradingName("A Better Carehome Ltd T/As Breton Court")).toEqual({ legalName: "A Better Carehome Ltd", tradingName: "Breton Court" });
    expect(parser.splitLegalAndTradingName("Foo Ltd trading as Bar")).toEqual({ legalName: "Foo Ltd", tradingName: "Bar" });
  });
  it("never invents a trading name", () => {
    expect(parser.splitLegalAndTradingName("Rolls-Royce plc")).toBeNull();
    expect(parser.splitLegalAndTradingName("Tea Ltd")).toBeNull();
    expect(parser.splitLegalAndTradingName("Foo t/a ")).toBeNull();
  });
});

describe("extractSourceDate", () => {
  it("reads the Home Office's own publication date from the filename", () => {
    expect(parser.extractSourceDate("https://assets.publishing.service.gov.uk/media/abc/SP_-_Worker_and_Temporary_Worker_Web_Register_-_2026-09-24.csv")).toBe("2026-09-24");
    expect(parser.extractSourceDate("https://x.gov.uk/f_2026-01-02.csv?token=1")).toBe("2026-01-02");
  });
});

describe("aggregateRows", () => {
  const rows = parser.parseCsv(REAL_CSV).slice(1);
  const { sponsors, skippedBlankName, skippedNoRoute } = parser.aggregateRows(rows);
  const byName = (name: string, town: string | null) => [...sponsors.values()].find((s: { companyName: string; townCity: string | null }) => s.companyName === name && s.townCity === town);

  it("makes one sponsor per (company, town) with every distinct route and its own rating", () => {
    const derby = byName("Rolls-Royce plc", "Derby");
    expect([...derby.routes.values()].map((r: { route: string }) => r.route).sort()).toEqual([
      "Global Business Mobility: Graduate Trainee",
      "Global Business Mobility: Senior or Specialist Worker",
      "Skilled Worker",
    ]);
    expect(byName("Rolls-Royce plc", "Bristol")).toBeDefined();
    expect(sponsors.size).toBe(8);
  });

  it("keeps the register's original name for display and a normalized one as the key", () => {
    const londis = byName("PINAL DAYA, T/A LONDIS", "NORTHAMPTON");
    expect(londis.companyNameNormalized).toBe("pinal daya, t/a londis");
    expect(londis.townCityNormalized).toBe("northampton");
    expect(byName("BRANOS OXFORD LTD T/A LILO", "Oxford").companyName).toBe("BRANOS OXFORD LTD T/A LILO"); // whitespace collapsed, case kept
  });

  it("records legal and trading names as aliases without touching the name", () => {
    const londis = byName("PINAL DAYA, T/A LONDIS", "NORTHAMPTON");
    expect([...londis.aliases.values()].map((a: { aliasType: string; aliasName: string }) => `${a.aliasType}:${a.aliasName}`).sort()).toEqual(["legal_name:PINAL DAYA", "trading_as:LONDIS"]);
    expect(byName("Rolls-Royce plc", "Derby").aliases.size).toBe(0);
  });

  it("keeps county, tolerates a missing town, and skips unusable rows with counts", () => {
    expect(byName("A Better Carehome Ltd T/As Breton Court", "Tenterden").county).toBe("Kent");
    expect(byName("No Town Ltd", null).townCityNormalized).toBeNull();
    expect(skippedBlankName).toBe(1);
    expect(skippedNoRoute).toBe(1);
  });

  it("buckets each route's rating", () => {
    const rating = (name: string, town: string) => [...byName(name, town).routes.values()][0].rating;
    expect(rating("English National Ballet", "London")).toBe("a_rating");
    expect(rating("A Better Carehome Ltd T/As Breton Court", "Tenterden")).toBe("b_rating");
    expect(rating("RAINBOW POLYCARBONATE INDUSTRY TRADE LTD", "London")).toBe("a_rating_provisional");
  });

  it("picks the best rating across a sponsor's routes for its summary", () => {
    const routes = [
      { route: "Skilled Worker", rating: "b_rating" },
      { route: "Creative Worker", rating: "a_rating" },
    ];
    expect(parser.bestRating(routes).rating).toBe("a_rating");
  });
});
