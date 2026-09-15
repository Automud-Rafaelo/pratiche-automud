import { BUSINESS_RULES } from "@/lib/config/business-rules";

export type PracticeCreationInput = {
  creationToken: string;
  type: "dini" | "atto_demo";
  price: number;
  plate: string;
  make: string;
  model: string;
};

export type CreatedPracticeReference = {
  id: string;
};

export type PracticeCreationRepository = {
  findByCreationToken(
    creationToken: string,
  ): Promise<CreatedPracticeReference | null>;
  insert(
    input: PracticeCreationInput,
  ): Promise<CreatedPracticeReference | null>;
};

export function isValidPracticeCreationToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= BUSINESS_RULES.practiceCreation.idempotencyTokenBytes &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export async function createPracticeIdempotently(
  input: PracticeCreationInput,
  repository: PracticeCreationRepository,
) {
  const existing = await repository.findByCreationToken(input.creationToken);
  if (existing) return { practice: existing, created: false as const };

  const inserted = await repository.insert(input);
  if (inserted) return { practice: inserted, created: true as const };

  const concurrent = await repository.findByCreationToken(
    input.creationToken,
  );
  if (!concurrent) {
    throw new Error(
      "Conflitto di idempotenza senza pratica associata al token",
    );
  }
  return { practice: concurrent, created: false as const };
}

export function formatRecentPracticeAge(
  createdAt: string,
  now = Date.now(),
) {
  const elapsedMs = Math.max(0, now - Date.parse(createdAt));
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "meno di un minuto fa";
  if (minutes === 1) return "1 minuto fa";
  if (minutes < 60) return String(minutes) + " minuti fa";
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 ora fa" : String(hours) + " ore fa";
}
