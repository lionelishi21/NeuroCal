import type { Metadata } from "next";
import { AdminDevices } from "../../../screens/AdminDevices";

export const metadata: Metadata = { title: "Devices — NeuroCal" };

export default function AdminDevicesPage() {
  return <AdminDevices />;
}
