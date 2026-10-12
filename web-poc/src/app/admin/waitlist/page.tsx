import type { Metadata } from "next";
import { AdminWaitlist } from "../../../screens/AdminWaitlist";

export const metadata: Metadata = { title: "Waitlist — NeuroCal" };

export default function AdminWaitlistPage() {
  return <AdminWaitlist />;
}
