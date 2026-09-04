"use server";

import { redirect } from "next/navigation";

import { deleteAdminSession, requireAdminSession } from "@/lib/admin/auth";

export async function logoutAction() {
  await requireAdminSession();
  await deleteAdminSession();
  redirect("/admin/login");
}
