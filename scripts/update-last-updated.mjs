#!/usr/bin/env node
/**
 * Rewrites the "Last updated" footer date in the HTML files given as
 * arguments (or every root-level .html file when called with none).
 *
 * The date comes from the most recent commit that changed something in the
 * page other than the footer itself, so a page only re-dates when the page
 * was genuinely the subject of the edit. Footer-only commits (this script's
 * own output, or a bulk footer roll-out) are walked past.
 *
 * Usage: node scripts/update-last-updated.mjs [file.html ...]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const FOOTER_RE =
  /(<footer class="page-footer">\s*Last updated:\s*<time datetime=")(\d{4}-\d{2}-\d{2})(">)([^<]*)(<\/time>)/;

/** A changed line that is only part of the footer block or its styling. */
const FOOTER_LINE_RE =
  /(page-footer|Last updated:|<time datetime=|<\/time>|<\/?footer)/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function prettyDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** True when this commit's changes to `file` are footer bookkeeping only. */
function isFooterOnlyCommit(sha, file) {
  let diff;
  try {
    diff = git(["show", "--format=", "--unified=0", sha, "--", file]);
  } catch {
    return false;
  }
  const changes = diff
    .split("\n")
    .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  if (changes.length === 0) return false;
  return changes.every((l) => {
    const body = l.slice(1).trim();
    return body === "" || FOOTER_LINE_RE.test(body) || /^[{}]$/.test(body) ||
      /^(margin|padding-top|border-top|color|font-size|text-align):/.test(body);
  });
}

/** Date of the newest non-footer-only commit touching `file`. */
function lastContentCommitDate(file) {
  let log;
  try {
    log = git(["log", "--format=%H %cs", "--", file]).trim();
  } catch {
    return null;
  }
  if (!log) return null;
  for (const line of log.split("\n")) {
    const [sha, iso] = line.split(" ");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) continue;
    if (isFooterOnlyCommit(sha, file)) continue;
    return iso;
  }
  return null;
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(".").filter((f) => f.endsWith(".html"));

let changed = 0;
for (const file of files) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in this push
  }
  if (!FOOTER_RE.test(source)) continue; // no footer (e.g. synced pages)

  const iso = lastContentCommitDate(file);
  if (!iso) continue;

  const updated = source.replace(
    FOOTER_RE,
    (_m, open, _oldIso, mid, _oldText, close) =>
      open + iso + mid + prettyDate(iso) + close,
  );
  if (updated !== source) {
    writeFileSync(file, updated);
    console.log(`${file} -> ${prettyDate(iso)}`);
    changed++;
  }
}
console.log(changed ? `${changed} file(s) updated.` : "No footers needed updating.");
