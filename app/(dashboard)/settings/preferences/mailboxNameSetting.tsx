"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSavingIndicator } from "@/components/hooks/useSavingIndicator";
import { SavingIndicator } from "@/components/savingIndicator";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/components/useDebouncedCallback";
import { useOnChange } from "@/components/useOnChange";
import { useMailbox, useMailboxActions } from "@/hooks/use-mailbox";
import SectionWrapper from "../sectionWrapper";

const MailboxNameSetting = ({ mailbox }: { mailbox: any }) => {
  const [name, setName] = useState(mailbox?.name || '');
  const savingIndicator = useSavingIndicator();
  const { mutate } = useMailbox();
  const { updateMailbox } = useMailboxActions();

  const save = useDebouncedCallback(async () => {
    savingIndicator.setState("saving");
    try {
      await updateMailbox({ name });
      await mutate();
      savingIndicator.setState("saved");
    } catch (error: any) {
      savingIndicator.setState("error");
      toast.error("Error updating preferences", { description: error.message });
    }
  }, 500);

  useOnChange(() => {
    save();
  }, [name]);

  return (
    <div className="relative">
      <div className="absolute top-2 right-4 z-10">
        <SavingIndicator state={savingIndicator.state} />
      </div>
      <SectionWrapper title="Mailbox name" description="Change the name of your mailbox">
        <div className="max-w-sm">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter mailbox name" />
        </div>
      </SectionWrapper>
    </div>
  );
};

export default MailboxNameSetting;
