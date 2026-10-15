import type { Metadata } from "next";
import { AdminKnowledge } from "../../../screens/AdminKnowledge";

export const metadata: Metadata = { title: "Knowledge — NeuroCal" };

export default function AdminKnowledgePage() {
  return <AdminKnowledge />;
}
