import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { assertDefined } from "@/components/utils/assert";
import { getProfile } from "@/lib/data/user";
import { getLogin } from "@/lib/cookie";
import { appRouter, createTRPCContext } from "@/trpc";

export const OPTIONS = () => {
  const response = new Response(null, {
    status: 204,
  });
  return response;
};

const handler = async (req: any) => {
  const authUser = await getLogin();

  let enrichedUser = null;

  if (authUser) {
    const profile = assertDefined(await getProfile(authUser.id));

    enrichedUser = {
      email: authUser.email ?? null,
      ...profile,
    };
  }

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc/lambda",
    router: appRouter,
    req,
    createContext: () => {
      return createTRPCContext({
        user: enrichedUser,
        headers: req.headers,
      });
    },
    onError({ error, path }) {
      // eslint-disable-next-line no-console
      console.error(`>>> tRPC Error on '${path}'`, error);
      if (error.cause) {
        // eslint-disable-next-line no-console
        console.error(error.cause.stack);
      }
    },
  });

  return response;
};

export { handler as GET, handler as POST };
