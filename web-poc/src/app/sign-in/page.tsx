import type { Metadata } from "next";
import { SignIn } from "../../screens/Account";

export const metadata: Metadata = { title: "Sign in — NeuroCal" };

export default function SignInPage() {
  return <SignIn />;
}
