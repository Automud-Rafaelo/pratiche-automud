import Link from "next/link";
import type { ReactNode } from "react";

import { customerCopy } from "@/lib/copy/customer";

export function QuestionFrame({
  title,
  description,
  children,
  progress,
  backHref,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  progress: { current: number; total: number };
  backHref?: string | null;
}) {
  return (
    <section className="flex min-h-[calc(100dvh-140px)] flex-col">
      <div>
        <h1 className="text-[28px] font-bold leading-[1.12] tracking-[-0.02em] text-[#3B2314]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-[17px] leading-6 text-[#3B2314]/80">
            {description}
          </p>
        ) : null}
        <div className="mt-7">{children}</div>
        {backHref ? (
          <div className="mt-4 text-center">
            <Link
              className="text-sm font-semibold text-[#3B2314] underline underline-offset-4"
              href={backHref}
            >
              {customerCopy.actions.back}
            </Link>
          </div>
        ) : null}
      </div>
      <p className="mt-auto pt-8 text-center text-sm font-bold text-[#F7941D]">
        {customerCopy.progress
          .replace("{current}", String(progress.current))
          .replace("{total}", String(progress.total))}
      </p>
    </section>
  );
}

export const primaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-full bg-[#F7941D] px-9 text-[18px] font-bold text-white transition disabled:cursor-not-allowed disabled:bg-[#DED5C5] disabled:text-[#8B8377]";

export const inputClass =
  "h-14 w-full rounded-full border border-[#D8D3CA] bg-white px-5 text-[18px] text-[#3B2314] outline-none transition placeholder:text-[#9A9388] focus:border-[#F7941D] focus:ring-2 focus:ring-[#F7941D]/20";
