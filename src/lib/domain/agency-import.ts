import { normalizeAgencyKeyPart } from "@/lib/config/business-rules";

export const AGENCY_CSV_HEADERS = [
  "nome",
  "email",
  "telefono",
  "indirizzo",
  "cap",
  "comune",
  "provincia",
  "maps_url",
  "iban",
  "intestatario_iban",
  "costi_pratica",
  "delega",
  "istanza",
] as const;

export type CsvAgency = Record<(typeof AGENCY_CSV_HEADERS)[number], string>;

export type AgencyIdentity = {
  id: string;
  nome: string;
  email: string | null;
  cap: string;
};

export function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseAgencyCsv(content: string): CsvAgency[] {
  const [headers, ...rows] = parseCsv(content.replace(/^\uFEFF/, ""));
  if (!headers || headers.join(",") !== AGENCY_CSV_HEADERS.join(",")) {
    throw new Error(
      `Unexpected CSV columns. Expected: ${AGENCY_CSV_HEADERS.join(", ")}.`,
    );
  }

  return rows.map((values, rowIndex) => {
    if (values.length !== AGENCY_CSV_HEADERS.length) {
      throw new Error(`Invalid CSV row ${rowIndex + 2}.`);
    }
    const agency = Object.fromEntries(
      AGENCY_CSV_HEADERS.map((header, index) => [
        header,
        values[index]?.trim() ?? "",
      ]),
    ) as CsvAgency;
    if (!agency.nome) throw new Error(`CSV row ${rowIndex + 2} has no name.`);
    if (!agency.email) throw new Error(`CSV row ${rowIndex + 2} has no email.`);
    parseNullableSiNo(agency.delega, `delega at CSV row ${rowIndex + 2}`);
    parseNullableSiNo(agency.istanza, `istanza at CSV row ${rowIndex + 2}`);
    return agency;
  });
}

export function parseNullableSiNo(value: string, fieldName = "value") {
  const normalized = normalizeAgencyKeyPart(value);
  if (!normalized) return null;
  if (normalized === "si") return true;
  if (normalized === "no") return false;
  throw new Error(`${fieldName} must be si, no or empty.`);
}

export function isAgencyEligible(input: {
  telefono: string | null;
  delega: boolean | null;
  istanza: boolean | null;
}) {
  return (
    Boolean(input.telefono?.trim()) &&
    input.delega === false &&
    input.istanza === false
  );
}

export function findAgencyReconciliationMatch<T extends AgencyIdentity>(
  row: CsvAgency,
  existing: readonly T[],
  claimedIds: ReadonlySet<string>,
): T | null {
  const email = normalizeAgencyKeyPart(row.email);
  const postalCode = normalizeAgencyKeyPart(row.cap);
  const name = normalizeAgencyKeyPart(row.nome);
  const available = existing.filter((agency) => !claimedIds.has(agency.id));
  const byEmail = available.find((agency) => {
    if (normalizeAgencyKeyPart(agency.email ?? "") !== email) return false;
    return postalCode
      ? normalizeAgencyKeyPart(agency.cap) === postalCode
      : true;
  });
  if (byEmail) return byEmail;

  return (
    available.find(
      (agency) =>
        normalizeAgencyKeyPart(agency.nome) === name &&
        normalizeAgencyKeyPart(agency.cap) === postalCode,
    ) ?? null
  );
}
