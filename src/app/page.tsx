import { redirect } from "next/navigation";

// The panel has no marketing surface; the root is just a door to the dashboard,
// which sends an unauthenticated visitor on to /login.
export default function Home() {
  redirect("/dashboard");
}
