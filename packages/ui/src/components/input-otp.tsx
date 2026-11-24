"use client";

import { useContext, type ComponentProps } from "react";
import { cn } from "cn";
import { OTPInput, OTPInputContext } from "input-otp";

/** One-time-code input. Kumo has no equivalent, so the slots are styled like its Input. */
function InputOTP({
  className,
  containerClassName,
  ...props
}: ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      containerClassName={cn("group/otp flex items-center has-disabled:opacity-50", containerClassName)}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1.5", className)} {...props} />;
}

function InputOTPSlot({ index, className, ...props }: ComponentProps<"div"> & { index: number }) {
  const { char, hasFakeCaret, isActive } = useContext(OTPInputContext)?.slots[index] ?? {};
  return (
    <div
      data-active={isActive}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-lg bg-kumo-control text-(length:--kumo-font-size-base)/[var(--tw-leading,var(--kumo-line-height-base))] text-kumo-default ring ring-kumo-line",
        "group-has-aria-invalid/otp:ring-kumo-danger data-[active=true]:z-10 data-[active=true]:ring-[1.5px] data-[active=true]:ring-kumo-focus/50",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-kumo-contrast" />
        </div>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
