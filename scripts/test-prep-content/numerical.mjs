// Numerical reasoning questions, generated from templates so the arithmetic is right by construction. Each template picks
// its answer first and builds the numbers around it, so every answer is exact and "nice"; every distractor is the result of
// a *specific, common mistake* (using the wrong base, subtracting a percentage instead of dividing, forgetting to compound,
// swapping a ratio), which is what makes the explanations useful. Company and product names are invented.

import { makeRng } from "./rng.mjs";

const COMPANIES = ["Harlow & Finch", "Brightwater Foods", "Norvale Logistics", "Kestrel Components", "Ashdown Retail", "Marlowe Energy", "Quayside Media", "Tamsin Pharma", "Ironbridge Fabrication", "Lindqvist Textiles"];
const PRODUCTS = ["office chairs", "solar panels", "garden tools", "bicycle helmets", "water filters", "desk lamps", "storage boxes", "phone cases"];
const REGIONS = ["North", "South", "East", "West", "Central"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const gbp = (n) => `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const num = (n) => Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const pct = (n) => `${Number.isInteger(n) ? n : Number(n.toFixed(1))}%`;
const round1 = (n) => Math.round(n * 10) / 10;

function assertNice(value, label) {
  if (!Number.isFinite(value) || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) throw new Error(`numerical generator: ${label} = ${value} isn't a clean value`);
}

/** Four options (the answer + three distractors), the answer in a random place. Distractors that duplicate the answer or each other are replaced by nearby values. */
function finish(rng, { subtype, difficulty, prompt, exhibit, answer, distractors, format, explanation }) {
  const formatted = format(answer);
  const seen = new Set([formatted]);
  const options = [formatted];
  for (const d of distractors) {
    const f = format(d);
    if (!seen.has(f) && (typeof d === "string" || Number.isFinite(d))) {
      seen.add(f);
      options.push(f);
    }
    if (options.length === 4) break;
  }
  let bump = 1;
  while (options.length < 4) {
    if (typeof answer === "string") throw new Error("numerical generator: text answers need four distinct distractors");
    const candidate = format(round1(answer * (1 + 0.1 * bump * (bump % 2 ? 1 : -1))));
    if (!seen.has(candidate)) {
      seen.add(candidate);
      options.push(candidate);
    }
    bump++;
    if (bump > 40) throw new Error(`numerical generator: could not make four distinct options around ${answer}`);
  }
  return { subtype, difficulty, prompt, ...(exhibit ? { exhibit } : {}), options: rng.shuffle(options), correct: formatted, explanation };
}

// ---- percentages ---------------------------------------------------------------------------------------------------
function percentageOf(rng) {
  const company = rng.pick(COMPANIES);
  const p = rng.pick([12, 15, 18, 22, 35, 45, 60, 65]);
  const total = rng.pick([240, 360, 480, 640, 800, 1200, 1600, 2400]) * 100;
  const answer = (total * p) / 100;
  assertNice(answer, "percentageOf");
  return finish(rng, {
    subtype: "Percentages",
    difficulty: "easy",
    prompt: `${company} had sales of ${gbp(total)} last year. ${p}% of those sales were made online. How much were the online sales?`,
    answer,
    distractors: [total - answer, (total * p) / 1000, total / p, (total * (100 - p)) / 100 + 1000],
    format: gbp,
    explanation: `${p}% of ${gbp(total)} is ${gbp(total)} × ${p} ÷ 100 = ${gbp(answer)}. ${gbp(total - answer)} is what is left after taking the online sales away, not the online sales themselves.`,
  });
}

