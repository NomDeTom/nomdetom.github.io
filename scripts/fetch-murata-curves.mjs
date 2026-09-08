#!/usr/bin/env node
// Fetches MLCC characteristic curves from Murata's product information site
// through the same JSON API its own detail pages call, and writes them into
// mlcc-derating-lookup.html between the MLCC-DATA markers.
//
//   node scripts/fetch-murata-curves.mjs                  # refresh every Murata part in the page
//   node scripts/fetch-murata-curves.mjs GRM21BR61H106KE43L  # add or refresh specific parts
//   node scripts/fetch-murata-curves.mjs --missing         # only Murata parts with no curves yet
//
// No key or login is needed, but it is Murata's service: the script requests
// one part at a time with a pause between parts.
//
// Murata computes these curves from its own models rather than publishing
// digitised datasheet plots, so the returned grids are much finer than the page
// needs. Each curve is decimated to roughly the density of the Samsung curves
// captured by fetch-mlcc-curves.mjs, keeping both end points.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "mlcc-derating-lookup.html");
const START = "/* MLCC-DATA-START */";
const END = "/* MLCC-DATA-END */";

const API = "https://pimapi.murata.com/public/api/pim/v1";
const CATEGORY = "ceramicCapacitorSMD";
const LOCALE = "en-eu";

// Murata part numbers carry a packaging suffix that the API replaces with "#".
// Matching on the series prefix picks the page's Murata rows without relying on
// the vendor string, which comes from whichever distributor seeded the row.
const SERIES = /^(GRM|GCM|GJM|GRT|GCJ|GA[23]|GQM|GMD|KRM|LLL|NFM|GC[DEJM])/i;

// Murata's own detail page sends a WorkInfo block with every curve request and
// the service returns HTTP 500 without one. The values only pick a trace colour
// and dash, which this script discards.
const WORK_INFO = { color: "#EA002A", line_dash: "solid" };

const STATUS_CODE = {
  underDevelopment: "A",
  available: "B",
  plannedDiscontinue: "C",
  discontinued: "D",
  NRND: "N",
};

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function post(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://pim.murata.com",
      Referer: "https://pim.murata.com/",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(path + " -> HTTP " + res.status + ": " + detail);
  }
  return json;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// ==================== PRODUCT SPECS ====================

async function fetchProduct(pn) {
  const res = await post("/products/search", {
    productCategoryId: CATEGORY,
    languageRegion: LOCALE,
    pageSize: 5,
    page: 1,
    partNum: pn,
  });
  const hit = res?.productSearchResult?.[0];
  if (!hit) throw new Error("not found in Murata's ceramic capacitor catalogue");
  return hit;
}

function itemsOf(product) {
  const items = new Map();
  for (const item of product.itemInfoList || []) items.set(item.id, item.valueList || []);
  return items;
}

const valueOf = (items, id) => items.get(id)?.[0]?.value ?? "";
const displayOf = (items, id) => items.get(id)?.[0]?.displayName ?? "";

// "2mm ±0.2mm" to "2.00±0.20mm", the form the page's body-size parser reads.
function dimension(items, id) {
  const value = parseFloat(valueOf(items, id));
  if (!isFinite(value)) return null;
  const tolerance = parseFloat((displayOf(items, id).match(/±\s*([0-9.]+)/) || [])[1]);
  return value.toFixed(2) + (isFinite(tolerance) ? "±" + tolerance.toFixed(2) : "") + "mm";
}

function specsOf(product) {
  const items = itemsOf(product);
  const dims = [dimension(items, "length"), dimension(items, "width"), dimension(items, "thickness")];
  return {
    resolved: valueOf(items, "partNum"),
    tol: displayOf(items, "capacitanceTolerance"),
    vdc: parseFloat(valueOf(items, "ratedVoltageDc") || valueOf(items, "ratedVoltage")),
    tcc: valueOf(items, "tempChara"),
    size: valueOf(items, "sizeCodeInInch"),
    dims: dims.every(Boolean) ? dims.join(" x ") : null,
    supplyStatus: STATUS_CODE[valueOf(items, "productionStatus")] || null,
  };
}

