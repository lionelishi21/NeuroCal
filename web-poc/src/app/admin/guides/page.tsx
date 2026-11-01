import type { Metadata } from "next";
import { AdminGuides } from "../../../screens/AdminGuides";

export const metadata: Metadata = { title: "Guides — NeuroCal" };

export default function AdminGuidesPage() {
  return <AdminGuides />;
}
