import { Loader } from "@repo/ui/components/loader/loader";

/**
 * Kumo's Loader, hidden from assistive technology. Use it beside text that
 * already states the progress ("Starting…"); Loader alone announces "Loading".
 */
export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      <Loader size={size} className={className} />
    </span>
  );
}
