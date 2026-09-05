import Link from "next/link";
import { redirect } from "next/navigation";

import { AgencyQuestion } from "@/components/customer/agency-question";
import { AppointmentQuestion } from "@/components/customer/appointment-question";
import { ChoiceQuestion } from "@/components/customer/choice-question";
import { CustomerShell } from "@/components/customer/customer-shell";
import {
  primaryButtonClass,
  QuestionFrame,
} from "@/components/customer/question-frame";
import { TextQuestion } from "@/components/customer/text-question";
import { formatMoney } from "@/lib/admin/format";
import type { AgencyRow } from "@/lib/admin/types";
import {
  BUSINESS_RULES,
  getAppointmentPreferenceOptions,
} from "@/lib/config/business-rules";
import { customerCopy } from "@/lib/copy/customer";
import { findNearbyAgencies } from "@/lib/customer/agencies";
import {
  loadCustomerPractice,
  recordCustomerEvent,
  recordCustomerEventOnce,
} from "@/lib/customer/data";
import {
  getCustomerNavigationContext,
  getCustomerProgress,
  getVisibleCustomerScreen,
} from "@/lib/customer/flow";
import {
  getPreviousCustomerScreen,
  type CustomerNavigationContext,
  type CustomerScreenId,
} from "@/lib/customer/navigation";
import { getWhatsAppUrl } from "@/lib/customer/whatsapp";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import {
  acknowledgeAvailabilityNoticeAction,
  acknowledgeCoownershipNoticeAction,
  acknowledgeOwnerNoticeAction,
  continueWithoutAgencyAction,
  saveAgencyAction,
  saveAppointmentPreferenceAction,
  saveCoownershipAction,
  saveCustomerPlateAction,
  saveFirstNameAction,
  saveIbanAction,
  saveKeysAction,
  saveLastNameAction,
  saveOwnerAction,
  saveOwnerAvailabilityAction,
  savePickupAddressAction,
  savePickupLocationAction,
  savePickupPhoneAction,
  savePlateConfirmationAction,
  savePostalCodeAction,
  saveTaxCodeAction,
  startCustomerFlowAction,
} from "./actions";

type CustomerPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ view?: string; error?: string }>;
};

export const dynamic = "force-dynamic";

function ActionButton({
  action,
  token,
  screen,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  screen: CustomerScreenId;
  label: string;
}) {
  return (
    <form action={action} className="text-center">
      <input name="token" type="hidden" value={token} />
      <input name="screen" type="hidden" value={screen} />
      <button className={primaryButtonClass} type="submit">
        {label}
      </button>
    </form>
  );
}

function WhatsAppLink({ children }: { children: string }) {
  return (
    <Link
      className="font-bold text-[#3B2314] underline underline-offset-4"
      href={getWhatsAppUrl()}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </Link>
  );
}

function getBackHref(
  token: string,
  screen: CustomerScreenId,
  navigation: CustomerNavigationContext,
) {
  const previous = getPreviousCustomerScreen(screen, navigation);
  return previous ? `/p/${token}?view=${previous}#top` : null;
}

function getServerErrorMessage(screen: CustomerScreenId, errorCode?: string) {
  if (screen === "tax_code") return customerCopy.taxCode.error;
  if (screen === "iban") return customerCopy.iban.error;
  if (screen === "postal_code") {
    return errorCode === "postal_not_found"
      ? customerCopy.postalCode.notFoundError
      : customerCopy.postalCode.error;
  }
  if (screen === "pickup_phone") return customerCopy.pickupPhone.error;
  return customerCopy.temporaryError.description;
}

type TextScreenId =
  | "first_name"
  | "last_name"
  | "tax_code"
  | "iban"
  | "customer_plate"
  | "postal_code"
  | "pickup_address"
  | "pickup_phone";

const CUSTOMER_TEXT_FIELDS: Record<TextScreenId, string> = {
  first_name: "nome",
  last_name: "cognome",
  tax_code: "codice_fiscale",
  iban: "iban",
  customer_plate: "targa_cliente",
  postal_code: "cap",
  pickup_address: "indirizzo_ritiro",
  pickup_phone: "telefono_ritiro",
};