function percentageChange(rng) {
  const company = rng.pick(COMPANIES);
  const decrease = rng.next() < 0.4;
  const from = rng.pick([80, 120, 160, 200, 250, 400, 500]);
  const change = rng.pick([5, 10, 15, 20, 25, 30, 40]);
  const to = decrease ? (from * (100 - change)) / 100 : (from * (100 + change)) / 100;
  assertNice(to, "percentageChange");
  const metric = rng.pick(["monthly sales (thousand units)", "staff numbers", "weekly orders", "website visits (thousand)"]);
  const wrongBase = round1(((Math.abs(to - from)) / to) * 100);
  return finish(rng, {
    subtype: "Percentage change",
    difficulty: "medium",
    prompt: `At ${company}, ${metric} ${decrease ? "fell" : "rose"} from ${num(from)} to ${num(to)}. What was the percentage ${decrease ? "decrease" : "increase"}?`,
    answer: change,
    distractors: [wrongBase, Math.abs(to - from), round1(change / 2), change + 5],
    format: pct,
    explanation: `The change is ${num(Math.abs(to - from))}, and percentage change is measured against the starting figure: ${num(Math.abs(to - from))} ÷ ${num(from)} × 100 = ${change}%. Dividing by the new figure gives ${pct(wrongBase)}, which is the common slip.`,
  });
}

function reversePercentage(rng) {
  const product = rng.pick(PRODUCTS);
  const mode = rng.pick(["vat", "discount"]);
  const original = rng.pick([40, 60, 80, 120, 150, 200, 250, 400]);
  const rate = mode === "vat" ? 20 : rng.pick([10, 20, 25, 30]);
  const final = mode === "vat" ? (original * 120) / 100 : (original * (100 - rate)) / 100;
  assertNice(final, "reversePercentage");
  const wrong = mode === "vat" ? final - (final * 20) / 100 : final + (final * rate) / 100;
  return finish(rng, {
    subtype: "Percentages",
    difficulty: "hard",
    prompt:
      mode === "vat"
        ? `A shop sells ${product} for ${gbp(final)} including VAT at 20%. What is the price before VAT?`
        : `${product[0].toUpperCase()}${product.slice(1)} are on sale with ${rate}% off. The sale price is ${gbp(final)}. What was the price before the discount?`,
    answer: original,
    distractors: [wrong, final - rate, final * 0.8, final + 20],
    format: gbp,
    explanation:
      mode === "vat"
        ? `The price with VAT is 120% of the price before VAT, so divide by 1.2: ${gbp(final)} ÷ 1.2 = ${gbp(original)}. Taking 20% off ${gbp(final)} gives ${gbp(wrong)}, because 20% of the larger figure is more than 20% of the original.`
        : `The sale price is ${100 - rate}% of the original, so divide by ${(100 - rate) / 100}: ${gbp(final)} ÷ ${(100 - rate) / 100} = ${gbp(original)}. Adding ${rate}% back onto the sale price gives ${gbp(wrong)}, which is wrong because the ${rate}% was taken off the larger, original figure.`,
  });
}

function successiveChange(rng) {
  const up = rng.pick([10, 20, 25, 50]);
  const down = rng.pick([10, 20, 25, 40]);
  const start = 100;
  const end = (start * (100 + up) * (100 - down)) / 10000;
  assertNice(end, "successiveChange");
  const net = round1(end - 100);
  if (net === 0) return successiveChange(rng); // a net change of nothing has no sensible "increase/decrease" wording
  const label = (n) => (n >= 0 ? `an increase of ${pct(Math.abs(n))}` : `a decrease of ${pct(Math.abs(n))}`);
  const answerText = label(net);
  const wrongNet = up - down;
  const company = rng.pick(COMPANIES);
  return {
    ...finish(rng, {
      subtype: "Percentage change",
      difficulty: "hard",
      prompt: `The share price of ${company} rose by ${up}% in one month and then fell by ${down}% the next. Overall, what was the change over the two months?`,
      answer: net,
      distractors: [wrongNet, up + down, -down, wrongNet / 2],
      format: (n) => label(n),
      explanation: `Treat the start as 100. After the ${up}% rise it is ${100 + up}; a ${down}% fall from that is ${100 + up} × ${(100 - down) / 100} = ${round1(end)}. The overall change is ${label(net)}. Simply subtracting the percentages (${up} − ${down} = ${wrongNet}) is wrong because the second percentage applies to a different base.`,
    }),
    // finish() formats the correct option with the same label function
    _answerText: answerText,
  };
}

