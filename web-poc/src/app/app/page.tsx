import type { Metadata } from "next";
import { Today } from "../../screens/Today";

export const metadata: Metadata = { title: "Today — NeuroCal" };

export default function TodayPage() {
  return <Today />;
}
