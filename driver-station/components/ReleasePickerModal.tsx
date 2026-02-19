"use client";

import { useEffect, useState } from "react";
import { type Release, getCoreReleases, getAppsReleases } from "@/lib/api";

const BLUE_OUTLINE =
  "0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 20px 2px rgba(59, 130, 246, 0.25), 0 0 40px 4px rgba(59, 130, 246, 0.15)";

type ModalType = "Core" | "Apps";

type ReleasePickerModalProps = {
  open: boolean;
  onClose: () => void;
  type: ModalType;
  onSelect?: (release: Release) => void;
};

const HEADER_OFFSET = 56;

export function ReleasePickerModal({
  open,
  onClose,
  type,
  onSelect,
}: ReleasePickerModalProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedRelease(null);
    setLoading(true);
    const fetchReleases = type === "Core" ? getCoreReleases : getAppsReleases;
    fetchReleases()
      .then(({ releases: list }) => setReleases(list))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load releases"))
      .finally(() => setLoading(false));
  }, [open, type]);

  const handleConfirm = () => {
    if (selectedRelease && onSelect) {
      onSelect(selectedRelease);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        style={{ top: HEADER_OFFSET }}
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed z-50 flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl"
        style={{
          top: HEADER_OFFSET + 12,
          left: 12,
          right: 12,
          bottom: 12,
          maxHeight: `calc(100vh - ${HEADER_OFFSET}px - 24px)`,
          boxShadow: BLUE_OUTLINE,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-modal-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 id="release-modal-title" className="text-lg font-semibold text-zinc-100">
            {type} — Select release and version
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-auto p-6">
          {loading && (
            <div className="flex flex-1 items-center justify-center text-zinc-400">
              Loading releases…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && releases.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-zinc-400">
              No releases found.
            </div>
          )}

          {!loading && !error && releases.length > 0 && (
            <>
              <section>
                <h3 className="mb-3 text-sm font-medium text-zinc-300">Release & version</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {releases.map((release) => {
                    const isSelected = selectedRelease?.id === release.id;
                    return (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() => setSelectedRelease(release)}
                        className="rounded-lg border px-4 py-3 text-left transition-all"
                        style={{
                          borderColor: isSelected ? "rgba(59, 130, 246, 0.6)" : "rgb(39 39 42)",
                          backgroundColor: isSelected ? "rgba(59, 130, 246, 0.1)" : "rgb(24 24 27 / 0.8)",
                          boxShadow: isSelected ? BLUE_OUTLINE : "none",
                        }}
                      >
                        <div className="font-medium text-zinc-100">{release.name || release.tag_name}</div>
                        <div className="mt-0.5 text-sm text-zinc-400">{release.tag_name}</div>
                        {release.published_at && (
                          <div className="mt-1 text-xs text-zinc-500">
                            {new Date(release.published_at).toLocaleDateString()}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="mt-auto flex justify-end gap-3 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedRelease}
                  className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