function TextScreenPage({
  action,
  token,
  screen,
  title,
  description,
  label,
  placeholder,
  defaultValue,
  progress,
  backHref,
  errorMessage,
  validationKind = "text",
  inputMode = "text",
  autoComplete,
  autoCapitalize,
  warningMessage,
}: {
  action: (formData: FormData) => void | Promise<void>;
  token: string;
  screen: TextScreenId;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  progress: { current: number; total: number };
  backHref: string | null;
  errorMessage: string | null;
  validationKind?:
    | "text"
    | "tax_code"
    | "iban"
    | "vehicle_plate"
    | "postal_code"
    | "phone";
  inputMode?: "text" | "numeric" | "tel";
  autoComplete?: string;
  autoCapitalize?: "none" | "characters" | "words";
  warningMessage?: string;
}) {
  return (
    <CustomerShell key={screen}>
      <QuestionFrame
        backHref={backHref}
        description={description}
        progress={progress}
        title={title}
      >
        {errorMessage ? (
          <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        ) : null}
        <TextQuestion
          key={screen}
          action={action}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          errorMessage={
            validationKind === "tax_code"
              ? customerCopy.taxCode.error
              : validationKind === "iban"
                ? customerCopy.iban.error
                : validationKind === "postal_code"
                  ? customerCopy.postalCode.error
                  : validationKind === "phone"
                    ? customerCopy.pickupPhone.error
                    : undefined
          }
          inputMode={inputMode}
          label={label}
          name={CUSTOMER_TEXT_FIELDS[screen]}
          placeholder={placeholder}
          screen={screen}
          token={token}
          validationKind={validationKind}
          warningMessage={warningMessage}
        />
      </QuestionFrame>
    </CustomerShell>
  );
}

function getRomeDate(offset: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_RULES.appointmentPreference.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = new Date(
    Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) + offset, 12),
  );
  return date.toISOString().slice(0, 10);
}

function formatAppointmentDate(date: string) {
  const formatted = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  const prefix =
    date === getRomeDate(0)
      ? customerCopy.dateLabels.today
      : date === getRomeDate(1)
        ? customerCopy.dateLabels.tomorrow
        : null;
  return prefix ? `${prefix}, ${formatted}` : formatted;
}

