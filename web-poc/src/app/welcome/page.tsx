import type { Metadata } from "next";
import { Welcome } from "../../screens/Welcome";

export const metadata: Metadata = { title: "Set up — NeuroCal" };

export default function WelcomePage() {
  return <Welcome />;
}
