"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@repo/ui/components/button/button";
import { Dialog } from "@repo/ui/components/dialog/dialog";
import { CaretDownIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { IpConnectModal } from "@/components/IpConnectModal";

export function RobotConnectionControl() {
  const { connection } = useConnection();
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <Button
            variant="ghost"
            className="gap-2 px-2 font-heading md:-ml-2"
            aria-label={`Connect to robot: ${connection?.name ?? "no robot connected"}`}
          />
        }
      >
        <Image
          src={connection ? "/icons/robot-connected.svg" : "/icons/robot-disconnected.svg"}
          width={24}
          height={24}
          alt=""
          className="block shrink-0"
          unoptimized
        />
        <span className="max-w-32 truncate sm:max-w-40">{connection?.name ?? "No robot connected"}</span>
        <CaretDownIcon className="text-kumo-subtle" aria-hidden="true" />
      </Dialog.Trigger>
      {open && <IpConnectModal onClose={() => setOpen(false)} />}
    </Dialog.Root>
  );
}
