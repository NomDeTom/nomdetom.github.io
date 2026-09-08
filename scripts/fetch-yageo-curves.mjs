#!/usr/bin/env node
// Fetches MLCC characteristic curves for YAGEO parts and writes them into
// mlcc-derating-lookup.html between the MLCC-DATA markers.
//
//   node scripts/fetch-yageo-curves.mjs                   # refresh every YAGEO part in the page
//   node scripts/fetch-yageo-curves.mjs CC0805KRX7R9BB104 # add or refresh specific parts
//   node scripts/fetch-yageo-curves.mjs --missing          # only YAGEO parts with no curves yet
//
// Two services, neither needing a key or login, and both YAGEO's own:
//
//   yageogroup.com/search/query/raw    the parameter table behind a part page,
//       which is where the specs and the published dimensions come from
//   search.kemet.com/sim/plot/<pn>     the simulation data behind the "typical
//       electrical performance" chart on that page. YAGEO owns KEMET and serves
//       its CC series from KEMET's simulator, so the host name is not a mistake.
//       Note that ksim3.kemet.com, the interactive tool, does not resolve YAGEO
//       part numbers even though this endpoint serves them.
//
// YAGEO publishes no biased temperature curve, so the page falls back to
// applying the unbiased one at every bias for these parts. Class 1 dielectrics
// (NP0/C0G) legitimately come back with a flat bias curve.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "mlcc-derating-lookup.html");
const START = "/* MLCC-DATA-START */";
const END = "/* MLCC-DATA-END */";

const SEARCH = "https://yageogroup.com/search/query/raw";
const SIM = "https://search.kemet.com/sim/plot/";

// YAGEO's surface-mount MLCC prefixes. Matching the part number as well as the
// vendor string picks up rows seeded by a distributor under another name.
const SERIES = /^(CC|CQ|AC|CG|CS|SC|CT|CB)[0-9]/i;

const AGENT = "Mozilla/5.0";
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function getJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": AGENT, Referer: "https://yageogroup.com/" },
  });
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": AGENT,
      Origin: "https://yageogroup.com",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
  return res.json();
}

// ==================== SPECS ====================

async function fetchSpecs(pn) {
  const res = await postJSON(SEARCH, {
    input: pn,
    targetMfgs: ["YAGEO"],
    targetDefinitionIds: [],
    setting: {
      maxResults: "3",
      minPartialPnLength: "6",
      useDefaultDefinition: false,
      requireQualifyingParameters: false,
    },
  });
  const hit = (res.detectedUniqueParts || []).find(
    (part) => (part.uniquePn || "").toUpperCase() === pn.toUpperCase(),
  );
  if (!hit) return null;
  const values = new Map();
  for (const entry of hit.parameterValues || []) values.set(entry.parameterName, entry.value);
  return values;
}

// "2mm +/-0.2mm" to "2.00±0.20mm", the form the page's body-size parser reads.
function dimension(text) {
  if (!text) return null;
  const value = parseFloat(text);
  if (!isFinite(value)) return null;
  const tolerance = parseFloat((text.match(/\+\/-\s*([0-9.]+)/) || [])[1]);
  return value.toFixed(2) + (isFinite(tolerance) ? "±" + tolerance.toFixed(2) : "") + "mm";
}

// ==================== CURVES ====================

function round(value, digits) {
  if (typeof value !== "number" || !isFinite(value)) return null;
  return parseFloat(value.toPrecision(digits));
}

// Keeps both end points and spreads the rest evenly, so the decimated curve
// still covers the published range exactly.
function decimate(points, target) {
  if (points.length <= target) return points;
  const kept = [];
  for (let i = 0; i < target; i++) {
    kept.push(points[Math.round((i * (points.length - 1)) / (target - 1))]);
  }
  return kept;
}

const asCurve = (rows, xKey, yKey, target) =>
  decimate(
    rows
      .map((row) => [round(row[xKey], 6), round(row[yKey], 4)])
      .filter(([x, y]) => x !== null && y !== null),
    target,
  );

