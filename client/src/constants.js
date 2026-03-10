export const STORAGE_OPTIONS = ["64 GB", "128 GB", "256 GB", "512 GB"];
export const APP_VERSION = "2026.03.10";

export const STATUS_OPTIONS = [
  { value: "en_attente", label: "En attente" },
  { value: "contacte", label: "Contacté" },
  { value: "vendu", label: "Vendu" },
  { value: "annule", label: "Annulé" }
];

export const STATUS_STYLES = {
  en_attente: "bg-amber-100 text-amber-900 ring-amber-200",
  contacte: "bg-sky-100 text-sky-900 ring-sky-200",
  vendu: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  annule: "bg-rose-100 text-rose-900 ring-rose-200"
};
