import { redirect } from "next/navigation";

/** Accounts are made in the mobile app; the web app is for admins (auth/AdminOnly.tsx). */
export default function SignUpPage() {
  redirect("/");
}
