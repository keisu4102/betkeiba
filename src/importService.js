const iconv = require("iconv-lite");
const { parse } = require("csv-parse/sync");

function decodeBuffer(buffer) {
  // UTF-8 with or without BOM is preferred. If it is invalid UTF-8, try Japanese CP932.
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8.replace(/^\uFEFF/, "");
  return iconv.decode(buffer, "cp932");
}

function parseMetadata(text) {
  const metadata = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) throw new Error(`Invalid metadata line: "${line}". Use key=value.`);
    metadata[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  const required = ["name", "venue"];
  for (const key of required) {
    if (!metadata[key]) throw new Error(`Metadata is missing required field "${key}".`);
  }
  const takeRate = metadata.takeRate === undefined || metadata.takeRate === "" ? 10 : Number(metadata.takeRate);
  if (!Number.isFinite(takeRate) || takeRate < 0 || takeRate > 30) {
    throw new Error("takeRate must be a number between 0 and 30.");
  }
  return {
    name: metadata.name,
    date: metadata.date || "",
    venue: metadata.venue,
    raceNumber: metadata.raceNumber || "",
    netkeibaUrl: metadata.netkeibaUrl || "",
    takeRate,
    distance: metadata.distance ? Number(metadata.distance) : null,
    surface: metadata.surface || "Turf"
  };
}

function parseHorseCsv(text) {
  const rows = parse(text.replace(/^\uFEFF/, ""), {
    bom: true, skip_empty_lines: true, trim: true, relax_column_count: false
  });
  if (rows.length < 2) throw new Error("CSV needs a header row and at least two horse rows.");
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const required = ["gate", "horse_no", "name", "sire", "dam", "damsire", "last_race"];
  for (const key of required) {
    if (!headers.includes(key)) throw new Error(`CSV header is missing "${key}". Download the CSV template for the correct format.`);
  }
  const index = Object.fromEntries(headers.map((h, i) => [h, i]));
  const horses = rows.slice(1).map((row, i) => {
    const gate = Number(row[index.gate]);
    const horseNo = Number(row[index.horse_no]);
    const name = String(row[index.name] || "").trim();
    if (!Number.isInteger(gate) || gate < 1) throw new Error(`CSV row ${i + 2}: gate must be a positive whole number.`);
    if (!Number.isInteger(horseNo) || horseNo < 1) throw new Error(`CSV row ${i + 2}: horse_no must be a positive whole number.`);
    if (!name) throw new Error(`CSV row ${i + 2}: horse name is required.`);
    return {
      gate, horseNo, name,
      sire: String(row[index.sire] || ""),
      dam: String(row[index.dam] || ""),
      damsire: String(row[index.damsire] || ""),
      lastRace: String(row[index.last_race] || ""),
      // Placeholder simulation score. Edit in the app or replace with your own seeded values.
      abilityScore: 35 + Math.floor(Math.random() * 46)
    };
  });
  if (new Set(horses.map(h => h.horseNo)).size !== horses.length) {
    throw new Error("Horse numbers must be unique within a race.");
  }
  return horses;
}

module.exports = { decodeBuffer, parseMetadata, parseHorseCsv };
