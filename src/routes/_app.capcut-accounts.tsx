import { createFileRoute } from "@tanstack/react-router";
import CapcutAccounts from "@/pages/CapcutAccounts";

export const Route = createFileRoute("/_app/capcut-accounts")({
  component: CapcutAccounts,
});
