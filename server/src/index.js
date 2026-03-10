const express = require("express");
const cors = require("cors");
const { ALLOWED_STATUSES, ALLOWED_STORAGE_CAPACITIES } = require("./constants");
const {
  buildImportDuplicateKey,
  createRequest,
  createRequests,
  deleteRequest,
  findRequestById,
  listImportDuplicateKeys,
  listRequests,
  updateRequest,
  updateRequestStatus
} = require("./repository");
const { generateCsv, parseCsv } = require("./csv");
const {
  buildFilters,
  normalizeStatus,
  validateImportedRequestRow,
  validateRequestPayload
} = require("./utils");

const app = express();
const PORT = process.env.PORT || 3001;
const csvTextParser = express.text({
  type: ["text/csv", "application/csv", "text/plain"],
  limit: "2mb"
});
const allowedOriginPatterns = [
  /^http:\/\/localhost:5173$/i,
  /^http:\/\/127\.0\.0\.1:5173$/i,
  /^https?:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/i,
  /^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net(?::\d+)?$/i
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed = allowedOriginPatterns.some((pattern) => pattern.test(origin));
      return callback(isAllowed ? null : new Error("Origin non autorisee par CORS."), isAllowed);
    }
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/options", (req, res) => {
  res.json({
    statuses: ALLOWED_STATUSES,
    storageCapacities: ALLOWED_STORAGE_CAPACITIES
  });
});

app.get("/api/requests", (req, res) => {
  const filters = buildFilters(req.query);
  const requests = listRequests(filters);
  res.json(requests);
});

app.get("/api/requests/export/csv", (req, res) => {
  const requests = listRequests(buildFilters({}));
  const csv = generateCsv(requests);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="microwest-requests.csv"');
  res.send(csv);
});

app.post("/api/requests/import/csv", csvTextParser, (req, res) => {
  const { errors: csvErrors, rows } = parseCsv(req.body);
  const ignoreDuplicates = String(req.query.ignoreDuplicates).toLowerCase() === "true";

  if (csvErrors.length > 0) {
    return res.status(400).json({ errors: csvErrors });
  }

  if (rows.length === 0) {
    return res.status(400).json({ errors: ["Le fichier CSV ne contient aucune reservation a importer."] });
  }

  const preparedRows = [];
  const rowErrors = [];

  for (const row of rows) {
    const { errors, value } = validateImportedRequestRow(row);

    if (errors.length > 0) {
      rowErrors.push(`Ligne ${row.lineNumber}: ${errors.join(" ")}`);
      continue;
    }

    preparedRows.push(value);
  }

  if (rowErrors.length > 0) {
    return res.status(400).json({ errors: rowErrors });
  }

  let rowsToImport = preparedRows;
  let skippedCount = 0;

  if (ignoreDuplicates) {
    const existingKeys = listImportDuplicateKeys();
    const nextRows = [];

    for (const row of preparedRows) {
      const duplicateKey = buildImportDuplicateKey(row);

      if (existingKeys.has(duplicateKey)) {
        skippedCount += 1;
        continue;
      }

      existingKeys.add(duplicateKey);
      nextRows.push(row);
    }

    rowsToImport = nextRows;
  }

  const importedCount = createRequests(rowsToImport);
  return res.status(201).json({ importedCount, skippedCount });
});

app.post("/api/requests", (req, res) => {
  const now = new Date().toISOString();
  const { errors, value } = validateRequestPayload(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const request = createRequest({
    ...value,
    createdAt: now,
    updatedAt: now
  });

  return res.status(201).json(request);
});

app.put("/api/requests/:id", (req, res) => {
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ errors: ["Identifiant invalide."] });
  }

  if (!findRequestById(requestId)) {
    return res.status(404).json({ errors: ["Demande introuvable."] });
  }

  const { errors, value } = validateRequestPayload(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const request = updateRequest(requestId, {
    ...value,
    updatedAt: new Date().toISOString()
  });

  return res.json(request);
});

app.patch("/api/requests/:id/status", (req, res) => {
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ errors: ["Identifiant invalide."] });
  }

  const status = normalizeStatus(req.body.status);

  if (!status) {
    return res.status(400).json({ errors: ["Statut invalide."] });
  }

  const request = updateRequestStatus(requestId, status, new Date().toISOString());

  if (!request) {
    return res.status(404).json({ errors: ["Demande introuvable."] });
  }

  return res.json(request);
});

app.delete("/api/requests/:id", (req, res) => {
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ errors: ["Identifiant invalide."] });
  }

  const deleted = deleteRequest(requestId);

  if (!deleted) {
    return res.status(404).json({ errors: ["Demande introuvable."] });
  }

  return res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Microwest API running on http://localhost:${PORT}`);
});
