function buildQueryString(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) {
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}

async function parseResponse(response) {
  if (response.ok) {
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  let message = "Une erreur est survenue.";

  try {
    const data = await response.json();

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      message = data.errors.join(" ");
    }
  } catch {
    message = "Une erreur est survenue.";
  }

  throw new Error(message);
}

export async function fetchRequests(filters = {}) {
  const query = buildQueryString(filters);
  const response = await fetch(query ? `/api/requests?${query}` : "/api/requests");
  return parseResponse(response);
}

export async function fetchOptions() {
  const response = await fetch("/api/options");
  return parseResponse(response);
}

export async function createRequest(payload) {
  const response = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function updateRequest(id, payload) {
  const response = await fetch(`/api/requests/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function updateRequestStatus(id, status) {
  const response = await fetch(`/api/requests/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });

  return parseResponse(response);
}

export async function deleteRequest(id) {
  const response = await fetch(`/api/requests/${id}`, {
    method: "DELETE"
  });

  return parseResponse(response);
}

export async function importRequestsCsv(csvText, options = {}) {
  const query = buildQueryString({
    ignoreDuplicates: options.ignoreDuplicates ?? false
  });
  const response = await fetch(query ? `/api/requests/import/csv?${query}` : "/api/requests/import/csv", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText
  });

  return parseResponse(response);
}

export function getExportUrl() {
  return "/api/requests/export/csv";
}
