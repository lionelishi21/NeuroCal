import type { Metadata } from "next";
import { AdminDashboard } from "../../screens/AdminDashboard";

export const metadata: Metadata = { title: "Admin — NeuroCal" };

export default function AdminPage() {
  return <AdminDashboard />;
}
