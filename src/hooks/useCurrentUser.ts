import { api } from "@/trpc/react";
import type { CurrentUser } from "@/lib/types";

export function useCurrentUser() {
  const { data: user, isLoading, isError } = api.user.getCurrentUser.useQuery();
  return { user, isLoading, isError };
}
