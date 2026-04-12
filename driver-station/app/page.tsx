"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { ConnectionStatusWidget } from "@/components/ConnectionStatusWidget";
import { ProjectStatusWidget } from "@/components/ProjectStatusWidget";
export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Middleware handles missing token; only redirect unverified users here
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

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
        <div className="flex flex-wrap gap-4">
          <ConnectionStatusWidget />
          <ProjectStatusWidget />
        </div>

        <article
          className="mt-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-8"
          aria-labelledby="user-guide-title"
        >
          <h2 id="user-guide-title" className="text-xl font-semibold text-zinc-100">
            User guide
          </h2>

          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Connect to your robot
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-300">
              <li>
                Click <span className="font-medium text-zinc-200">Connect to Robot</span>. Enter a
                short device name and the robot&apos;s IP (or host with port). The app talks to the
                robot on port <span className="font-mono text-zinc-400">8080</span> unless you
                include a port in the address.
              </li>
              <li>
                When prompted, type the <span className="font-medium text-zinc-200">six-digit code</span>{" "}
                shown on the robot to finish pairing. Your connection is saved in the browser until
                you disconnect.
              </li>
              <li>
                While connected, open the connect control again to <span className="font-medium text-zinc-200">Disconnect</span>.
              </li>
            </ul>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Connect in Dev Mode
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-300">
              <li>
                <span className="font-medium text-zinc-200">Dev Mode</span> (next to the connect
                button) connects to{" "}
                <span className="font-mono text-zinc-400">127.0.0.1:8080</span> without pairing,
                after a quick health check. Use this when ZaraOS is running on your local machine.
              </li>
              <li>
                This can be useful to test if an app runs correctly before running simulation tests.
              </li>
              <li>
                Make sure to start ZaraOS on localhost and see setup instructions: <Link href="https://github.com/KoalbyMQP/ZaraOS" className="text-blue-400 hover:underline">https://github.com/KoalbyMQP/ZaraOS</Link>
              </li>
            </ul>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Console
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              <Link href="/console" className="text-blue-400 hover:underline">
                Console
              </Link>{" "}
              opens a terminal session to the robot over the API. You must be connected first;
              otherwise you will see a message to connect from the header.
            </p>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Apps
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              On the{" "}
              <Link href="/apps" className="text-blue-400 hover:underline">
                Apps
              </Link>{" "}
              page, the <span className="font-medium text-zinc-200">Active</span> area shows what is
              running on the robot and what you started from here—use the controls to stop instances
              when needed.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Use the search bar and <span className="font-medium text-zinc-200">Filters</span> to
              narrow releases by repository (Core, Apps, Drivers, Control, Sensing).{" "}
              <span className="font-medium text-zinc-200">Available Online</span> lists versions
              from GitHub releases; open the version menu on a card to pick a release and run it.{" "}
              <span className="font-medium text-zinc-200">Components</span> lists lower-level
              component releases the same way.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              In <span className="font-medium text-zinc-200">Dev Mode</span>, an{" "}
              <span className="font-medium text-zinc-200">Available Locally</span> section appears
              for container images reported by your local Cortex server—you can run tagged images
              from there when the robot allows it.
            </p>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              If something fails
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-300">
              <li>
                Confirm the robot is on and reachable on your network; pairing errors often mean a
                wrong IP, firewall, or the API not listening on{" "}
                <span className="font-mono text-zinc-400">8080</span>.
              </li>
              <li>
                For Dev Mode errors, ensure ZaraOS is running locally and responds at{" "}
                <span className="font-mono text-zinc-400">http://127.0.0.1:8080/health</span>.
              </li>
              <li>
                If releases do not load, check your network and GitHub access; the catalog is
                fetched from public release metadata.
              </li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
