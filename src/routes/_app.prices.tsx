import { createFileRoute } from "@tanstack/react-router";
import Prices from "@/pages/Prices";

export const Route = createFileRoute("/_app/prices")({
  component: Prices,
});
