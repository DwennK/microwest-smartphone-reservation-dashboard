const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { initializeDatabase } = require("./db");
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
const clientDistPath = path.join(__dirname, "..", "..", "client", "dist");
const clientIndexPath = path.join(clientDistPath, "index.html");
const hasClientBuild = fs.existsSync(clientIndexPath);
const csvTextParser = express.text({
  type: ["text/csv", "application/csv", "text/plain"],
  limit: "2mb"
});
const allowedOriginPatterns = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
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

if (hasClientBuild) {
  app.use(express.static(clientDistPath, { index: false }));
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/options", (req, res) => {
  res.json({
    statuses: ALLOWED_STATUSES,
    storageCapacities: ALLOWED_STORAGE_CAPACITIES
  });
});

app.get("/api/requests", async (req, res) => {
  const filters = buildFilters(req.query);
  const requests = await listRequests(filters);
  res.json(requests);
});

app.get("/api/requests/export/csv", async (req, res) => {
  const requests = await listRequests(buildFilters({}));
  const csv = generateCsv(requests);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="microwest-requests.csv"');
  res.send(csv);
});

app.post("/api/requests/import/csv", csvTextParser, async (req, res) => {
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
    const existingKeys = await listImportDuplicateKeys();
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

  const importedCount = await createRequests(rowsToImport);
  return res.status(201).json({ importedCount, skippedCount });
});

app.post("/api/requests", async (req, res) => {
  const now = new Date().toISOString();
  const { errors, value } = validateRequestPayload(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const request = await createRequest({
    ...value,
    createdAt: now,
    updatedAt: now
  });

  return res.status(201).json(request);
});

app.put("/api/requests/:id", async (req, res) => {
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ errors: ["Identifiant invalide."] });
  }

  if (!(await findRequestById(requestId))) {
    return res.status(404).json({ errors: ["Demande introuvable."] });
  }

  const { errors, value } = validateRequestPayload(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const request = await updateRequest(requestId, {
    ...value,
    updatedAt: new Date().toISOString()
  });

  return res.json(request);
});

app.patch("/api/requests/:id/status", async (req, res) => {
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ errors: ["Identifiant invalide."] });
  }

  const status = normalizeStatus(req.body.status);

  if (!status) {
    return res.status(400).json({ errors: ["Statut invalide."] });
  }

  const request = await updateRequestStatus(requestId, status, new Date().toISOString());

  if (!request) {
    return res.status(404).json({ errors: ["Demande introuvable."] });
  }

  return res.json(request);
});

app.delete("/api/requests/:id", async (req, res) => {
  const requestId = Number(req.params.id);

  if (!Number.isInteger(requestId)) {
    return res.status(400).json({ errors: ["Identifiant invalide."] });
  }

  const deleted = await deleteRequest(requestId);

  if (!deleted) {
    return res.status(404).json({ errors: ["Demande introuvable."] });
  }

  return res.status(204).send();
});

if (hasClientBuild) {
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    return res.sendFile(clientIndexPath);
  });
}

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({ errors: ["Erreur interne du serveur."] });
});

async function start() {
  await initializeDatabase();

  app.listen(PORT, () => {
    const appType = hasClientBuild ? "Microwest app" : "Microwest API";
    console.log(`${appType} running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Impossible de demarrer le serveur:", error);
  process.exit(1);
});