function compoundInterest(rng) {
  const principal = rng.pick([1000, 2000, 2500, 4000, 5000, 8000]);
  const rate = rng.pick([2, 3, 4, 5, 10]);
  const years = 2;
  const amount = round1(principal * (1 + rate / 100) ** years * 100) / 100;
  const value = Math.round(principal * (1 + rate / 100) ** years * 100) / 100;
  assertNice(value, "compoundInterest");
  const simple = principal + (principal * rate * years) / 100;
  return finish(rng, {
    subtype: "Interest",
    difficulty: "hard",
    prompt: `${gbp(principal)} is invested at ${rate}% interest per year, with the interest added to the balance each year. What is the balance after ${years} years?`,
    answer: value,
    distractors: [simple, principal * (1 + rate / 100), value + principal * (rate / 100), principal + principal * (rate / 100) * (years + 1)],
    format: gbp,
    explanation: `Each year the balance is multiplied by ${1 + rate / 100}: ${gbp(principal)} × ${1 + rate / 100} × ${1 + rate / 100} = ${gbp(value)}. Simple interest (${gbp(simple)}) ignores the interest earned on the first year's interest.`,
    // amount kept only to make the intent of round-off explicit
    _unused: amount,
  });
}

// ---- ratios, averages, rates ---------------------------------------------------------------------------------------
function ratioSplit(rng) {
  const [a, b, c] = rng.pick([[2, 3, 5], [1, 4, 5], [3, 4, 5], [2, 5, 3], [1, 2, 3]]);
  const unit = rng.pick([150, 200, 250, 400, 500, 600]);
  const total = (a + b + c) * unit;
  const target = rng.pick(["second", "third"]);
  const part = target === "second" ? b : c;
  const answer = part * unit;
  const company = rng.pick(COMPANIES);
  return finish(rng, {
    subtype: "Ratios",
    difficulty: "medium",
    prompt: `${company} divides a ${gbp(total)} bonus pool between three teams in the ratio ${a} : ${b} : ${c}. How much does the ${target} team receive?`,
    answer,
    distractors: [(total * part) / 100, total / 3, (a + b + c) * part * (unit / 10), answer + unit],
    format: gbp,
    explanation: `The ratio has ${a + b + c} parts in total, so one part is ${gbp(total)} ÷ ${a + b + c} = ${gbp(unit)}. The ${target} team gets ${part} parts: ${part} × ${gbp(unit)} = ${gbp(answer)}. Sharing equally (${gbp(total / 3)}) ignores the ratio.`,
  });
}

function missingAverage(rng) {
  const n = 5;
  const target = rng.pick([62, 64, 70, 72, 75, 80]);
  const values = Array.from({ length: n }, () => target + rng.int(-9, 9));
  const missing = rng.int(target - 6, target + 6) + (rng.next() < 0.5 ? 6 : -6);
  const total = target * (n + 1);
  const known = values.reduce((sum, v) => sum + v, 0);
  const answer = total - known;
  if (answer < 30 || answer > 100) return missingAverage(rng);
  const mean5 = round1(known / n);
  return finish(rng, {
    subtype: "Averages",
    difficulty: "medium",
    prompt: `A trainee's scores in five assessments were ${values.join(", ")}. What score does she need in the sixth assessment for her mean score across all six to be exactly ${target}?`,
    answer,
    distractors: [target, round1(2 * target - mean5), answer + n, answer - n, target + (target - mean5)],
    format: (v) => num(v),
    explanation: `Six scores averaging ${target} must total ${6 * target}. The first five total ${known}, so the sixth must be ${6 * target} − ${known} = ${answer}. Scoring the target itself (${target}) would only work if the first five already averaged ${target}; their mean is ${mean5}.`,
    _unused: missing,
  });
}

