const { db } = require("./db");
const { serializeRequest } = require("./utils");

function buildWhereClause(filters) {
  const conditions = [];
  const args = [];

  if (filters.search) {
    conditions.push("(customerName LIKE ? OR phoneNumber LIKE ? OR notes LIKE ?)");
    const searchValue = `%${filters.search}%`;
    args.push(searchValue, searchValue, searchValue);
  }

  if (filters.model) {
    conditions.push("requestedModel = ?");
    args.push(filters.model);
  }

  if (filters.storage) {
    conditions.push("storageCapacity = ?");
    args.push(filters.storage);
  }

  if (filters.pendingOnly) {
    conditions.push("status = 'en_attente'");
  } else if (filters.status) {
    conditions.push("status = ?");
    args.push(filters.status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return { args, whereClause };
}

function mapRows(rows) {
  return rows.map((row) => serializeRequest({ ...row }));
}

async function listRequests(filters) {
  const { whereClause, args } = buildWhereClause(filters);
  const orderBy = filters.sort === "oldest" ? "ASC" : "DESC";

  const result = await db.execute({
    sql: `
      SELECT *
      FROM requests
      ${whereClause}
      ORDER BY requestDate ${orderBy}, createdAt ${orderBy}
    `,
    args
  });

  return mapRows(result.rows);
}

async function findRequestById(id) {
  const result = await db.execute({
    sql: "SELECT * FROM requests WHERE id = ?",
    args: [id]
  });
  const row = result.rows[0];
  return row ? serializeRequest({ ...row }) : null;
}

function buildImportDuplicateKey(request) {
  return [
    String(request.customerName ?? "").trim().toLowerCase(),
    String(request.phoneNumber ?? "").trim().toLowerCase(),
    String(request.requestedModel ?? "").trim().toLowerCase(),
    String(request.requestDate ?? "").trim()
  ].join("|");
}

async function listImportDuplicateKeys() {
  const result = await db.execute(`
    SELECT customerName, phoneNumber, requestedModel, requestDate
    FROM requests
  `);

  return new Set(result.rows.map((row) => buildImportDuplicateKey({ ...row })));
}

async function createRequest(payload) {
  const result = await db.execute({
    sql: `
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      payload.customerName,
      payload.phoneNumber,
      payload.brand,
      payload.requestedModel,
      payload.storageCapacity,
      payload.requestDate,
      payload.status,
      payload.notes,
      payload.createdAt,
      payload.updatedAt
    ]
  });

  return findRequestById(Number(result.lastInsertRowid));
}

async function createRequests(payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return 0;
  }

  await db.batch(
    payloads.map((payload) => ({
      sql: `
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        payload.customerName,
        payload.phoneNumber,
        payload.brand,
        payload.requestedModel,
        payload.storageCapacity,
        payload.requestDate,
        payload.status,
        payload.notes,
        payload.createdAt,
        payload.updatedAt
      ]
    })),
    "write"
  );

  return payloads.length;
}

async function updateRequest(id, payload) {
  const result = await db.execute({
    sql: `
      UPDATE requests
      SET
        customerName = ?,
        phoneNumber = ?,
        brand = ?,
        requestedModel = ?,
        storageCapacity = ?,
        requestDate = ?,
        status = ?,
        notes = ?,
        updatedAt = ?
      WHERE id = ?
    `,
    args: [
      payload.customerName,
      payload.phoneNumber,
      payload.brand,
      payload.requestedModel,
      payload.storageCapacity,
      payload.requestDate,
      payload.status,
      payload.notes,
      payload.updatedAt,
      id
    ]
  });

  return result.rowsAffected ? findRequestById(id) : null;
}

async function updateRequestStatus(id, status, updatedAt) {
  const result = await db.execute({
    sql: `
      UPDATE requests
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `,
    args: [status, updatedAt, id]
  });

  return result.rowsAffected ? findRequestById(id) : null;
}

async function deleteRequest(id) {
  const result = await db.execute({
    sql: "DELETE FROM requests WHERE id = ?",
    args: [id]
  });

  return result.rowsAffected > 0;
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
