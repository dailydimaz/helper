import { useUser } from "@/hooks/use-user";
import { api } from "@/trpc/react";

export const useSession = () => {
  const { user: authUser, status } = useUser();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = api.user.currentUser.useQuery(undefined, {
    enabled: status === "authenticated", // only fetch after authentication
    refetchOnWindowFocus: false,
  });

  return { 
    session: authUser ? { user: authUser } : null, 
    user, 
    isLoading: status === "loading" || isLoading, 
    error, 
    refetch 
  };
};
