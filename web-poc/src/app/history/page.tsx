import type { Metadata } from "next";
import { History } from "../../screens/History";

export const metadata: Metadata = { title: "This week — NeuroCal" };

export default function HistoryPage() {
  return <History />;
}
