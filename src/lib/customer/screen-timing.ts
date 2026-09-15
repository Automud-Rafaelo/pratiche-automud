import type { EventRow } from "@/lib/admin/types";
import {
  CUSTOMER_SCREEN_ORDER,
  isCustomerScreenId,
  type CustomerScreenId,
} from "@/lib/customer/navigation";

export const CUSTOMER_SCREEN_LABELS: Record<CustomerScreenId, string> = {
  welcome: "Apertura",
  owner: "Proprietario",
  owner_notice: "Avviso proprietario",
  first_name: "Nome intestatario conto",
  last_name: "Cognome intestatario conto",
  tax_code: "Codice fiscale",
  iban: "IBAN",
  plate: "Conferma targa",
  customer_plate: "Targa del cliente",
  agency_location: "Posizione per l'agenzia",
  coownership: "Cointestatari",
  coownership_notice: "Avviso cointestatari",
  keys: "Chiavi dell'auto",
  agency: "Scelta agenzia",
  agency_fallback: "Agenzia proposta da Automud",
  owner_availability: "Disponibilità proprietario",
  availability_notice: "Accordo orario su WhatsApp",
  appointment: "Preferenza appuntamento",
  pickup_location: "Luogo di ritiro",
  pickup_address: "Indirizzo di ritiro",
  pickup_phone: "Telefono per il ritiro",
  complete: "Completamento",
};

export type ScreenTiming = {
  eventId: string;
  screen: CustomerScreenId;
  durationMs: number;
  completedAt: string;
};

export type GroupedScreenTiming = {
  screen: CustomerScreenId;
  label: string;
  passCount: number;
  totalDurationMs: number;
};

export function calculateScreenDurationMs(
  events: EventRow[],
  screen: CustomerScreenId,
  completedAt = Date.now(),
) {
  let latestViewedAt = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    if (
      event.tipo !== "schermata_visualizzata" ||
      event.dettaglio.schermata !== screen
    ) {
      continue;
    }
    const viewedAt = Date.parse(event.created_at);
    if (
      Number.isFinite(viewedAt) &&
      viewedAt <= completedAt &&
      viewedAt > latestViewedAt
    ) {
      latestViewedAt = viewedAt;
    }
  }
  return Number.isFinite(latestViewedAt)
    ? Math.max(0, Math.round(completedAt - latestViewedAt))
    : 0;
}

export function createScreenCompletionDetail(
  events: EventRow[],
  screen: CustomerScreenId,
  completedAt = Date.now(),
) {
  return {
    schermata: screen,
    durata_ms: calculateScreenDurationMs(events, screen, completedAt),
  };
}

export function listScreenTimings(events: EventRow[]): ScreenTiming[] {
  return events.flatMap((event) => {
    if (event.tipo !== "schermata_completata") return [];
    const screen = event.dettaglio.schermata;
    const durationMs = event.dettaglio.durata_ms;
    if (
      typeof screen !== "string" ||
      !isCustomerScreenId(screen) ||
      typeof durationMs !== "number" ||
      !Number.isFinite(durationMs) ||
      durationMs < 0
    ) {
      return [];
    }
    return [
      {
        eventId: event.id,
        screen,
        durationMs,
        completedAt: event.created_at,
      },
    ];
  });
}

export function groupScreenTimings(events: EventRow[]): GroupedScreenTiming[] {
  const grouped = new Map<CustomerScreenId, GroupedScreenTiming>();
  for (const timing of listScreenTimings(events)) {
    const current = grouped.get(timing.screen);
    grouped.set(timing.screen, {
      screen: timing.screen,
      label: CUSTOMER_SCREEN_LABELS[timing.screen],
      passCount: (current?.passCount ?? 0) + 1,
      totalDurationMs: (current?.totalDurationMs ?? 0) + timing.durationMs,
    });
  }

  return CUSTOMER_SCREEN_ORDER.flatMap((screen) => {
    const timing = grouped.get(screen);
    return timing ? [timing] : [];
  });
}
