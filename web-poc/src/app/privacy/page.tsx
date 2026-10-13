import type { Metadata } from "next";
import { Privacy } from "../../screens/Legal";

export const metadata: Metadata = { title: "Privacy policy — NeuroCal", description: "What NeuroCal collects, why, who sees it and how to delete it." };

export default function PrivacyPage() {
  return <Privacy />;
}
