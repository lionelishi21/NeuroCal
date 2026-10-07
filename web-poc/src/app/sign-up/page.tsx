import { redirect } from "next/navigation";
import { SignUp } from "../../screens/Account";

/**
 * Accounts are made in the mobile app; the web app is for admins (auth/AdminOnly.tsx), so this
 * page sends real visitors home. With the local mock sign-in (no Cognito configured) it stays,
 * because a developer needs some way to make the account they then sign in with.
 */
export default function SignUpPage() {
  const cognito = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID && process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (cognito) redirect("/");
  return <SignUp />;
}
