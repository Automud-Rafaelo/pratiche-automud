import { randomBytes } from "node:crypto";

import Link from "next/link";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { NewPracticeForm } from "@/components/admin/new-practice-form";
import { requireAdminSession } from "@/lib/admin/auth";
import { buildCustomerLink } from "@/lib/admin/format";
import { BUSINESS_RULES } from "@/lib/config/business-rules";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type NewPracticePageProps = {
  searchParams: Promise<{
    created?: string;
    warning?: string;
  }>;
};

export default async function NewPracticePage({
  searchParams,
}: NewPracticePageProps) {
  await requireAdminSession();
  const { created, warning } = await searchParams;
  const creationToken = randomBytes(
    BUSINESS_RULES.practiceCreation.idempotencyTokenBytes,
  ).toString("base64url");
  let createdPractice: { id: string; token: string } | null = null;
  let loadError: string | null = null;

  if (created) {
    const supabase = createAdminSupabaseClient();
    const { data, error: practiceError } = await supabase
      .from("pratiche")
      .select("id,token")
      .eq("id", created)
      .maybeSingle();
    if (practiceError) {
      loadError = `Supabase: lettura pratica creata fallita: ${practiceError.message}`;
      console.error(loadError);
    } else {
      createdPractice = data;
    }
  }

  const customerLink = createdPractice
    ? buildCustomerLink(createdPractice.token)
    : null;

  return (
    <div className="max-w-2xl">
      <Link className="text-sm text-blue-700 hover:underline" href="/admin">
        ← Torna alle pratiche
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Nuova pratica</h1>

      {createdPractice && customerLink ? (
        <section className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="font-semibold text-green-900">Pratica creata</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-md border border-green-300 bg-white px-3 py-2 text-sm"
              readOnly
              value={customerLink}
            />
            <CopyLinkButton value={customerLink} />
          </div>
          <Link
            className="mt-3 inline-block text-sm text-green-900 underline"
            href={`/admin/pratiche/${createdPractice.id}`}
          >
            Apri il dettaglio
          </Link>
        </section>
      ) : null}

      {warning === "plate" ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          La targa è stata salvata, ma non rispetta il formato moderno AA123AA.
        </p>
      ) : null}

      {loadError ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      <NewPracticeForm creationToken={creationToken} />
    </div>
  );
}
