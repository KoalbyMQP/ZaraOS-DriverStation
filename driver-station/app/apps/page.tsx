"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { Header } from "@/components/Header";
import { ReleasePickerModal } from "@/components/ReleasePickerModal";
import type { Release } from "@/lib/api";

const BLUE_OUTLINE =
  "0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 20px 2px rgba(59, 130, 246, 0.25), 0 0 40px 4px rgba(59, 130, 246, 0.15)";

const CARDS = ["Core", "Apps"] as const;
type CardType = (typeof CARDS)[number];

export default function AppsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { setSelectedProject } = useProject();
  const [modalType, setModalType] = useState<CardType | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user && !user.email_verified) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

  const handleSelect = (release: Release) => {
    setSelectedProject({
      url: release.html_url,
      name: release.name,
      version: release.tag_name,
    });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((label) => (
            <div
              key={label}
              role="button"
              tabIndex={0}
              className="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/80 px-6 py-8 text-center transition-all duration-200 ease-out hover:scale-[1.03] hover:border-transparent"
              style={{
                boxShadow: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = BLUE_OUTLINE;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
              onClick={() => setModalType(label)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setModalType(label);
                }
              }}
            >
              <span className="text-lg font-medium text-zinc-200 group-hover:text-zinc-100">
                {label}
              </span>
            </div>
          ))}
        </div>
      </main>

      <ReleasePickerModal
        open={modalType !== null}
        onClose={() => setModalType(null)}
        type={modalType ?? "Core"}
        onSelect={handleSelect}
      />
    </div>
  );
}
