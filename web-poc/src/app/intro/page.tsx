import { redirect } from "next/navigation";

/** The intro slides led into web sign-up, which is closed; the landing page does their job. */
export default function IntroPage() {
  redirect("/");
}
