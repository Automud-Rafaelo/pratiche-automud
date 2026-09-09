import type { EventRow } from "@/lib/admin/types";
import type { CustomerScreenId } from "@/lib/customer/navigation";

export type ScreenTiming = {
  eventId: string;
  screen: string;
  durationMs: number;
  completedAt: string;
};

export function calculateScreenDurationMs(
  events: EventRow[],
  screen: CustomerScreenId,
  completedAt = Date.now(),
) {
  const viewEvent = events.find(
    (event) =>
      event.tipo === "schermata_visualizzata" &&
      event.dettaglio.schermata === screen,
  );
  if (!viewEvent) return 0;

  const viewedAt = Date.parse(viewEvent.created_at);
  if (!Number.isFinite(viewedAt)) return 0;
  return Math.max(0, Math.round(completedAt - viewedAt));
}

export function listScreenTimings(events: EventRow[]): ScreenTiming[] {
  return events.flatMap((event) => {
    if (event.tipo !== "schermata_completata") return [];
    const screen = event.dettaglio.schermata;
    const durationMs = event.dettaglio.durata_ms;
    if (
      typeof screen !== "string" ||
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
