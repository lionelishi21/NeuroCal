"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Visitors who aren't signed in see the landing page here (see RequireAuth); admins go to their dashboard. */
export default function HomePage() {
  const router = useRouter();
  useEffect(() => router.replace("/admin"), [router]);
  return null;
}