function ratePerHour(rng) {
  const product = rng.pick(PRODUCTS);
  const machines = rng.pick([3, 4, 5, 6]);
  const hours = rng.pick([2, 3, 4]);
  const perMachineHour = rng.pick([12, 15, 20, 25, 30]);
  const units = machines * hours * perMachineHour;
  const newMachines = machines + rng.pick([1, 2, 3]);
  const newHours = hours + rng.pick([1, 2, 4]);
  const answer = newMachines * newHours * perMachineHour;
  return finish(rng, {
    subtype: "Rates",
    difficulty: "medium",
    prompt: `${machines} identical machines make ${num(units)} ${product} in ${hours} hours. How many ${product} would ${newMachines} of the same machines make in ${newHours} hours?`,
    answer,
    distractors: [(units * newMachines) / machines, (units * newHours) / hours, answer + perMachineHour * newMachines, units + (newMachines - machines) * perMachineHour],
    format: (v) => num(v),
    explanation: `One machine makes ${num(units)} ÷ ${machines} ÷ ${hours} = ${perMachineHour} an hour. ${newMachines} machines for ${newHours} hours: ${newMachines} × ${newHours} × ${perMachineHour} = ${num(answer)}. Scaling by only the machines or only the hours (${num((units * newMachines) / machines)}, ${num((units * newHours) / hours)}) misses the other factor.`,
  });
}

function currencyConversion(rng) {
  const rate = rng.pick([1.1, 1.2, 1.25, 1.3, 1.4, 1.5]);
  const gbpAmount = rng.pick([200, 400, 500, 800, 1000, 1200]);
  const foreign = round1(gbpAmount * rate * 100) / 100;
  const direction = rng.pick(["to", "from"]);
  const currency = rng.pick(["euros", "Canadian dollars", "Swiss francs"]);
  const symbol = { euros: "€", "Canadian dollars": "C$", "Swiss francs": "CHF " }[currency];
  const money = (v) => `${symbol}${Number(v).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
  if (direction === "to") {
    assertNice(foreign, "currency to");
    return finish(rng, {
      subtype: "Currency",
      difficulty: "easy",
      prompt: `The exchange rate is £1 = ${rate.toFixed(2)} ${currency}. How many ${currency} do you get for ${gbp(gbpAmount)}?`,
      answer: foreign,
      distractors: [round1((gbpAmount / rate) * 100) / 100, gbpAmount + rate, gbpAmount * 10 * rate, round1(gbpAmount * (rate - 1) * 100) / 100],
      format: money,
      explanation: `Multiply pounds by the rate: ${gbp(gbpAmount)} × ${rate.toFixed(2)} = ${money(foreign)}. Dividing (${money(round1((gbpAmount / rate) * 100) / 100)}) would be right for converting the other way.`,
    });
  }
  assertNice(foreign, "currency from");
  return finish(rng, {
    subtype: "Currency",
    difficulty: "medium",
    prompt: `The exchange rate is £1 = ${rate.toFixed(2)} ${currency}. A supplier's invoice is for ${money(foreign)}. What is that in pounds?`,
    answer: gbpAmount,
    distractors: [round1(foreign * rate * 100) / 100, foreign - rate, round1(foreign / (rate * rate) * 100) / 100, gbpAmount + 100],
    format: gbp,
    explanation: `Divide by the rate: ${money(foreign)} ÷ ${rate.toFixed(2)} = ${gbp(gbpAmount)}. Multiplying (${gbp(round1(foreign * rate * 100) / 100)}) converts in the wrong direction.`,
  });
}

