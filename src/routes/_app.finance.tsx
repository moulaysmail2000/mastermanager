import { createFileRoute } from "@tanstack/react-router";
import Finance from "@/pages/Finance";

export const Route = createFileRoute("/_app/finance")({
  component: Finance,
});
