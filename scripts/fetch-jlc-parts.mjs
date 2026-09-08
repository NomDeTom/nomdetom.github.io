#!/usr/bin/env node
// Reads the JLCPCB parts library through the same JSON API its own search page
// calls. No key or login is needed, but it is their service: keep request rates
// low and treat stock and price as a snapshot, not a feed.
//
//   node scripts/fetch-jlc-parts.mjs search "22uF 0603"      # print matches
//   node scripts/fetch-jlc-parts.mjs search "CL21A" --csv    # same, as CSV
//   node scripts/fetch-jlc-parts.mjs list                    # every Basic and
//       Preferred Extended MLCC, the two tiers JLC assembles without an extra
//       setup fee, as a table (add --csv to pipe it somewhere)
//   node scripts/fetch-jlc-parts.mjs seed                    # put every Basic
//       and Preferred Extended MLCC into mlcc-derating-lookup.html with its
//       specs and sourcing, keeping any curves already captured. Follow with
//       fetch-mlcc-curves.mjs to fill in curves for the parts that have them.
//   node scripts/fetch-jlc-parts.mjs enrich                  # add LCSC code,
//       library type, stock and price to every part in mlcc-derating-lookup.html
//
// Options: --pages N (default 1, 100 rows per page), --basic (basic library
// only), --stock (in stock only), --csv (CSV instead of a padded table).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "mlcc-derating-lookup.html");
const START = "/* MLCC-DATA-START */";
const END = "/* MLCC-DATA-END */";

const API =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2";
const CATEGORY = {
  firstSortName: "Capacitors",
  secondSortName: "Multilayer Ceramic Capacitors MLCC - SMD/SMT",
};

const args = process.argv.slice(2);
const command = args[0] || "search";
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.slice(1).filter((a) => !a.startsWith("--"));
const pageCount = Number(
  (args.find((a) => a.startsWith("--pages=")) || "--pages=1").split("=")[1],
);

async function search(keyword, page = 1, pageSize = 100, extra = {}) {
  const body = {
    currentPage: page,
    pageSize,
    keyword: keyword || null,
    componentLibraryType: flags.has("--basic") ? "base" : null,
    stockFlag: flags.has("--stock"),
    searchSource: "search",
    searchType: keyword ? 2 : 3,
    componentBrandList: [],
    componentSpecificationList: [],
    componentAttributeList: [],
    paramList: [],
    ...CATEGORY,
    ...extra,
  };
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer:
        "https://jlcpcb.com/parts/2nd/Capacitors/Multilayer_Ceramic_Capacitors_MLCC_SMD_SMT_2929",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("JLC API HTTP " + res.status);
  const json = await res.json();
  const info = json?.data?.componentPageInfo;
  if (!info) throw new Error("unexpected API response");
  return { total: info.total, rows: info.list || [] };
}

function attribute(row, name) {
  const found = (row.attributes || []).find(
    (a) => a.attribute_name_en === name,
  );
  return found ? found.attribute_value_name : "";
}

function simplify(row) {
  const price = (row.componentPrices || [])[0];
  return {
    lcsc: row.componentCode,
    mpn: row.componentModelEn,
    brand: row.componentBrandEn,
    library: row.componentLibraryType === "base" ? "Basic" : "Extended",
    package: row.componentSpecificationEn || "",
    capacitance: attribute(row, "Capacitance"),
    voltage: attribute(row, "Voltage Rating"),
    tolerance: attribute(row, "Tolerance"),
    tcc: attribute(row, "Temperature Coefficient"),
    stock: row.stockCount,
    price: price ? price.productPrice : null,
    datasheet: row.dataManualUrl || row.dataManualOfficialLink || "",
  };
}

