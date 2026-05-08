import { createFileRoute } from "@tanstack/react-router";
import FriendAccounts from "@/pages/FriendAccounts";

export const Route = createFileRoute("/_app/friend-accounts")({
  component: FriendAccounts,
});
