import type { Metadata } from "next";
import { SignUp } from "../../screens/Account";

export const metadata: Metadata = { title: "Create an account — NeuroCal" };

export default function SignUpPage() {
  return <SignUp />;
}
