"use client";

import { useEffect } from "react";

import { CustomerShell } from "@/components/customer/customer-shell";
import { customerCopy } from "@/lib/copy/customer";
import { getWhatsAppUrl } from "@/lib/customer/whatsapp";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <CustomerShell>
      <section className="pt-8 text-center">
        <h1 className="text-[28px] font-bold leading-tight">
          {customerCopy.temporaryError.title}
        </h1>
        <p className="mt-4 text-[17px]">
          {customerCopy.temporaryError.description}
        </p>
        <button
          className="mt-6 min-h-14 rounded-full bg-[#F7941D] px-9 text-[18px] font-bold text-white"
          onClick={reset}
          type="button"
        >
          {customerCopy.actions.retry}
        </button>
        <p className="mt-4">
          <a
            className="font-bold underline underline-offset-4"
            href={getWhatsAppUrl()}
          >
            {customerCopy.invalidLink.description}
          </a>
        </p>
      </section>
    </CustomerShell>
  );
}
