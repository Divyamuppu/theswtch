import { redirect } from "next/navigation";

export default function Home() {
  // Middleware sends unauthenticated visitors to /login.
  redirect("/dashboard");
}
