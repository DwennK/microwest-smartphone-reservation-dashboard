const STATUS_LABELS = {
  en_attente: "En attente",
  contacte: "Contacte",
  vendu: "Vendu",
  annule: "Annule"
};

const EXPORT_HEADERS = [
  "Nom client",
  "Telephone",
  "Marque",
  "Modele",
  "Capacite",
  "Date demande",
  "Statut",
  "Notes",
  "Cree le",
  "Mis a jour le"
];

const IMPORT_HEADERS = [
  "Nom client",
  "Telephone",
  "Modele",
  "Capacite",
  "Date demande",
  "Statut",
  "Notes",
  "Cree le",
  "Mis a jour le"
];

const IMPORT_HEADERS_WITH_BRAND = [
  "Nom client",
  "Telephone",
  "Marque",
  "Modele",
  "Capacite",
  "Date demande",
  "Statut",
  "Notes",
  "Cree le",
  "Mis a jour le"
];

function escapeCsvValue(value) {
  const normalized = value ?? "";
  const stringValue = String(normalized);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function generateCsv(requests) {
  const rows = requests.map((request) => [
    request.customerName,
    request.phoneNumber,
    request.brand ?? request.requestedModel,
    request.requestedModel,
    request.storageCapacity ?? "",
    request.requestDate,
    STATUS_LABELS[request.status] || request.status,
    request.notes,
    request.createdAt,
    request.updatedAt
  ]);

  return [EXPORT_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

function parseCsv(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return { errors: ["Le fichier CSV est vide."], rows: [] };
  }

  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (insideQuotes) {
    return { errors: ["Le fichier CSV contient des guillemets non fermes."], rows: [] };
  }

  if (currentValue !== "" || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const nonEmptyRows = rows.filter((row) => row.some((value) => String(value).trim() !== ""));

  if (nonEmptyRows.length === 0) {
    return { errors: ["Le fichier CSV est vide."], rows: [] };
  }

  const [headers, ...dataRows] = nonEmptyRows;
  const normalizedHeaders = headers.map((header, index) => {
    const value = String(header).trim();
    return index === 0 ? value.replace(/^\uFEFF/, "") : value;
  });
  const isCurrentFormat =
    normalizedHeaders.length === IMPORT_HEADERS.length &&
    IMPORT_HEADERS.every((header, index) => normalizedHeaders[index] === header);
  const isLegacyFormat =
    normalizedHeaders.length === IMPORT_HEADERS_WITH_BRAND.length &&
    IMPORT_HEADERS_WITH_BRAND.every((header, index) => normalizedHeaders[index] === header);

  if (!isCurrentFormat && !isLegacyFormat) {
    return {
      errors: ["En-tetes CSV invalides. Utilisez un fichier exporte par l'application."],
      rows: []
    };
  }

  const mappedRows = dataRows.map((row, index) => ({
    lineNumber: index + 2,
    customerName: row[0] ?? "",
    phoneNumber: row[1] ?? "",
    requestedModel: isLegacyFormat ? row[3] ?? "" : row[2] ?? "",
    storageCapacity: isLegacyFormat ? row[4] ?? "" : row[3] ?? "",
    requestDate: isLegacyFormat ? row[5] ?? "" : row[4] ?? "",
    status: isLegacyFormat ? row[6] ?? "" : row[5] ?? "",
    notes: isLegacyFormat ? row[7] ?? "" : row[6] ?? "",
    createdAt: isLegacyFormat ? row[8] ?? "" : row[7] ?? "",
    updatedAt: isLegacyFormat ? row[9] ?? "" : row[8] ?? ""
  }));

  return { errors: [], rows: mappedRows };
}

module.exports = {
  generateCsv,
  parseCsv
};
