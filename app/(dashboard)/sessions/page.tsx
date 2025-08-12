"use client";

import { useMailbox } from "@/hooks/use-mailbox";
import SessionsList from "./sessionsList";
import LoadingSpinner from "@/components/loadingSpinner";

const Page = () => {
  const limit = 10;
  const { mailbox, isLoading } = useMailbox();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SessionsList mailbox={mailbox} limit={limit} />
    </div>
  );
};

export default Page;