// The page reports capacitance in microfarads throughout, so anything published
// in another unit has to be converted rather than mislabelled.
const CAP_SCALE = { pF: 1e-6, nF: 1e-3, "μF": 1, uF: 1, mF: 1e3, F: 1e6 };

function capacitanceUF(product) {
  const items = itemsOf(product);
  const value = parseFloat(valueOf(items, "capacitance"));
  const unit = items.get("capacitance")?.[0]?.unit || "μF";
  const scale = CAP_SCALE[unit];
  if (!isFinite(value) || !scale) return null;
  return round(value * scale, 6);
}

// The defaults Murata's own page puts in the curve request, and the list of
// curves it offers for this part.
function conditions(product) {
  const data = product.characteristicDataList?.[0] || {};
  const params = new Map();
  for (const entry of data.calcParamList || []) {
    const value = entry.calcParam?.[0]?.value;
    if (value !== undefined && value !== "") params.set(entry.id, Number(value));
  }
  const offered = new Set();
  for (const kind of data.characteristicKindList || []) {
    for (const chara of kind.characteristicList || []) offered.add(chara.id);
  }
  return { params, offered };
}

// ==================== CURVES ====================

async function fetchCurves(partNum, requests) {
  const res = await post("/characteristics/characteristics", {
    ReqType: "Characteristics",
    languageRegion: LOCALE,
    ReqChara: requests.map((req) => ({
      partnumber: partNum,
      chara_type: req.charaType,
      parameter: req.parameter,
      WorkInfo: WORK_INFO,
    })),
  });
  return res?.JsonCharaData || [];
}

// A curve point arrives as [[x], [y], ...]: the extra columns are the same
// quantity in other units, which the page does not use.
const xyOf = (charadata) =>
  (charadata.data || []).map((point) => [Number(point[0][0]), Number(point[1][0])]);

