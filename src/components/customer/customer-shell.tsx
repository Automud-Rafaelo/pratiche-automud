import type { ReactNode } from "react";

import { customerCopy } from "@/lib/copy/customer";

export function CustomerShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#FFF8EA] text-[#3B2314]">
      <div className="absolute inset-x-0 bottom-0 h-40 opacity-40" aria-hidden="true">
        <div className="absolute -bottom-20 -left-16 h-44 w-64 rounded-[50%] bg-[#F9DDB5]" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-72 rounded-[50%] bg-[#F9DDB5]" />
        <div className="absolute -bottom-20 -right-20 h-52 w-72 rounded-[50%] bg-[#F9DDB5]" />
      </div>
      <header className="relative rounded-b-3xl bg-[#3B2314] px-6 py-5 text-white shadow-sm">
        <div className="mx-auto max-w-[480px] text-[32px] font-extrabold italic leading-none">
          {customerCopy.brand}
        </div>
      </header>
      <div className="relative mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-[480px] flex-col px-5 pb-6 pt-9">
        {children}
      </div>
    </main>
  );
}
