const express = require("express");
const cors = require("cors");
const path = require("path");
const { ALLOWED_STATUSES, ALLOWED_STORAGE_CAPACITIES } = require("./constants");
const {
  createRequest,
  deleteRequest,
  findRequestById,
  listRequests,
  updateRequest,
  updateRequestStatus
} = require("./repository");
const { generateCsv } = require("./csv");
const { buildFilters, normalizeStatus, validateRequestPayload } = require("./utils");

const app = express();
const PORT = process.env.PORT || 3001;
const clientDistPath = path.join(__dirname, "..", "..", "client", "dist");

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"]
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
  const filters = buildFilters(req.query);
  const requests = listRequests(filters);
  const csv = generateCsv(requests);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="microwest-requests.csv"');
  res.send(csv);
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

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDistPath));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Microwest API running on http://localhost:${PORT}`);
});
