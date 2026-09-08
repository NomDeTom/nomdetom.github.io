#!/usr/bin/env node
// Fetches MLCC characteristic curves from the Samsung Electro-Mechanics
// component library and writes them into mlcc-derating-lookup.html between the
// MLCC-DATA markers.
//
//   node scripts/fetch-mlcc-curves.mjs                 # refresh every part already in the page
//   node scripts/fetch-mlcc-curves.mjs CL10A226MQ8NRN  # add or refresh specific parts
//   node scripts/fetch-mlcc-curves.mjs --missing        # only parts with no curves yet
//
// Part numbers are matched leniently: the packaging suffix is often dropped or
// mistyped, so an exact miss falls back to trimming trailing characters and
// then to a prefix match against the library's own part list.
//
// Only Samsung publishes these curves as page data. Parts from other vendors
// stay in the MANUAL_PARTS table below with specs but no curves, and the page
// reports them as having no derating data rather than guessing. Murata parts are
// handled by fetch-murata-curves.mjs instead.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "mlcc-derating-lookup.html");
const START = "/* MLCC-DATA-START */";
const END = "/* MLCC-DATA-END */";

const flags = new Set(
  process.argv.slice(2).filter((a) => a.startsWith("--")),
);

const DATASHEET =
  "https://weblib.samsungsem.com/mlcc/mlcc-ec-data-sheet.do?partNumber=";
const LIBRARY = "https://weblib.samsungsem.com/mlcc/mlcc-ec.do";

// Vendors that publish no machine-readable curves. Specs are transcribed from
// the vendor part number and datasheet. Murata is not among them: its curves
// come from fetch-murata-curves.mjs, which owns those rows.
const MANUAL_PARTS = [
  {
    pn: "CC0603KRX7R9BB104",
    vendor: "Yageo",
    cap: 0.1,
    tol: "±10%",
    vdc: 50,
    tcc: "X7R",
    size: "0603",
    dims: "1.60 x 0.80 x 0.80 mm",
  },
];

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
  });
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
  return res.text();
}

// The library page embeds its whole part list, which is what makes lenient
// matching possible without a search API.
let catalogPromise = null;
function catalog() {
  if (!catalogPromise) {
    catalogPromise = get(LIBRARY).then((html) => {
      const found = html.match(/CL[0-9]{2}[A-Z][0-9]{3}[A-Z][A-Z0-9]{4,9}/g);
      return Array.from(new Set(found || []));
    });
  }
  return catalogPromise;
}

async function candidates(pn) {
  const raw = pn.trim().toUpperCase();
  const list = [raw, raw.slice(0, -1), raw.slice(0, -2)];
  const all = await catalog();
  for (const trimmed of [raw, raw.slice(0, -1), raw.slice(0, -2)]) {
    for (const entry of all) {
      if (entry.startsWith(trimmed) && !list.includes(entry)) list.push(entry);
    }
  }
  return list.filter(Boolean);
}

function extractJSON(html) {
  const at = html.indexOf("var datasheetData = [");
  if (at < 0) return null;
  const open = html.indexOf("[", at);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") {
      depth--;
      if (!depth) return JSON.parse(html.slice(open, i + 1));
    }
  }
  return null;
}