function printRows(rows) {
  if (flags.has("--csv")) {
    const header = Object.keys(rows[0] || {});
    console.log(header.join(","));
    rows.forEach((row) =>
      console.log(
        header
          .map((key) => {
            const cell = String(row[key] ?? "");
            return /[",]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell;
          })
          .join(","),
      ),
    );
    return;
  }
  rows.forEach((row) => {
    console.log(
      String(row.lcsc).padEnd(9) +
        String(row.tier || row.library).padEnd(11) +
        String(row.mpn).padEnd(24) +
        String(row.package).padEnd(7) +
        [row.capacitance, row.voltage, row.tcc].filter(Boolean).join(" ").padEnd(22) +
        "stock " +
        String(row.stock).padStart(9) +
        (row.price == null ? "" : "  $" + row.price),
    );
  });
}

// Picks the row that actually is the part asked for: an exact model match wins,
// then a match ignoring the packaging suffix, and only then the first hit.
function bestMatch(rows, mpn) {
  const wanted = mpn.trim().toUpperCase();
  const exact = rows.find((r) => (r.mpn || "").toUpperCase() === wanted);
  if (exact) return exact;
  const trimmed = rows.find(
    (r) =>
      (r.mpn || "").toUpperCase().startsWith(wanted.slice(0, -1)) ||
      wanted.startsWith((r.mpn || "").toUpperCase().slice(0, -1)),
  );
  return trimmed || rows[0] || null;
}

// Basic parts and Preferred Extended parts are the two tiers JLC mounts without
// an added feeder charge, so they are the list worth keeping to hand. They are
// selected differently: Basic by library type, Preferred by a row flag.
async function collectTier(extra, tierName) {
  const rows = [];
  for (let page = 1; page <= 40; page++) {
    const { total, rows: batch } = await search(null, page, 100, extra);
    batch.forEach((row) => {
      const item = simplify(row);
      item.tier = tierName;
      rows.push(item);
    });
    if (rows.length >= total || !batch.length) break;
  }
  return rows;
}

async function runList() {
  const basic = await collectTier({ componentLibraryType: "base" }, "Basic");
  const preferred = await collectTier(
    { preferredComponentFlag: true },
    "Preferred",
  );

  const seen = new Set();
  const all = [];
  for (const item of basic.concat(preferred)) {
    if (seen.has(item.lcsc)) continue;
    seen.add(item.lcsc);
    all.push(item);
  }

  // Largest capacitance first within a package, which is how these get chosen.
  all.sort((a, b) => {
    if (a.package !== b.package) return a.package < b.package ? -1 : 1;
    return farads(b.capacitance) - farads(a.capacitance);
  });

  printRows(all);
  console.error(
    "\n" +
      all.length +
      " parts: " +
      basic.length +
      " Basic, " +
      preferred.length +
      " Preferred Extended" +
      (basic.length + preferred.length - all.length
        ? " (" + (basic.length + preferred.length - all.length) + " in both)"
        : ""),
  );
}

// "10uF" / "100nF" / "4.7pF" to farads, for sorting only.
function farads(text) {
  const match = String(text || "").match(/([0-9.]+)\s*([munp]?)F/i);
  if (!match) return 0;
  const scale = { u: 1e-6, m: 1e-3, n: 1e-9, p: 1e-12, "": 1 };
  return Number(match[1]) * (scale[match[2].toLowerCase()] ?? 1);
}

async function runSearch() {
  const keyword = positional.join(" ");
  const collected = [];
  let total = 0;
  for (let page = 1; page <= Math.max(1, pageCount); page++) {
    const { total: found, rows } = await search(keyword, page);
    total = found;
    if (!rows.length) break;
    rows.forEach((row) => collected.push(simplify(row)));
  }
  printRows(collected);
  console.error(
    "\n" + collected.length + " shown of " + total + " matching parts.",
  );
}

async function readParts() {
  const page = await readFile(PAGE, "utf8");
  const at = page.indexOf(START);
  const to = page.indexOf(END);
  if (at < 0 || to < 0) throw new Error("markers not found in " + PAGE);
  const block = page.slice(at + START.length, to);
  return {
    page,
    at,
    to,
    parts: JSON.parse(block.slice(block.indexOf("["), block.lastIndexOf("]") + 1)),
  };
}

async function writeParts(page, at, to, parts) {
  const body =
    START + "\n      window.MLCC_PARTS = " + JSON.stringify(parts) + ";\n      " + END;
  await writeFile(PAGE, page.slice(0, at) + body + page.slice(to + END.length));
}

// "2kV" is two thousand volts, not two: the scale has to be read before the
// unit is stripped.
function voltsFromText(text) {
  const match = String(text || "").match(/([0-9.]+)\s*(k?)\s*V/i);
  if (!match) return null;
  const volts = Number(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(volts) ? volts : null;
}

// Capacitance as written by JLC ("10uF", "100nF") split into the value and unit
// the page stores.
function capacitanceFields(text) {
  const match = String(text || "").match(/([0-9.]+)\s*([munp]?)F/i);
  if (!match) return { cap: null, capUnit: "uF" };
  const unit = match[2].toLowerCase();
  return {
    cap: Number(match[1]),
    capUnit: unit === "n" ? "nF" : unit === "p" ? "pF" : "uF",
  };
}

async function runSeed() {
  const { page, at, to, parts } = await readParts();
  const basic = await collectTier({ componentLibraryType: "base" }, "Basic");
  const preferred = await collectTier(
    { preferredComponentFlag: true },
    "Preferred",
  );

  const byPn = new Map(parts.map((part) => [part.pn.toUpperCase(), part]));
  let added = 0;
  let updated = 0;

  const seen = new Set();
  for (const row of basic.concat(preferred)) {
    if (seen.has(row.lcsc)) continue;
    seen.add(row.lcsc);
    const key = row.mpn.toUpperCase();
    const existing = byPn.get(key);
    const cap = capacitanceFields(row.capacitance);
    // Curves and anything else already captured survive; JLC only owns the
    // sourcing fields and the specs it publishes.
    const entry = Object.assign({}, existing, {
      pn: existing ? existing.pn : row.mpn,
      vendor: row.brand,
      cap: existing && existing.cap != null ? existing.cap : cap.cap,
      capUnit: existing && existing.cap != null ? existing.capUnit : cap.capUnit,
      tol: (existing && existing.tol) || row.tolerance,
      vdc:
        existing && existing.dcBias && existing.vdc
          ? existing.vdc
          : (voltsFromText(row.voltage) ??
            (existing ? existing.vdc : null)),
      tcc: (existing && existing.tcc) || row.tcc,
      size: (existing && existing.size) || row.package,
      lcsc: row.lcsc,
      jlcLibrary: row.tier,
      jlcStock: row.stock,
      jlcPrice: row.price,
      jlcMpn: row.mpn,
    });
    if (existing) {
      updated++;
      Object.assign(existing, entry);
    } else {
      added++;
      parts.push(entry);
      byPn.set(key, entry);
    }
  }

  // Grouped by package, largest value first, so the part list reads the way a
  // bill of materials is chosen.
  const order = ["0201", "0402", "0603", "0805", "1206", "1210", "1812"];
  parts.sort((a, b) => {
    const pa = order.indexOf(a.size || "");
    const pb = order.indexOf(b.size || "");
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return farads(b.cap + (b.capUnit || "uF")) - farads(a.cap + (a.capUnit || "uF"));
  });

  await writeParts(page, at, to, parts);
  console.log(
    "\n" +
      parts.length +
      " parts in the page: " +
      added +
      " added, " +
      updated +
      " updated from JLC (" +
      basic.length +
      " Basic, " +
      preferred.length +
      " Preferred Extended).",
  );
}

async function runEnrich() {
  const { page, at, to, parts } = await readParts();

  for (const part of parts) {
    try {
      const { rows } = await search(part.pn, 1, 50);
      const match = bestMatch(rows.map(simplify), part.pn);
      if (!match) {
        console.log(part.pn + "  not on JLC");
        continue;
      }
      part.lcsc = match.lcsc;
      part.jlcLibrary = match.library;
      part.jlcStock = match.stock;
      part.jlcPrice = match.price;
      part.jlcMpn = match.mpn;
      console.log(
        part.pn.padEnd(20) +
          match.lcsc.padEnd(9) +
          match.library.padEnd(9) +
          "stock " +
          String(match.stock).padStart(9) +
          (match.price == null ? "" : "  $" + match.price) +
          (match.mpn.toUpperCase() === part.pn.toUpperCase()
            ? ""
            : "  (matched " + match.mpn + ")"),
      );
    } catch (err) {
      console.error(part.pn + "  lookup failed: " + err.message);
    }
  }

  await writeParts(page, at, to, parts);
  console.log("\nUpdated sourcing data for " + parts.length + " parts.");
}

if (command === "enrich") {
  await runEnrich();
} else if (command === "seed") {
  await runSeed();
} else if (command === "list") {
  await runList();
} else {
  await runSearch();
}
