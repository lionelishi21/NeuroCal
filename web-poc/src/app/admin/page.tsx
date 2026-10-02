import type { Metadata } from "next";
import { Admin } from "../../screens/Admin";

export const metadata: Metadata = { title: "Manage products — NeuroCal" };

export default function AdminPage() {
  return <Admin />;
}
