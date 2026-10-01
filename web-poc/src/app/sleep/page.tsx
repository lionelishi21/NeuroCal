import type { Metadata } from "next";
import { Sleep } from "../../screens/Sleep";

export const metadata: Metadata = { title: "Sleep and evenings — NeuroCal" };

export default function SleepPage() {
  return <Sleep />;
}
