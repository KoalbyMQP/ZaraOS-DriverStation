"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogTrigger } from "@repo/ui/components/dialog";
import { CaretDownIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { IpConnectModal } from "@/components/IpConnectModal";

export function RobotConnectionControl() {
  const { connection } = useConnection();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="h-6 gap-2 border-0 px-0 font-heading leading-5"
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
        <CaretDownIcon data-icon="inline-end" aria-hidden="true" />
      </DialogTrigger>
      {open && <IpConnectModal onClose={() => setOpen(false)} />}
    </Dialog>
  );
}
