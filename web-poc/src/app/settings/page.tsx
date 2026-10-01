import type { Metadata } from "next";
import { Settings } from "../../screens/Settings";

export const metadata: Metadata = { title: "Settings — NeuroCal" };

export default function SettingsPage() {
  return <Settings />;
}
