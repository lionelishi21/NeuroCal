import type { Metadata } from "next";
import { Lab } from "../../screens/Lab";

export const metadata: Metadata = { title: "Component lab — NeuroCal", robots: { index: false } };

export default function LabPage() {
  return <Lab />;
}