async function fetchPart(pn) {
  const [sim, specs] = await Promise.all([getJSON(SIM + encodeURIComponent(pn)), fetchSpecs(pn)]);
  if (!sim || typeof sim !== "object") throw new Error("no simulation data returned");

  const entry = { pn, resolved: sim.part_number || pn };

  if (specs) {
    const dims = [
      dimension(specs.get("L")),
      dimension(specs.get("W")),
      dimension(specs.get("T")),
    ];
    const tolerance = specs.get("Capacitance Tolerance");
    if (tolerance) entry.tol = tolerance.startsWith("±") ? tolerance : "±" + tolerance;
    const vdc = parseFloat(specs.get("Compare Voltage DC"));
    if (isFinite(vdc)) entry.vdc = vdc;
    if (specs.get("Temperature Coefficient")) entry.tcc = specs.get("Temperature Coefficient");
    if (specs.get("Chip Size")) entry.size = specs.get("Chip Size");
    if (dims.every(Boolean)) entry.dims = dims.join(" x ");
  }

  const bias = asCurve(sim.vbias_values || [], "vbias", "capacitance_change_percent", 71);
  if (bias.length) entry.dcBias = bias;

  const tcc = asCurve(sim.tcc_values || [], "temperature", "capacitance_change_percent", 61);
  if (tcc.length) entry.tcc25 = tcc;

  // The simulator reports frequency in hertz; the page plots megahertz.
  const freq = decimate(
    (sim.frequency_values || [])
      .map((row) => [round(row.frequency / 1e6, 4), round(row.impedance, 4), round(row.esr, 4)])
      .filter((row) => row.every((v) => v !== null && v > 0)),
    61,
  );
  if (freq.length) {
    entry.freq = freq.map((row) => row[0]);
    entry.z = freq.map((row) => row[1]);
    entry.esr = freq.map((row) => row[2]);
  }

  // ripple_current has its two fields transposed; ripple_currentV2 is the one
  // the part page itself plots.
  const ripple = Object.entries(sim.ripple_currentV2 || {})
    .map(([label, rows]) => ({
      khz: parseFloat(label),
      points: asCurve(rows || [], "current", "temperature", 51),
    }))
    .filter((series) => isFinite(series.khz) && series.points.length)
    .sort((a, b) => a.khz - b.khz);
  if (ripple.length) entry.ripple = ripple;

  if (!entry.dcBias) throw new Error("no bias curve returned");
  return entry;
}

// ==================== PAGE ====================

async function readParts() {
  const page = await readFile(PAGE, "utf8");
  const at = page.indexOf(START);
  const to = page.indexOf(END);
  if (at < 0 || to < 0) throw new Error("markers not found in " + PAGE);
  const block = page.slice(at + START.length, to);
  const opens = block.indexOf("[");
  const closes = block.lastIndexOf("]");
  if (opens < 0 || closes < 0) throw new Error("no part array between the markers");
  return { page, at, to, parts: JSON.parse(block.slice(opens, closes + 1)) };
}

async function main() {
  const { page, at, to, parts } = await readParts();
  const byPn = new Map(parts.map((part) => [part.pn.toUpperCase(), part]));

  let wanted = named.length
    ? named
    : parts
        .filter((part) => SERIES.test(part.pn) || /yageo/i.test(part.vendor || ""))
        .map((part) => part.pn);
  if (flags.has("--missing")) {
    wanted = wanted.filter((pn) => !byPn.get(pn.toUpperCase())?.dcBias?.length);
  }
  if (!wanted.length) {
    console.error("No YAGEO parts to fetch.");
    process.exit(1);
  }

  let fetched = 0;
  for (const pn of wanted) {
    try {
      const entry = await fetchPart(pn.trim());
      const key = entry.pn.toUpperCase();
      const existing = byPn.get(key);
      if (existing) {
        // The capacitance, vendor string and any sourcing added by
        // fetch-jlc-parts.mjs stay as they are; only the specs YAGEO publishes
        // and the curves are replaced.
        delete existing.curves;
        Object.assign(existing, entry);
      } else {
        const added = { vendor: "YAGEO", capUnit: "uF", ...entry };
        parts.push(added);
        byPn.set(key, added);
      }
      fetched++;
      console.log(
        entry.pn +
          "  " +
          [
            entry.dcBias && "dcBias(" + entry.dcBias.length + ")",
            entry.tcc25 && "tcc25(" + entry.tcc25.length + ")",
            entry.freq && "z/esr(" + entry.freq.length + ")",
            entry.ripple
              ? "ripple(" + entry.ripple.map((s) => s.khz + "k").join(",") + ")"
              : "no ripple",
          ]
            .filter(Boolean)
            .join(" ") +
          (entry.dims ? "  " + entry.dims : ""),
      );
    } catch (err) {
      console.error(pn + "  FAILED: " + err.message);
    }
    if (wanted.length > 1) await sleep(1000);
  }

  const body =
    START + "\n      window.MLCC_PARTS = " + JSON.stringify(parts) + ";\n      " + END;
  await writeFile(PAGE, page.slice(0, at) + body + page.slice(to + END.length));
  console.log(
    "\n" + fetched + " of " + wanted.length + " parts fetched; wrote " + parts.length + " parts into the page.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