function round(value, digits) {
  if (!isFinite(value)) return value;
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

const asCurve = (points, target, xDigits) =>
  decimate(points, target).map(([x, y]) => [round(x, xDigits), round(y, 4)]);

function pick(curves, charaType, index = 0) {
  const matches = curves.filter((c) => c.chara_type === charaType);
  const series = matches[index]?.charadata || [];
  return series;
}

async function fetchPart(pn) {
  const product = await fetchProduct(pn);
  const specs = specsOf(product);
  const { params, offered } = conditions(product);
  const supply = specs.supplyStatus;
  const withSupply = (parameter) => (supply ? { ...parameter, supply_status: supply } : parameter);

  const dcBiasAc = params.get("cDcBiasACVoltage") ?? 1;
  const dcBiasTemp = params.get("cDcBiasTemperatures") ?? 25;
  const tempAc = params.get("cTempACVoltage") ?? 0.5;
  const zTemp = params.get("opeTemp") ?? 25;
  const zBias = params.get("dcBias") ?? 0;
  // The page blends its two temperature curves by applied bias, and the Samsung
  // curves it was built around are published at half rated voltage.
  const tccBiasVdc = isFinite(specs.vdc) ? round(specs.vdc / 2, 6) : null;

  const requests = [];
  const want = (id, charaType, parameter) => {
    if (offered.has(id)) requests.push({ charaType, parameter: withSupply(parameter) });
  };
  want("cDCBiasCapChange", "c_dcbias_capchange_cap", { tc: dcBiasTemp, ac: dcBiasAc });
  want("cTempCapChange", "c_temp_capchange_cap", { dc: 0, ac: tempAc });
  if (tccBiasVdc) want("cTempCapChange", "c_temp_capchange_cap", { dc: tccBiasVdc, ac: tempAc });
  want("zImpedance", "z", { tc: zTemp, dc: zBias });
  want("rResistance", "r", { tc: zTemp, dc: zBias });
  want("tempRise", "temp_rise", {});
  if (!requests.length) throw new Error("Murata publishes no curves for this part");

  const curves = await fetchCurves(specs.resolved, requests);
  const entry = {
    pn,
    resolved: specs.resolved,
    cap: capacitanceUF(product),
    capUnit: "uF",
    tol: specs.tol,
    vdc: specs.vdc,
    tcc: specs.tcc,
    size: specs.size,
    dims: specs.dims,
  };

  const dcBias = pick(curves, "c_dcbias_capchange_cap")[0];
  if (dcBias) {
    entry.dcBias = asCurve(xyOf(dcBias), 71, 4);
    entry.dcBiasAc = dcBiasAc;
  }

  // Both temperature curves come back under the same chara_type, in the order
  // they were asked for: unbiased first, then at half rated voltage.
  const temps = curves.filter((c) => c.chara_type === "c_temp_capchange_cap");
  if (temps[0]?.charadata?.[0]) entry.tcc25 = asCurve(xyOf(temps[0].charadata[0]), 61, 4);
  if (temps[1]?.charadata?.[0]) {
    entry.tccBias = asCurve(xyOf(temps[1].charadata[0]), 61, 4);
    entry.tccBiasVdc = tccBiasVdc;
  }

  // Impedance and resistance share one frequency axis in the page, so they are
  // only kept when both came back on the same grid.
  const z = pick(curves, "z")[0];
  const r = pick(curves, "r")[0];
  if (z && r) {
    const zPoints = decimate(xyOf(z), 61);
    const rPoints = decimate(xyOf(r), 61);
    if (zPoints.length === rPoints.length) {
      entry.freq = zPoints.map(([f]) => round(f, 4));
      entry.z = zPoints.map(([, ohm]) => round(ohm, 4));
      entry.esr = rPoints.map(([, ohm]) => round(ohm, 4));
    }
  }

  // Temp.rise comes back as one series per test frequency, captioned with it.
  const ripple = pick(curves, "temp_rise")
    .map((series) => ({
      khz: parseFloat(series.caption2 || ""),
      points: asCurve(xyOf(series), 51, 4),
    }))
    .filter((series) => isFinite(series.khz) && series.points.length)
    .sort((a, b) => a.khz - b.khz);
  if (ripple.length) entry.ripple = ripple;

  if (!entry.dcBias) throw new Error("no DC bias curve returned");
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

async function writeParts(page, at, to, parts) {
  const body =
    START + "\n      window.MLCC_PARTS = " + JSON.stringify(parts) + ";\n      " + END;
  await writeFile(PAGE, page.slice(0, at) + body + page.slice(to + END.length));
}

async function main() {
  const { page, at, to, parts } = await readParts();
  const byPn = new Map(parts.map((part) => [part.pn.toUpperCase(), part]));

  let wanted = named.length
    ? named
    : parts
        .filter((part) => SERIES.test(part.pn) || /murata/i.test(part.vendor || ""))
        .map((part) => part.pn);
  if (flags.has("--missing")) {
    wanted = wanted.filter((pn) => !byPn.get(pn.toUpperCase())?.dcBias?.length);
  }
  if (!wanted.length) {
    console.error("No Murata parts to fetch.");
    process.exit(1);
  }

  let fetched = 0;
  for (const pn of wanted) {
    try {
      const entry = await fetchPart(pn.trim());
      const key = entry.pn.toUpperCase();
      const existing = byPn.get(key);
      if (existing) {
        // The vendor string and any sourcing added by fetch-jlc-parts.mjs stay
        // as they are; only the specs and curves are replaced.
        delete existing.curves;
        Object.assign(existing, entry);
      } else {
        const added = { vendor: "Murata Electronics", ...entry };
        parts.push(added);
        byPn.set(key, added);
      }
      fetched++;
      console.log(
        entry.pn +
          (entry.resolved === entry.pn ? "" : " -> " + entry.resolved) +
          "  " +
          entry.cap +
          entry.capUnit +
          " " +
          entry.vdc +
          "V " +
          entry.tcc +
          " " +
          entry.size +
          "  " +
          [
            entry.dcBias && "dcBias",
            entry.tcc25 && "tcc25",
            entry.tccBias && "tccBias",
            entry.freq && "z/esr",
            entry.ripple && "ripple(" + entry.ripple.map((s) => s.khz + "k").join(",") + ")",
          ]
            .filter(Boolean)
            .join(" "),
      );
    } catch (err) {
      console.error(pn + "  FAILED: " + err.message);
    }
    if (wanted.length > 1) await sleep(1000);
  }

  await writeParts(page, at, to, parts);
  console.log(
    "\n" + fetched + " of " + wanted.length + " parts fetched; wrote " + parts.length + " parts into the page.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
