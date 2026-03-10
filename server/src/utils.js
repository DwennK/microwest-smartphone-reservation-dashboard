const { ALLOWED_STATUSES, ALLOWED_STORAGE_CAPACITIES } = require("./constants");

const STATUS_ALIASES = {
  "en attente": "en_attente",
  "contacte": "contacte",
  "vendu": "vendu",
  "annule": "annule",
  en_attente: "en_attente"
};

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeRequestDate(value) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

  const swissMatch = raw.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);

  if (swissMatch) {
    const [, day, month, year] = swissMatch;
    const isoCandidate = `${year}-${month}-${day}T00:00:00.000Z`;
    const parsedSwiss = new Date(isoCandidate);

    if (Number.isNaN(parsedSwiss.getTime())) {
      return null;
    }

    return parsedSwiss.toISOString();
  }

  const hasTime = raw.includes("T");
  const isoCandidate = hasTime ? raw : `${raw}T00:00:00.000Z`;
  const parsed = new Date(isoCandidate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeStorageCapacity(value) {
  const normalized = normalizeOptionalText(value);

  if (normalized === null) {
    return null;
  }

  if (!ALLOWED_STORAGE_CAPACITIES.includes(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeStatus(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const alias = STATUS_ALIASES[normalized];

  if (alias) {
    return alias;
  }

  if (!ALLOWED_STATUSES.includes(normalized)) {
    return null;
  }

  return normalized;
}

function serializeRequest(row) {
  return {
    ...row,
    storageCapacity: row.storageCapacity ?? null,
    notes: row.notes ?? ""
  };
}

function validateRequestPayload(payload) {
  const customerName = normalizeText(payload.customerName);
  const phoneNumber = normalizeText(payload.phoneNumber);
  const requestedModel = normalizeText(payload.requestedModel);
  const storageCapacity = normalizeStorageCapacity(payload.storageCapacity);
  const requestDate = normalizeRequestDate(payload.requestDate);
  const status = normalizeStatus(payload.status || "en_attente");
  const notes = normalizeOptionalText(payload.notes);

  const errors = [];

  if (!customerName) {
    errors.push("Le nom du client est requis.");
  }

  if (!phoneNumber) {
    errors.push("Le numero de telephone est requis.");
  }

  if (!requestedModel) {
    errors.push("Le smartphone recherche est requis.");
  }

  if (!requestDate) {
    errors.push("La date de la demande est invalide.");
  }

  if (storageCapacity === undefined) {
    errors.push("La capacite de stockage est invalide.");
  }

  if (!status) {
    errors.push("Le statut est invalide.");
  }

  return {
    errors,
    value: {
      customerName,
      phoneNumber,
      brand: requestedModel,
      requestedModel,
      storageCapacity: storageCapacity ?? null,
      requestDate,
      status,
      notes
    }
  };
}

function buildFilters(query = {}) {
  return {
    search: normalizeText(query.search),
    model: normalizeText(query.model),
    storage: normalizeText(query.storage),
    status: normalizeText(query.status),
    pendingOnly: String(query.pendingOnly).toLowerCase() === "true",
    sort: query.sort === "oldest" ? "oldest" : "newest"
  };
}

function formatDateForInput(isoString) {
  return isoString ? isoString.slice(0, 10) : "";
}

function validateImportedRequestRow(row) {
  const { errors, value } = validateRequestPayload(row);
  const createdAt = normalizeRequestDate(row.createdAt) || new Date().toISOString();
  const updatedAt = normalizeRequestDate(row.updatedAt) || createdAt;

  return {
    errors,
    value: {
      ...value,
      createdAt,
      updatedAt
    }
  };
}

module.exports = {
  buildFilters,
  formatDateForInput,
  normalizeStatus,
  serializeRequest,
  validateImportedRequestRow,
  validateRequestPayload
};
