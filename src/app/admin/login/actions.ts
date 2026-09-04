"use server";

import { redirect } from "next/navigation";

import {
  clearFailedLogins,
  createAdminSession,
  reserveAdminLoginAttempt,
  verifyAdminPassword,
} from "@/lib/admin/auth";

export async function loginAction(formData: FormData) {
  let reservation: Awaited<ReturnType<typeof reserveAdminLoginAttempt>>;
  try {
    reservation = await reserveAdminLoginAttempt();
  } catch (error) {
    const cause = error instanceof Error ? error.message : "Errore sconosciuto";
    redirect(`/admin/login?error=service&cause=${encodeURIComponent(cause)}`);
  }
  const { ipHash, allowed } = reservation;

  if (!allowed) {
    redirect("/admin/login?error=rate_limit");
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !verifyAdminPassword(password)) {
    redirect("/admin/login?error=invalid");
  }

  try {
    await clearFailedLogins(ipHash);
    await createAdminSession();
  } catch (error) {
    const cause = error instanceof Error ? error.message : "Errore sconosciuto";
    redirect(`/admin/login?error=service&cause=${encodeURIComponent(cause)}`);
  }
  redirect("/admin");
}
