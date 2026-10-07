import type { Metadata } from "next";
import { Unsubscribe } from "../../screens/Unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe — NeuroCal", robots: { index: false } };

export default function UnsubscribePage() {
  return <Unsubscribe />;
}
