import type { Metadata } from "next";
import { DeleteAccount } from "../../screens/DeleteAccount";

export const metadata: Metadata = {
  title: "Delete your account — NeuroCal",
  description: "How to delete your NeuroCal account and what gets deleted.",
};

export default function DeleteAccountPage() {
  return <DeleteAccount />;
}
