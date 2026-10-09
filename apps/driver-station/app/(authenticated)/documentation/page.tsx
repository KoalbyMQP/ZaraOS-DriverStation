import Link from "next/link";

export default function DocumentationPage() {
  return (
    <div className="p-4 md:p-8">
      <article className="typeset typeset-docs mx-auto max-w-3xl">
        <h1>User Guide</h1>
        <p>Connect to your robot, run apps, and inspect their output from the Driver Station.</p>

        <h2>Connect to your robot</h2>
        <ol>
          <li>
            Click the robot connection in the topbar. When disconnected, it reads <strong>No robot connected</strong>.
          </li>
          <li>
            Enter a device name and the robot’s IP address or hostname, then click <strong>Connect</strong>. The default
            API port is <code>8080</code>; you can include a different port in the address.
          </li>
          <li>
            Enter the six-digit code displayed on the robot, then click <strong>Pair</strong>.
          </li>
        </ol>
        <p>
          Your connection is saved in this browser. To disconnect, open the same dialog and choose{" "}
          <strong>Disconnect</strong>.
        </p>

        <h2>Use Dev Mode</h2>
        <p>
          Dev Mode connects to Cortex on your computer at <code>127.0.0.1:8080</code> without pairing.
        </p>
        <ol>
          <li>Start Cortex from your ZaraOS checkout:</li>
        </ol>
        <pre>
          <code>{"cd cortex\ngo run ./cmd/"}</code>
        </pre>
        <p>
          Open the robot connection dialog and choose <strong>Dev Mode</strong>. The Driver Station checks Cortex’s
          health before connecting.
        </p>
        <p>
          For more setup details, see the <a href="https://github.com/KoalbyMQP/ZaraOS">ZaraOS repository</a>. Docker or
          another supported container runtime must be running to list images and launch apps.
        </p>

        <h2>Browse and run apps</h2>
        <p>
          The <Link href="/apps">App Store</Link> has two lists:
        </p>
        <ul>
          <li>
            <strong>Online apps</strong> lists releases from Core, Apps, Drivers, Control, and Sensing. Use search and
            the source filters to find an app.
          </li>
          <li>
            <strong>Installed apps</strong> lists container images on the connected robot. In Dev Mode, it lists images
            on your computer.
          </li>
        </ul>
        <p>
          Each app shows its source, latest listed version, and version count. Open <strong>Run</strong> and select a
          version to launch it. Online apps show whether an image is installed when the robot’s image list is available.
        </p>

        <h2>Monitor running apps</h2>
        <p>
          The sidebar’s <strong>Apps</strong> section lists installed apps with their current status. Expand an app and
          choose a version’s <strong>Logs</strong> to inspect its output. Apps stay in the sidebar when stopped.
        </p>
        <p>
          In the log viewer, filter by severity or search for a message. Pause the display to inspect output, then
          resume to see buffered lines. You can copy or download the logs.
        </p>

        <h2>Open a terminal</h2>
        <p>
          <Link href="/console">Terminals</Link> opens an interactive shell on the connected robot. Connect first, then
          use the terminal to run commands. In Dev Mode, the shell runs on the computer hosting Cortex.
        </p>

        <h2>If something fails</h2>
        <ul>
          <li>
            <strong>Cannot connect:</strong> check the robot’s power, network, IP address, and API port.
          </li>
          <li>
            <strong>Pairing fails:</strong> confirm the code or go back to request a fresh one.
          </li>
          <li>
            <strong>Dev Mode fails:</strong> confirm Cortex responds at <code>http://127.0.0.1:8080/health</code>.
          </li>
          <li>
            <strong>Online apps do not load:</strong> check your internet connection and GitHub access, then refresh the
            catalog.
          </li>
          <li>
            <strong>Installed apps do not load:</strong> check that the container runtime is running and accessible to
            Cortex.
          </li>
        </ul>
      </article>
    </div>
  );
}
