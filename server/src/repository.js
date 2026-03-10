const db = require("./db");
const { serializeRequest } = require("./utils");

function buildWhereClause(filters) {
  const conditions = [];
  const params = {};

  if (filters.search) {
    conditions.push("(customerName LIKE @search OR phoneNumber LIKE @search OR notes LIKE @search)");
    params.search = `%${filters.search}%`;
  }

  if (filters.model) {
    conditions.push("requestedModel = @model");
    params.model = filters.model;
  }

  if (filters.storage) {
    conditions.push("storageCapacity = @storage");
    params.storage = filters.storage;
  }

  if (filters.pendingOnly) {
    conditions.push("status = 'en_attente'");
  } else if (filters.status) {
    conditions.push("status = @status");
    params.status = filters.status;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return { params, whereClause };
}

function listRequests(filters) {
  const { whereClause, params } = buildWhereClause(filters);
  const orderBy = filters.sort === "oldest" ? "ASC" : "DESC";

  const query = `
    SELECT *
    FROM requests
    ${whereClause}
    ORDER BY requestDate ${orderBy}, createdAt ${orderBy}
  `;

  return db.prepare(query).all(params).map(serializeRequest);
}

function findRequestById(id) {
  const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
  return row ? serializeRequest(row) : null;
}

function buildImportDuplicateKey(request) {
  return [
    String(request.customerName ?? "").trim().toLowerCase(),
    String(request.phoneNumber ?? "").trim().toLowerCase(),
    String(request.requestedModel ?? "").trim().toLowerCase(),
    String(request.requestDate ?? "").trim()
  ].join("|");
}

function listImportDuplicateKeys() {
  const rows = db
    .prepare(
      `
        SELECT customerName, phoneNumber, requestedModel, requestDate
        FROM requests
      `
    )
    .all();

  return new Set(rows.map(buildImportDuplicateKey));
}

function createRequest(payload) {
  const statement = db.prepare(`
    INSERT INTO requests (
      customerName,
      phoneNumber,
      brand,
      requestedModel,
      storageCapacity,
      requestDate,
      status,
      notes,
      createdAt,
      updatedAt
    ) VALUES (
      @customerName,
      @phoneNumber,
      @brand,
      @requestedModel,
      @storageCapacity,
      @requestDate,
      @status,
      @notes,
      @createdAt,
      @updatedAt
    )
  `);

  const result = statement.run(payload);
  return findRequestById(result.lastInsertRowid);
}

function createRequests(payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return 0;
  }

  const statement = db.prepare(`
    INSERT INTO requests (
      customerName,
      phoneNumber,
      brand,
      requestedModel,
      storageCapacity,
      requestDate,
      status,
      notes,
      createdAt,
      updatedAt
    ) VALUES (
      @customerName,
      @phoneNumber,
      @brand,
      @requestedModel,
      @storageCapacity,
      @requestDate,
      @status,
      @notes,
      @createdAt,
      @updatedAt
    )
  `);

  db.exec("BEGIN");

  try {
    for (const payload of payloads) {
      statement.run(payload);
    }

    db.exec("COMMIT");
    return payloads.length;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function updateRequest(id, payload) {
  const statement = db.prepare(`
    UPDATE requests
    SET
      customerName = @customerName,
      phoneNumber = @phoneNumber,
      brand = @brand,
      requestedModel = @requestedModel,
      storageCapacity = @storageCapacity,
      requestDate = @requestDate,
      status = @status,
      notes = @notes,
      updatedAt = @updatedAt
    WHERE id = @id
  `);

  const result = statement.run({
    ...payload,
    id
  });

  return result.changes ? findRequestById(id) : null;
}

function updateRequestStatus(id, status, updatedAt) {
  const statement = db.prepare(`
    UPDATE requests
    SET status = @status, updatedAt = @updatedAt
    WHERE id = @id
  `);

  const result = statement.run({ id, status, updatedAt });
  return result.changes ? findRequestById(id) : null;
}

function deleteRequest(id) {
  const statement = db.prepare("DELETE FROM requests WHERE id = ?");
  const result = statement.run(id);
  return result.changes > 0;
}

module.exports = {
  buildImportDuplicateKey,
  createRequest,
  createRequests,
  deleteRequest,
  findRequestById,
  listRequests,
  listImportDuplicateKeys,
  updateRequest,
  updateRequestStatus
};