function averageSpeed(rng) {
  // Pairs whose harmonic mean (the true average speed over equal distances) comes out to one clean decimal place.
  const [s1, s2] = rng.pick([[30, 60], [60, 90], [30, 90], [45, 90], [60, 40], [30, 45], [40, 60]]);
  const d = rng.pick([60, 90, 120, 180]);
  const time = d / s1 + d / s2;
  const nice = round1((2 * d) / time);
  return finish(rng, {
    subtype: "Rates",
    difficulty: "hard",
    prompt: `A delivery van drives ${d} miles to a depot at an average of ${s1} mph, and returns the same ${d} miles at an average of ${s2} mph. What is its average speed for the whole round trip?`,
    answer: nice,
    distractors: [(s1 + s2) / 2, round1((s1 + s2) / 2 + 2), round1(nice + 5), round1(nice - 4)],
    format: (v) => `${num(v)} mph`,
    explanation: `Average speed is total distance ÷ total time. The trip takes ${d}/${s1} + ${d}/${s2} = ${round1(time)} hours for ${2 * d} miles, so ${2 * d} ÷ ${round1(time)} = ${num(nice)} mph. Averaging the two speeds (${num((s1 + s2) / 2)}) ignores that more time is spent at the slower speed.`,
  });
}

// ---- tables and charts ---------------------------------------------------------------------------------------------
function regionTable(rng) {
  const company = rng.pick(COMPANIES);
  const regions = rng.shuffle(REGIONS).slice(0, 4);
  const values = regions.map(() => rng.pick([120, 150, 180, 210, 240, 270, 300, 330]));
  const totals = values.map((v) => v);
  const rows = regions.map((r, i) => [r, `${values[i]}`]);
  const total = totals.reduce((s, v) => s + v, 0);
  const kind = rng.pick(["share", "difference", "highest-share"]);
  const exhibit = { kind: "table", caption: `${company}: revenue by region, last year (£ thousand)`, headers: ["Region", "Revenue (£000)"], rows: [...rows, ["Total", `${total}`]] };
  if (kind === "difference") {
    const [i, j] = rng.shuffle([0, 1, 2, 3]).slice(0, 2);
    const answer = Math.abs(values[i] - values[j]);
    if (answer === 0) return regionTable(rng);
    return finish(rng, {
      subtype: "Table reading",
      difficulty: "easy",
      prompt: `How much more revenue (in £ thousand) did the ${values[i] > values[j] ? regions[i] : regions[j]} region earn than the ${values[i] > values[j] ? regions[j] : regions[i]} region?`,
      exhibit,
      answer,
      distractors: [values[i] + values[j], answer + 30, answer - 30, total - values[i] - values[j], answer + 60].filter((v) => v > 0),
      format: (v) => `£${num(v)}k`,
      explanation: `Subtract the smaller figure from the larger: ${Math.max(values[i], values[j])} − ${Math.min(values[i], values[j])} = ${answer} (£${answer}k).`,
    });
  }
  if (kind === "highest-share") {
    const best = values.indexOf(Math.max(...values));
    if (values.filter((v) => v === values[best]).length > 1) return regionTable(rng);
    const share = round1((values[best] / total) * 100);
    return finish(rng, {
      subtype: "Table reading",
      difficulty: "medium",
      prompt: `What percentage of ${company}'s total revenue came from its highest-earning region? (Give the nearest whole percent.)`,
      exhibit,
      answer: Math.round(share),
      distractors: [Math.round((values[best] / (total - values[best])) * 100), Math.round(share) + 5, Math.round(share) - 4, Math.round((values[best] / 400) * 100)],
      format: pct,
      explanation: `The highest region is ${regions[best]} with ${values[best]} out of ${total}: ${values[best]} ÷ ${total} × 100 = ${share}%, or ${Math.round(share)}% to the nearest whole percent. Dividing by the total of the *other* regions overstates it.`,
    });
  }
  const pick = rng.int(0, 3);
  const exact = round1((values[pick] / total) * 100);
  return finish(rng, {
    subtype: "Table reading",
    difficulty: "medium",
    prompt: `What percentage of the total revenue came from the ${regions[pick]} region? (Give the nearest whole percent.)`,
    exhibit,
    answer: Math.round(exact),
    distractors: [Math.round((values[pick] / (total - values[pick])) * 100), Math.round(exact) + 4, Math.round(exact) - 3, Math.round(values[pick] / 10)],
    format: pct,
    explanation: `${regions[pick]} earned ${values[pick]} of ${total}: ${values[pick]} ÷ ${total} × 100 = ${exact}%, which is ${Math.round(exact)}% to the nearest whole percent.`,
  });
}

