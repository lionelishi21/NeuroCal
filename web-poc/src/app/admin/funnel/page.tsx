import type { Metadata } from "next";
import { AdminFunnel } from "../../../screens/AdminFunnel";

export const metadata: Metadata = { title: "Funnel — NeuroCal" };

export default function AdminFunnelPage() {
  return <AdminFunnel />;
}
