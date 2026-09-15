"use server";

import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/auth";
import { recordAdminEvent } from "@/lib/admin/events";
import {
  BUSINESS_RULES,
  normalizeVehicleName,
  normalizeVehiclePlate,
  parseMoneyAmount,
  PRACTICE_TYPES,
} from "@/lib/config/business-rules";
import {
  createPracticeIdempotently,
  formatRecentPracticeAge,
  isValidPracticeCreationToken,
  type PracticeCreationInput,
  type PracticeCreationRepository,
} from "@/lib/domain/practice-creation";
import { reportExternalServiceError } from "@/lib/external-service-errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type CreatePracticeActionState = {
  error: string | null;
  duplicate: {
    id: string;
    plate: string;
    createdAgo: string;
  } | null;
};

const INVALID_STATE: CreatePracticeActionState = {
  error: "Controlla i campi inseriti e riprova.",
  duplicate: null,
};

async function serviceErrorState(error: unknown) {
  const cause =
    error instanceof Error ? error.message : "errore Supabase sconosciuto";
  const message = "Supabase: creazione pratica fallita: " + cause;
  await reportExternalServiceError({ source: "Supabase", message });
  return {
    error: "Operazione non riuscita. Causa: " + message,
    duplicate: null,
  } satisfies CreatePracticeActionState;
}

function createRepository(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
): PracticeCreationRepository {
  return {
    async findByCreationToken(creationToken) {
      const { data, error } = await supabase
        .from("pratiche")
        .select("id")
        .eq("creazione_token", creationToken)
        .maybeSingle();
      if (error) {
        throw new Error("lettura token di creazione fallita: " + error.message);
      }
      return data;
    },
    async insert(input) {
      const { data, error } = await supabase
        .from("pratiche")
        .insert({
          creazione_token: input.creationToken,
          tipo_pratica: input.type,
          prezzo_concordato: input.price,
          targa: input.plate,
          marca: input.make,
          modello: input.model,
        })
        .select("id")
        .single();
      if (error?.code === "23505") return null;
      if (error) throw new Error(error.message);
      return data;
    },
  };
}

async function findRecentPractice(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  plate: string,
) {
  const cutoff = new Date(
    Date.now() -
      BUSINESS_RULES.practiceCreation.recentDuplicateHours * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("pratiche")
    .select("id,targa,created_at,creazione_token")
    .eq("targa", plate)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error("controllo pratiche recenti fallito: " + error.message);
  }
  return data as
    | {
        id: string;
        targa: string;
        created_at: string;
        creazione_token: string | null;
      }
    | null;
}

export async function createPracticeAction(
  _previousState: CreatePracticeActionState,
  formData: FormData,
): Promise<CreatePracticeActionState> {
  await requireAdminSession();

  const creationToken = formData.get("creazione_token");
  if (!isValidPracticeCreationToken(creationToken)) return INVALID_STATE;

  const supabase = createAdminSupabaseClient();
  const repository = createRepository(supabase);
  let existing: { id: string } | null;
  try {
    existing = await repository.findByCreationToken(creationToken);
  } catch (error) {
    return serviceErrorState(error);
  }
  if (existing) redirect("/admin/pratiche/" + existing.id);

  const type = formData.get("tipo_pratica");
  const priceRaw = formData.get("prezzo_concordato");
  const plateRaw = formData.get("targa");
  const makeRaw = formData.get("marca");
  const modelRaw = formData.get("modello");
  if (
    typeof type !== "string" ||
    !PRACTICE_TYPES.includes(type as (typeof PRACTICE_TYPES)[number]) ||
    typeof priceRaw !== "string" ||
    typeof plateRaw !== "string" ||
    typeof makeRaw !== "string" ||
    typeof modelRaw !== "string"
  ) {
    return INVALID_STATE;
  }

  const price = parseMoneyAmount(priceRaw);
  const plate = normalizeVehiclePlate(plateRaw);
  const make = normalizeVehicleName(makeRaw);
  const model = normalizeVehicleName(modelRaw);
  if (price === null || !plate || !make || !model) return INVALID_STATE;

  let recentPractice: Awaited<ReturnType<typeof findRecentPractice>>;
  try {
    recentPractice = await findRecentPractice(supabase, plate);
  } catch (error) {
    return serviceErrorState(error);
  }
  if (recentPractice?.creazione_token === creationToken) {
    redirect("/admin/pratiche/" + recentPractice.id);
  }
  if (
    recentPractice &&
    formData.get("confirm_recent_duplicate") !== "yes"
  ) {
    return {
      error: null,
      duplicate: {
        id: recentPractice.id,
        plate,
        createdAgo: formatRecentPracticeAge(recentPractice.created_at),
      },
    };
  }

  const input: PracticeCreationInput = {
    creationToken,
    type: type as PracticeCreationInput["type"],
    price,
    plate,
    make,
    model,
  };
  let creation: Awaited<ReturnType<typeof createPracticeIdempotently>>;
  try {
    creation = await createPracticeIdempotently(input, repository);
  } catch (error) {
    return serviceErrorState(error);
  }

  if (!creation.created) {
    redirect("/admin/pratiche/" + creation.practice.id);
  }

  const plateWarning =
    !BUSINESS_RULES.validation.modernItalianVehiclePlatePattern.test(plate);
  await recordAdminEvent(creation.practice.id, "pratica_creata", {
    targa_formato_moderno: !plateWarning,
  });

  const warning = plateWarning ? "&warning=plate" : "";
  redirect(
    "/admin/pratiche/nuova?created=" +
      creation.practice.id +
      warning,
  );
}