function quarterlyTable(rng) {
  const company = rng.pick(COMPANIES);
  const base = rng.pick([80, 100, 120, 150]);
  const revenue = QUARTERS.map((_, i) => base + i * rng.pick([10, 15, 20]) + rng.pick([0, 5]));
  const costRatio = rng.pick([60, 70, 75, 80]);
  const costs = revenue.map((r) => (r * costRatio) / 100);
  costs.forEach((c) => assertNice(c, "cost"));
  const exhibit = {
    kind: "table",
    caption: `${company}: quarterly results (£ thousand)`,
    headers: ["Quarter", "Revenue", "Costs"],
    rows: QUARTERS.map((q, i) => [q, `${revenue[i]}`, `${costs[i]}`]),
  };
  const qi = rng.int(0, 3);
  const profit = revenue[qi] - costs[qi];
  const margin = round1((profit / revenue[qi]) * 100);
  const mode = rng.pick(["profit", "margin", "yearProfit"]);
  if (mode === "profit") {
    return finish(rng, {
      subtype: "Profit and margin",
      difficulty: "easy",
      prompt: `What was the profit (revenue minus costs) in ${QUARTERS[qi]}?`,
      exhibit,
      answer: profit,
      distractors: [revenue[qi] + costs[qi], costs[qi], profit + 10, revenue[qi] - costs[(qi + 1) % 4]],
      format: (v) => `£${num(v)}k`,
      explanation: `${revenue[qi]} − ${costs[qi]} = ${num(profit)}, so £${num(profit)}k.`,
    });
  }
  if (mode === "margin") {
    return finish(rng, {
      subtype: "Profit and margin",
      difficulty: "medium",
      prompt: `What was the profit margin (profit as a percentage of revenue) in ${QUARTERS[qi]}?`,
      exhibit,
      answer: margin,
      distractors: [round1((profit / costs[qi]) * 100), round1(100 - margin + 5), round1(margin + 5), costRatio],
      format: pct,
      explanation: `Profit is ${revenue[qi]} − ${costs[qi]} = ${num(profit)}. Margin is profit ÷ revenue: ${num(profit)} ÷ ${revenue[qi]} × 100 = ${margin}%. Dividing by costs (${pct(round1((profit / costs[qi]) * 100))}) gives mark-up, not margin.`,
    });
  }
  const yearProfit = revenue.reduce((s, r) => s + r, 0) - costs.reduce((s, c) => s + c, 0);
  return finish(rng, {
    subtype: "Profit and margin",
    difficulty: "medium",
    prompt: "What was the total profit across the four quarters?",
    exhibit,
    answer: yearProfit,
    distractors: [revenue.reduce((s, r) => s + r, 0), yearProfit + revenue[0], yearProfit - costs[0] / 2, costs.reduce((s, c) => s + c, 0)],
    format: (v) => `£${num(v)}k`,
    explanation: `Total revenue is ${revenue.reduce((s, r) => s + r, 0)} and total costs are ${num(costs.reduce((s, c) => s + c, 0))}, so profit is £${num(yearProfit)}k.`,
  });
}