// The spec table has one data row, whose cells run: capacitance, tolerance,
// rated Vdc, TCC, size, length, width, thickness.
function specCells(html) {
  const at = html.indexOf('<th scope="row">Value</th>');
  if (at < 0) return [];
  const row = html.slice(at, html.indexOf("</tr>", at));
  const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
  return cells.map((cell) =>
    cell
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

const round = (v, digits = 4) => Number(Number(v).toPrecision(digits));

// Keeps the shape of a curve while cutting the point count, by walking the x
// axis in even steps of its own index range.
function thin(points, keep) {
  if (points.length <= keep) return points;
  const out = [];
  const step = (points.length - 1) / (keep - 1);
  for (let i = 0; i < keep; i++) out.push(points[Math.round(i * step)]);
  return out;
}

function seriesOf(data, type, pick) {
  for (const group of data) {
    if (group.graphType !== type) continue;
    for (const part of group.selectPartsList) {
      for (const chart of part.chartList) {
        if (!pick || pick(chart, part)) {
          return {
            part,
            chart,
            points: chart.data.map((d) => [Number(d.x), Number(d.y)]),
          };
        }
      }
    }
  }
  return null;
}

async function fetchPart(pn) {
  for (const candidate of await candidates(pn)) {
    let html;
    try {
      html = await get(DATASHEET + encodeURIComponent(candidate));
    } catch {
      continue;
    }
    const data = extractJSON(html);
    if (!data) continue;

    const dcBias = seriesOf(data, "DCBias");
    const tcc = seriesOf(data, "TCC", (c) => c.graphSubType === "TCC");
    const biasTcc = seriesOf(data, "TCC", (c) => c.graphSubType === "BiasTCC");
    const z = seriesOf(data, "|Z|_R", (c) => c.graphSubType === "|Z|");
    const esr = seriesOf(data, "|Z|_R", (c) => c.graphSubType === "R");
    if (!dcBias) continue;

    const ripple = [];
    for (const group of data) {
      if (group.graphType !== "RippleCurr") continue;
      for (const part of group.selectPartsList) {
        for (const chart of part.chartList) {
          ripple.push({
            khz: Number(chart.rippleFreq),
            points: thin(
              chart.data.map((d) => [round(d.x, 4), round(d.y, 4)]),
              16,
            ),
          });
        }
      }
    }

    const cells = specCells(html);
    const capText = cells[0] || "";
    return {
      pn: pn.trim().toUpperCase(),
      resolved: candidate,
      vendor: "Samsung",
      cap: Number(capText.replace(/[^0-9.]/g, "")) || null,
      capUnit: /nF/i.test(capText) ? "nF" : /pF/i.test(capText) ? "pF" : "uF",
      tol: cells[1] || "",
      vdc: Number(String(cells[2] || "").replace(/[^0-9.]/g, "")),
      tcc: cells[3] || "",
      size: (cells[4] || "").split("(")[0].trim(),
      dims: [cells[5], cells[6], cells[7]].filter(Boolean).join(" x "),
      dcBias: thin(dcBias.points, 41).map(([v, d]) => [round(v, 4), round(d, 4)]),
      dcBiasAc: dcBias.part.dsDcSign ?? null,
      dcBiasFreq: dcBias.part.dsDcFre ?? null,
      tcc25: tcc ? thin(tcc.points, 21).map(([t, d]) => [t, round(d, 4)]) : null,
      tccBias: biasTcc
        ? thin(biasTcc.points, 21).map(([t, d]) => [t, round(d, 4)])
        : null,
      tccBiasVdc: biasTcc ? biasTcc.part.dsBiasVdc : null,
      // Impedance and ESR share an x axis in MHz.
      freq: z ? thin(z.points, 41).map(([f]) => round(f, 4)) : null,
      z: z ? thin(z.points, 41).map(([, v]) => round(v, 4)) : null,
      esr: esr ? thin(esr.points, 41).map(([, v]) => round(v, 4)) : null,
      ripple,
    };
  }
  throw new Error("no datasheet data found for " + pn);
}

function existingRows(page) {
  const at = page.indexOf(START);
  const to = page.indexOf(END);
  if (at < 0 || to < 0) return [];
  const body = page.slice(at + START.length, to);
  const json = body.slice(body.indexOf("["), body.lastIndexOf("]") + 1);
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function existingParts(page) {
  return existingRows(page).map((part) => part.pn);
}

async function main() {
  const page = await readFile(PAGE, "utf8");
  const asked = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const wanted = asked.length ? asked : existingParts(page);
  if (!wanted.length) {
    console.error("No parts given and none found in the page.");
    process.exit(1);
  }

  const parts = existingRows(page);
  const byPn = new Map(parts.map((part) => [part.pn.toUpperCase(), part]));

  function upsert(entry) {
    const key = entry.pn.toUpperCase();
    const existing = byPn.get(key);
    if (existing) {
      Object.assign(existing, entry);
      return existing;
    }
    parts.push(entry);
    byPn.set(key, entry);
    return entry;
  }

  let fetched = 0;
  let skipped = 0;
  for (const pn of wanted) {
    const key = pn.trim().toUpperCase();
    // Only Samsung publishes these curves; anything else keeps whatever specs
    // it already has and is reported as having none.
    if (!/^CL[0-9]/.test(key)) {
      const manual = MANUAL_PARTS.find((m) => m.pn.toUpperCase() === key);
      if (manual) upsert({ ...manual, capUnit: "uF", resolved: manual.pn });
      if (!byPn.has(key)) {
        console.log(pn + "  no curves published, skipped");
      }
      skipped++;
      continue;
    }
    if (flags.has("--missing") && byPn.get(key)?.dcBias) {
      skipped++;
      continue;
    }
    try {
      const part = await fetchPart(pn);
      upsert(part);
      fetched++;
      console.log(
        part.pn +
          (part.resolved === part.pn ? "" : " -> " + part.resolved) +
          "  " +
          part.cap +
          part.capUnit +
          " " +
          part.vdc +
          "V " +
          part.tcc +
          " " +
          part.size,
      );
    } catch (err) {
      console.error(pn + "  FAILED: " + err.message);
    }
  }
  console.log(
    "\n" + fetched + " parts with curves fetched, " + skipped + " skipped.",
  );

  const body =
    START +
    "\n      window.MLCC_PARTS = " +
    JSON.stringify(parts) +
    ";\n      " +
    END;
  const at = page.indexOf(START);
  const to = page.indexOf(END);
  if (at < 0 || to < 0) throw new Error("markers not found in " + PAGE);
  await writeFile(PAGE, page.slice(0, at) + body + page.slice(to + END.length));
  console.log("\nWrote " + parts.length + " parts into the page.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
