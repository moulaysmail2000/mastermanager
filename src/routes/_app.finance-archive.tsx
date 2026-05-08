import { createFileRoute } from "@tanstack/react-router";
import FinanceArchive from "@/pages/FinanceArchive";

export const Route = createFileRoute("/_app/finance-archive")({
  component: FinanceArchive,
});
