"use server";

import { redirect } from "next/navigation";

import {
  clearFailedLogins,
  createAdminSession,
  reserveAdminLoginAttempt,
  verifyAdminPassword,
} from "@/lib/admin/auth";

export async function loginAction(formData: FormData) {
  const { ipHash, allowed } = await reserveAdminLoginAttempt();

  if (!allowed) {
    redirect("/admin/login?error=rate_limit");
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !verifyAdminPassword(password)) {
    redirect("/admin/login?error=invalid");
  }

  await clearFailedLogins(ipHash);
  await createAdminSession();
  redirect("/admin");
}
