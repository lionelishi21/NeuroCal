import type { Metadata } from "next";
import { Intro } from "../../screens/Intro";

export const metadata: Metadata = { title: "Welcome — NeuroCal" };

export default function IntroPage() {
  return <Intro />;
}