export default async function CustomerPage({
  params,
  searchParams,
}: CustomerPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const context = await loadCustomerPractice(token);

  if (!context) {
    return (
      <CustomerShell key="invalid">
        <section className="pt-8 text-center">
          <h1 className="text-[28px] font-bold leading-tight">
            {customerCopy.invalidLink.title}
          </h1>
          <p className="mt-4 text-[17px]">
            <WhatsAppLink>{customerCopy.invalidLink.description}</WhatsAppLink>
          </p>
        </section>
      </CustomerShell>
    );
  }

  const { practice, events } = context;
  if (practice.status === "creata") {
    await recordCustomerEventOnce(practice.id, "link_aperto");
  }
  const screen = getVisibleCustomerScreen(practice, events, query.view);
  const navigation = getCustomerNavigationContext(practice, events);
  const progress = getCustomerProgress(screen, navigation);
  const frameProps = {
    progress,
    backHref: getBackHref(token, screen, navigation),
  };
  const errorMessage = query.error
    ? getServerErrorMessage(screen, query.error)
    : null;
  const error = errorMessage ? (
    <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {errorMessage}
    </p>
  ) : null;

  if (screen === "welcome") {
    return (
      <CustomerShell key={screen}>
        <QuestionFrame
          {...frameProps}
          description={customerCopy.welcome.description}
          title={customerCopy.welcome.title}
        >
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#E5DED2]">
            <p className="text-sm font-bold uppercase tracking-wide text-[#F7941D]">
              {customerCopy.welcome.vehicle}
            </p>
            <p className="mt-1 text-3xl font-extrabold">{practice.targa}</p>
            <p className="mt-1 text-[17px]">
              {practice.marca} {practice.modello}
            </p>
            <p className="mt-4 text-sm">{customerCopy.welcome.agreedPrice}</p>
            <p className="text-xl font-bold">
              {formatMoney(practice.prezzo_concordato)}
            </p>
          </div>
          <div className="mt-3">
            <ActionButton
              action={startCustomerFlowAction}
              label={customerCopy.actions.start}
              screen="welcome"
              token={token}
            />
          </div>
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "owner") {
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.owner}>
          {error}
          <ChoiceQuestion
            key={screen}
            action={saveOwnerAction}
            defaultValue={
              practice.is_proprietario === null
                ? undefined
                : practice.is_proprietario
                  ? "yes"
                  : "no"
            }
            name="is_owner"
            options={[
              { value: "yes", label: customerCopy.owner.yes },
              { value: "no", label: customerCopy.owner.no },
            ]}
            screen="owner"
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "owner_notice") {
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.ownerNotice}>
          <ActionButton
            action={acknowledgeOwnerNoticeAction}
            label={customerCopy.actions.understood}
            screen="owner_notice"
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "first_name") {
    return <TextScreenPage {...frameProps} {...customerCopy.firstName} action={saveFirstNameAction} autoCapitalize="words" autoComplete="given-name" defaultValue={practice.nome ?? ""} errorMessage={errorMessage} screen={screen} token={token} />;
  }
  if (screen === "last_name") {
    return <TextScreenPage {...frameProps} {...customerCopy.lastName} action={saveLastNameAction} autoCapitalize="words" autoComplete="family-name" defaultValue={practice.cognome ?? ""} errorMessage={errorMessage} screen={screen} token={token} />;
  }
  if (screen === "tax_code") {
    return <TextScreenPage {...frameProps} {...customerCopy.taxCode} action={saveTaxCodeAction} autoCapitalize="characters" autoComplete="off" defaultValue={practice.codice_fiscale ?? ""} errorMessage={errorMessage} screen={screen} token={token} validationKind="tax_code" />;
  }
  if (screen === "iban") {
    const description = practice.is_proprietario === false
      ? `${customerCopy.iban.description} ${customerCopy.iban.ownerDescription}`
      : customerCopy.iban.description;
    return <TextScreenPage {...frameProps} {...customerCopy.iban} action={saveIbanAction} autoCapitalize="characters" autoComplete="off" defaultValue={practice.iban ?? ""} description={description} errorMessage={errorMessage} screen={screen} token={token} validationKind="iban" />;
  }
  if (screen === "customer_plate") {
    return <TextScreenPage {...frameProps} {...customerCopy.customerPlate} action={saveCustomerPlateAction} autoCapitalize="characters" autoComplete="off" defaultValue={practice.targa_cliente ?? ""} errorMessage={errorMessage} screen={screen} token={token} validationKind="vehicle_plate" warningMessage={customerCopy.customerPlate.warning} />;
  }
  if (screen === "postal_code") {
    return <TextScreenPage {...frameProps} {...customerCopy.postalCode} action={savePostalCodeAction} autoCapitalize="none" autoComplete="postal-code" defaultValue={practice.cap ?? ""} errorMessage={errorMessage} inputMode="numeric" screen={screen} token={token} validationKind="postal_code" />;
  }
  if (screen === "pickup_address") {
    const description = practice.ubicazione_auto === "casa"
      ? customerCopy.pickupAddress.descriptions.home
      : customerCopy.pickupAddress.descriptions.business;
    return <TextScreenPage {...frameProps} {...customerCopy.pickupAddress} action={savePickupAddressAction} autoCapitalize="words" autoComplete="street-address" defaultValue={practice.indirizzo_ritiro ?? ""} description={description} errorMessage={errorMessage} screen={screen} token={token} />;
  }
  if (screen === "pickup_phone") {
    return <TextScreenPage {...frameProps} {...customerCopy.pickupPhone} action={savePickupPhoneAction} autoCapitalize="none" autoComplete="tel" defaultValue={practice.telefono_ritiro ?? ""} errorMessage={errorMessage} inputMode="tel" screen={screen} token={token} validationKind="phone" />;
  }

  if (screen === "plate") {
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.plate}>
          <p className="mb-5 text-center text-5xl font-extrabold tracking-wider">
            {practice.targa}
          </p>
          <ChoiceQuestion
            key={screen}
            action={savePlateConfirmationAction}
            name="plate_confirmation"
            options={[
              { value: "confirm", label: customerCopy.plate.confirm },
              { value: "dispute", label: customerCopy.plate.dispute },
            ]}
            screen="plate"
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "coownership_notice" || screen === "availability_notice") {
    const notice =
      screen === "coownership_notice"
        ? { copy: customerCopy.coownershipNotice, action: acknowledgeCoownershipNoticeAction }
        : { copy: customerCopy.availabilityNotice, action: acknowledgeAvailabilityNoticeAction };
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...notice.copy}>
          <ActionButton
            action={notice.action}
            label={customerCopy.actions.understood}
            screen={screen}
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "coownership" || screen === "keys" || screen === "owner_availability") {
    const definition =
      screen === "coownership"
        ? { copy: customerCopy.coownership, action: saveCoownershipAction, name: "coownership", value: practice.cointestata }
        : screen === "keys"
          ? { copy: customerCopy.keys, action: saveKeysAction, name: "both_keys", value: practice.due_chiavi }
          : { copy: customerCopy.ownerAvailability, action: saveOwnerAvailabilityAction, name: "knows_availability", value: practice.conosce_orari_proprietario };
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...definition.copy}>
          {error}
          <ChoiceQuestion
            key={screen}
            action={definition.action}
            defaultValue={definition.value === null ? undefined : definition.value ? "yes" : "no"}
            name={definition.name}
            options={[
              { value: "yes", label: definition.copy.yes },
              { value: "no", label: definition.copy.no },
            ]}
            screen={screen}
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "agency") {
    const nearby = practice.cap
      ? await findNearbyAgencies(practice.id, practice.cap)
      : { ok: false as const, reason: "not_found" as const, error: "CAP assente" };
    if (!nearby.ok) {
      if (nearby.reason === "not_found") {
        redirect(`/p/${token}?view=postal_code&error=postal_not_found#top`);
      }
      if (practice.cap) {
        await recordCustomerEvent(
          practice.id,
          "geocoding_fallito",
          { cap: practice.cap, errore: nearby.error },
        );
      }
      const fallbackNavigation = {
        ...navigation,
        useAgencyFallback: true,
      };
      return (
        <CustomerShell key="agency_fallback">
          <QuestionFrame
            backHref={getBackHref(token, "agency_fallback", fallbackNavigation)}
            progress={getCustomerProgress("agency_fallback", fallbackNavigation)}
            {...customerCopy.agencyFallback}
          >
            <ActionButton
              action={continueWithoutAgencyAction}
              label={customerCopy.actions.continue}
              screen="agency_fallback"
              token={token}
            />
          </QuestionFrame>
        </CustomerShell>
      );
    }

    if (nearby.noneWithinRadius && practice.cap) {
      await recordCustomerEventOnce(
        practice.id,
        "nessuna_agenzia_nel_raggio",
        { cap: practice.cap, raggio_km: BUSINESS_RULES.nearbyAgencies.radiusKm },
        { key: "cap", value: practice.cap },
      );
    }

    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.agency}>
          {error}
          {nearby.noneWithinRadius ? (
            <p className="mb-4 rounded-2xl bg-[#F9DDB5]/60 px-4 py-3 text-sm font-medium leading-5">
              {customerCopy.agency.outsideRadius.replace(
                "{radius}",
                String(BUSINESS_RULES.nearbyAgencies.radiusKm),
              )}
            </p>
          ) : null}
          <AgencyQuestion
            action={saveAgencyAction}
            agencies={nearby.agencies}
            defaultValue={practice.agenzia_id}
            token={token}
          />
          <p className="mt-4 text-center text-sm">
            <WhatsAppLink>{customerCopy.agency.noChoice}</WhatsAppLink>
          </p>
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "agency_fallback") {
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.agencyFallback}>
          <ActionButton
            action={continueWithoutAgencyAction}
            label={customerCopy.actions.continue}
            screen="agency_fallback"
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "appointment") {
    const options = getAppointmentPreferenceOptions().map((option) => ({
      ...option,
      label: formatAppointmentDate(option.date),
    }));
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.appointment}>
          {error}
          <AppointmentQuestion
            action={saveAppointmentPreferenceAction}
            defaultDate={practice.preferenza_data}
            defaultSlot={practice.preferenza_fascia}
            options={options}
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  if (screen === "pickup_location") {
    return (
      <CustomerShell key={screen}>
        <QuestionFrame {...frameProps} {...customerCopy.pickupLocation}>
          {error}
          <ChoiceQuestion
            key={screen}
            action={savePickupLocationAction}
            defaultValue={practice.ubicazione_auto ?? undefined}
            name="pickup_location"
            options={[
              { value: "casa", label: customerCopy.pickupLocation.home },
              { value: "deposito", label: customerCopy.pickupLocation.storage },
              { value: "carrozzeria", label: customerCopy.pickupLocation.bodyShop },
            ]}
            screen="pickup_location"
            token={token}
          />
        </QuestionFrame>
      </CustomerShell>
    );
  }

  const selectedAgency = practice.agenzia_id
    ? await loadSelectedAgency(practice.id, practice.agenzia_id)
    : null;
  const selectedDate = practice.preferenza_data
    ? formatAppointmentDate(practice.preferenza_data)
    : null;
  return (
    <CustomerShell key={screen}>
      <QuestionFrame
        backHref={null}
        description={undefined}
        progress={getCustomerProgress("complete", navigation)}
        title={customerCopy.complete.title}
      >
        <ul className="space-y-3 rounded-3xl bg-white p-5 text-[17px] shadow-sm ring-1 ring-[#E5DED2]">
          <li>• {customerCopy.complete.appointment}</li>
          {selectedDate && practice.preferenza_fascia ? (
            <li>
              • {customerCopy.complete.preferredAppointment
                .replace("{date}", selectedDate)
                .replace("{slot}", practice.preferenza_fascia)}
            </li>
          ) : null}
          <li>
            • {practice.due_chiavi
              ? customerCopy.complete.bothKeys
              : customerCopy.complete.keys}
          </li>
          {practice.ubicazione_auto && practice.ubicazione_auto !== "casa" ? (
            <li>• {customerCopy.complete.businessPickup}</li>
          ) : null}
          <li>
            • {customerCopy.complete.towTruck.replace(
              "{phone}",
              practice.telefono_ritiro ?? "—",
            )}
          </li>
        </ul>
        {selectedAgency ? (
          <div className="mt-4 rounded-3xl bg-[#F9DDB5]/60 p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-[#F7941D]">
              {customerCopy.complete.selectedAgency}
            </p>
            <p className="mt-1 text-lg font-bold">{selectedAgency.nome}</p>
            <p className="mt-1 text-sm">{selectedAgency.indirizzo}</p>
            {selectedAgency.telefono ? (
              <p className="mt-2 text-sm font-bold">{selectedAgency.telefono}</p>
            ) : null}
          </div>
        ) : null}
        <p className="mt-6 text-center text-[17px]">
          <WhatsAppLink>{customerCopy.complete.contact}</WhatsAppLink>
        </p>
      </QuestionFrame>
    </CustomerShell>
  );
}

async function loadSelectedAgency(practiceId: string, agencyId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agenzie")
    .select("*")
    .eq("id", agencyId)
    .maybeSingle();
  if (error) {
    await reportExternalServiceError({
      source: "Supabase",
      message: `Riepilogo agenzia cliente non disponibile: ${error.message}`,
      practiceId,
    });
    return null;
  }
  return data as AgencyRow | null;
}