function barChart(rng) {
  const company = rng.pick(COMPANIES);
  const categories = rng.shuffle(["Bikes", "Helmets", "Lights", "Locks", "Pumps", "Bags", "Bottles"]).slice(0, 5);
  const last = categories.map(() => rng.pick([20, 30, 40, 50, 60, 80]));
  const growth = categories.map(() => rng.pick([10, 20, 25, 50, -10, -20]));
  const current = last.map((v, i) => (v * (100 + growth[i])) / 100);
  current.forEach((v) => assertNice(v, "bar"));
  const exhibit = {
    kind: "bar_chart",
    caption: `${company}: units sold by product (thousands)`,
    unit: "Units sold (thousands)",
    categories,
    series: [
      { name: "Last year", values: last },
      { name: "This year", values: current },
    ],
  };
  const mode = rng.pick(["total", "biggestRise", "percentGrowth"]);
  if (mode === "total") {
    const i = rng.int(0, 4);
    const answer = last[i] + current[i];
    return finish(rng, {
      subtype: "Chart reading",
      difficulty: "easy",
      prompt: `How many ${categories[i].toLowerCase()} (in thousands) were sold across the two years combined?`,
      exhibit,
      answer,
      distractors: [Math.abs(current[i] - last[i]), last[i], current[i], answer + 10],
      format: (v) => num(v),
      explanation: `Add the two bars for ${categories[i]}: ${last[i]} + ${num(current[i])} = ${num(answer)} thousand.`,
    });
  }
  if (mode === "biggestRise") {
    const rises = current.map((v, i) => v - last[i]);
    const max = Math.max(...rises);
    if (rises.filter((r) => r === max).length > 1) return barChart(rng);
    const best = rises.indexOf(max);
    const otherBig = rises.map((r, i) => [r, i]).filter(([, i]) => i !== best).sort((a, b) => b[0] - a[0])[0][1];
    return finish(rng, {
      subtype: "Chart reading",
      difficulty: "medium",
      prompt: "Which product had the largest increase in units sold between the two years, and by how many thousand?",
      exhibit,
      answer: `${categories[best]}: +${num(max)}`,
      distractors: [`${categories[otherBig]}: +${num(rises[otherBig])}`, `${categories[best]}: +${num(current[best])}`, `${categories[(best + 1) % 5]}: +${num(Math.abs(rises[(best + 1) % 5]))}`, `${categories[best]}: +${num(max + 10)}`],
      format: (v) => v,
      explanation: `The change for each product is (this year − last year): ${categories.map((c, i) => `${c} ${rises[i] >= 0 ? "+" : ""}${num(rises[i])}`).join(", ")}. The largest rise is ${categories[best]}, +${num(max)} thousand.`,
    });
  }
  const i = rng.int(0, 4);
  const change = growth[i];
  const label = (g) => (g >= 0 ? `+${g}%` : `${g}%`);
  return finish(rng, {
    subtype: "Chart reading",
    difficulty: "medium",
    prompt: `What was the percentage change in ${categories[i].toLowerCase()} sales from last year to this year?`,
    exhibit,
    answer: change,
    distractors: [-change, round1(((current[i] - last[i]) / current[i]) * 100), change > 0 ? change + 10 : change - 10, round1((current[i] - last[i]))],
    format: label,
    explanation: `${categories[i]} moved from ${last[i]} to ${num(current[i])}, a change of ${num(current[i] - last[i])}. Divided by last year's ${last[i]} that is ${label(change)}. Dividing by this year's figure is the usual mistake (${label(round1(((current[i] - last[i]) / current[i]) * 100))}).`,
  });
}

export function generateNumerical() {
  const rng = makeRng(20260926);
  const out = [];
  const add = (pack, factory, times) => {
    for (let i = 0; i < times; i++) out.push({ pack, ...factory(rng) });
  };

  add("data-interpretation", regionTable, 4);
  add("data-interpretation", quarterlyTable, 3);
  add("data-interpretation", barChart, 2);

  add("percentages-and-change", percentageOf, 2);
  add("percentages-and-change", percentageChange, 2);
  add("percentages-and-change", reversePercentage, 2);
  add("percentages-and-change", successiveChange, 2);
  add("percentages-and-change", compoundInterest, 2);

  add("ratios-and-rates", ratioSplit, 2);
  add("ratios-and-rates", missingAverage, 2);
  add("ratios-and-rates", ratePerHour, 2);
  add("ratios-and-rates", currencyConversion, 2);
  add("ratios-and-rates", averageSpeed, 2);

  add("charts-and-tables", barChart, 4);
  add("charts-and-tables", regionTable, 3);
  add("charts-and-tables", quarterlyTable, 3);

  // Templates keep a couple of scratch fields for readability; the bank must contain only real question fields.
  return out.map(({ _answerText, _unused, ...question }) => {
    void _answerText;
    void _unused;
    return question;
  });
}
