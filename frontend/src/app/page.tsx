import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect root to user portal landing page
  redirect("/user");
}


