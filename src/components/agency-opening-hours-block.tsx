import type { AppointmentSlot } from "@/lib/config/business-rules";
import { customerCopy } from "@/lib/copy/customer";
import { getAgencyScheduleForDate } from "@/lib/domain/agency-opening-hours";

function formatDay(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function AgencyOpeningHoursBlock({
  hours,
  preferenceDate,
  preferenceSlot,
  phone,
}: {
  hours: unknown | null;
  preferenceDate: string | null;
  preferenceSlot: AppointmentSlot | null;
  phone: string | null;
}) {
  const schedule = preferenceDate
    ? getAgencyScheduleForDate(hours, preferenceDate)
    : null;
  const slotDefinitions: Array<{
    id: AppointmentSlot;
    label: string;
  }> = [
    { id: "mattina", label: customerCopy.openingHours.morning },
    { id: "pomeriggio", label: customerCopy.openingHours.afternoon },
  ];

  return (
    <section className="mt-4 rounded-3xl border border-[#E5DED2] bg-white p-5">
      <h2 className="text-xl font-bold text-[#3B2314]">
        {customerCopy.openingHours.title}
      </h2>
      {schedule ? (
        <>
          {schedule.shiftedToNextWorkingDay ? (
            <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {customerCopy.openingHours.closedDay
                .replace("{requestedDate}", formatDay(schedule.requestedDate))
                .replace("{nextDate}", formatDay(schedule.effectiveDate))}
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            {slotDefinitions.map(({ id, label }) => {
              const ranges = schedule.slots[id];
              if (ranges.length === 0) return null;
              const selected = preferenceSlot === id;
              return (
                <p
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    selected
                      ? "bg-[#F7941D] font-bold text-white"
                      : "bg-[#FFF8EA] text-[#3B2314]"
                  }`}
                  key={id}
                >
                  {label}: {ranges.map((range) => range.label).join(" · ")}
                  {selected ? ` · ${customerCopy.openingHours.selected}` : ""}
                </p>
              );
            })}
          </div>
        </>
      ) : phone ? (
        <a
          className="mt-3 inline-block font-bold text-[#3B2314] underline underline-offset-4"
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
        >
          {customerCopy.openingHours.callForHours}: {phone}
        </a>
      ) : null}
      <p className="mt-3 text-sm leading-5 text-[#3B2314]">
        {customerCopy.openingHours.instructions}
      </p>
    </section>
  );
}
