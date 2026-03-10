const STATUS_LABELS = {
  en_attente: "En attente",
  contacte: "Contacte",
  vendu: "Vendu",
  annule: "Annule"
};

function escapeCsvValue(value) {
  const normalized = value ?? "";
  const stringValue = String(normalized);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function generateCsv(requests) {
  const headers = [
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

  const rows = requests.map((request) => [
    request.customerName,
    request.phoneNumber,
    request.requestedModel,
    request.storageCapacity ?? "",
    request.requestDate,
    STATUS_LABELS[request.status] || request.status,
    request.notes,
    request.createdAt,
    request.updatedAt
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

module.exports = {
  generateCsv
};
