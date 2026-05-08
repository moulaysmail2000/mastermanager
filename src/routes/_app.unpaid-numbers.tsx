import { createFileRoute } from "@tanstack/react-router";
import UnpaidNumbers from "@/pages/UnpaidNumbers";

export const Route = createFileRoute("/_app/unpaid-numbers")({
  component: UnpaidNumbers,
});
