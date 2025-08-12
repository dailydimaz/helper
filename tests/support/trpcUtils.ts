import { assertDefined } from "@/components/utils/assert";
import { usersTable } from "@/db/schema";
import { getProfile } from "@/lib/data/user";
import { createTRPCContext } from "@/trpc";

export const createTestTRPCContext = async (user: typeof usersTable.$inferSelect) =>
  createTRPCContext({
    user: await createTestAuthUser(user),
    headers: new Headers({
      "x-trpc-source": "test",
    }),
  });

const createTestAuthUser = async (user: typeof usersTable.$inferSelect) => {
  return {
    email: user.email,
    ...assertDefined(await getProfile(user.id)),
  };
};
