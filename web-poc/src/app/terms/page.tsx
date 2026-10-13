import type { Metadata } from "next";
import { Terms } from "../../screens/Legal";

export const metadata: Metadata = { title: "Terms of use — NeuroCal", description: "The agreement for using NeuroCal, including subscriptions and trials." };

export default function TermsPage() {
  return <Terms />;
}
