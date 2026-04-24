import { redirect } from "next/navigation";

export default function AdminDashboardLegacyRedirect() {
  redirect("/?role=system_admin&feature=0");
}


