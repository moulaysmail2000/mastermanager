import { createFileRoute } from "@tanstack/react-router";
import BankAccounts from "@/pages/BankAccounts";

export const Route = createFileRoute("/_app/bank-accounts")({
  component: BankAccounts,
});
