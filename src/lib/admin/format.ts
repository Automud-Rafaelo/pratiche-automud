import type { PracticeStatus } from "@/lib/config/business-rules";

const statusLabels: Record<PracticeStatus, string> = {
  creata: "Creata",
  step1_dati: "Dati personali",
  step2_agenzia: "Scelta agenzia",
  step3_appuntamento: "Preferenza appuntamento",
  step4_ritiro: "Dati ritiro",
  completata: "Completata",
};

export function formatStatus(status: PracticeStatus) {
  return statusLabels[status];
}

export function formatBoolean(value: boolean | null) {
  if (value === null) return "—";
  return value ? "Sì" : "No";
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00+02:00`),
  );
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

export function buildCustomerLink(token: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const baseUrl = configuredUrl || "http://localhost:3000";
  return `${baseUrl}/p/${token}`;
}
