import { conversationFactory } from "@tests/support/factories/conversations";
import { userFactory } from "@tests/support/factories/users";
import { createTestTRPCContext } from "@tests/support/trpcUtils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCaller } from "@/trpc";

vi.mock("@/lib/files/storage", () => ({
  initializeStorage: vi.fn().mockResolvedValue(undefined),
}));

describe("filesRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initiateUpload", () => {
    it("creates a file entry and returns a signed URL for inline files", async () => {
      const { user } = await userFactory.createRootUser();
      const ctx = await createTestTRPCContext(user);
      const caller = createCaller(ctx);

      const result = await caller.mailbox.conversations.files.initiateUpload({
        conversationSlug: "random_slug",
        file: {
          fileName: "test.txt",
          fileSize: 1000,
          isInline: true,
        },
      });

      expect(result.file).toMatchObject({
        name: "test.txt",
      });
      expect(result.file.key).toContain("random_slug");
      expect(result.isPublic).toBe(true);
      expect(result.uploadUrl).toMatch(/^\/api\/files\/upload\//);
      expect(result.uploadToken).toBeTruthy();
    });

    it("uses private bucket for non-inline files", async () => {
      const { user } = await userFactory.createRootUser();
      const { conversation } = await conversationFactory.create();
      const ctx = await createTestTRPCContext(user);
      const caller = createCaller(ctx);

      const result = await caller.mailbox.conversations.files.initiateUpload({
        conversationSlug: conversation.slug,
        file: {
          fileName: "private.txt",
          fileSize: 2000,
          isInline: false,
        },
      });

      expect(result.file).toMatchObject({
        name: "private.txt",
      });
      expect(result.isPublic).toBe(false);
      expect(result.uploadUrl).toMatch(/^\/api\/files\/upload\//);
      expect(result.uploadToken).toBeTruthy();
    });
  });
});
