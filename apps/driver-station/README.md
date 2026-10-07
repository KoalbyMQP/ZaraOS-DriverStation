This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local auth bypass (development only)

To bypass the sign in locally:

```bash
AUTH_BYPASS_LOCAL=true
NEXT_PUBLIC_AUTH_BYPASS_LOCAL=true
```

Set these values in your local environment (for example, `.env.local`) and run the app in development mode.
The bypass is hard-disabled unless `NODE_ENV=development`.

## App images

The **Container image** input in Online apps runs an image directly, for example
`ghcr.io/koalbymqp/python-example:test-1`. It sends the entered reference to Cortex
after trimming surrounding whitespace. The app name comes from the final repository
path segment; the version is its digest, tag, or `latest` when neither is supplied.

Online apps use `ghcr.io/<github-owner>/<app-slug>:<release-tag>`. The owner comes
from the release's repository and is lowercased; the app slug is the same one sent
to Cortex. Image tags replace invalid character sequences with `-`, matching
`docker/metadata-action` (for example, `startup/v1` becomes `startup-v1`). The
original release tag remains the app's `version`.

Running Face v1.0.0 from `KoalbyMQP/Core`, for example, sends `POST /instances`:

```json
{
  "app": "face",
  "version": "v1.0.0",
  "image": "ghcr.io/koalbymqp/face:v1.0.0"
}
```

Cortex uses this explicit image reference directly. The app publisher must push
the corresponding image to GHCR. Installed apps use the exact repository and tag
returned by Cortex's `/images` endpoint.

## App UI host — stage 1

Apps expose **pages** and **components** as React modules through Module Federation.
The host discovers both, adds each page to its App's sidebar section, and loads the
selected page in the main content area. Components are retained in the descriptor
for a later stage; the host does not load, render, or offer them in navigation.

Pages own their layout and can compose components, use CSS Grid, or render custom
interfaces. Grid helpers can live in an App-side library later. There is no host
grid schema, dashboard builder, widget configuration, or saved workspace in this
stage. Remote code runs only after browser mount; no Next.js federation build
plugin is required.

### Discovery and exports

Cortex advertises the UI descriptor on each `/instances` item:

```json
{
  "id": "vision-1",
  "app": "vision",
  "version": "1.0.0",
  "state": "running",
  "started_at": null,
  "stopped_at": null,
  "ui": { "descriptor_url": "https://assets.example.com/vision/1.0.0/zara-ui.json" }
}
```

Relative descriptor URLs resolve against the robot origin. The host validates the
descriptor before loading code; `appId` and `appVersion` must match the instance.
There is no manual registration UI. Cortex must provide this metadata to discover
an App's pages.

Example `zara-ui.json`:

```json
{
  "schemaVersion": 1,
  "sdkVersion": 1,
  "appId": "vision",
  "appVersion": "1.0.0",
  "federation": {
    "name": "vision_ui_1_0_0",
    "entry": "./mf-manifest.json",
    "type": "module"
  },
  "pages": {
    "overview": { "title": "Overview", "module": "./OverviewPage" },
    "settings": { "title": "Settings", "module": "./SettingsPage" }
  },
  "components": {
    "camera": { "title": "Camera", "module": "./Camera" }
  }
}
```

`pages` and `components` are independent and may each be omitted or empty. The
host opens pages at `/app/{instanceId}?page={pageId}`; omitting `page` selects the
first declared page. Unknown page IDs show an unavailable state. An App exposing
only components contributes no page links.

The App's federation build exposes the modules named in the descriptor, for example:

```ts
exposes: {
  "./OverviewPage": "./src/pages/OverviewPage.tsx",
  "./SettingsPage": "./src/pages/SettingsPage.tsx",
  "./Camera": "./src/components/Camera.tsx",
}
```

The federation entry resolves relative to the descriptor's final response URL.
It can be `mf-manifest.json` or `remoteEntry.js`. `type` is `module` (default, ESM)
or `var` (a global container). Each immutable UI build needs a unique federation
name. Reusing a name at another address requires a browser reload. The host caches
loaded modules; each mounted page receives its selected instance separately.

### React page contract

Each page module default-exports a React component accepting `AppPageProps` from
`lib/app-ui/types.ts`: `instanceId` and `services`. For example:

```tsx
import Camera from "../components/Camera";

export default function OverviewPage({ instanceId, services }: AppPageProps) {
  return (
    <section>
      <h1>Vision overview</h1>
      <Camera instanceId={instanceId} services={services} />
    </section>
  );
}
```

App components can use their own props; the host does not impose a component
rendering contract yet. The App owns composition within its pages.

The host shares React, React DOM, and the JSX runtimes. Configure compatible
singletons in the App build; `import: false` can prevent bundling a second React
copy for remotes dedicated to this host. Remote pages should avoid Next.js imports
and private Driver Station contexts. Apps ship their own compiled CSS and scope
selectors; the host does not generate remote Tailwind classes.

`services.request("/status")` sends a signed request to
`/instances/{instanceId}/api/status` on the selected robot and returns JSON
(`null` for HTTP 204). Options support `method`, a JSON-object `body`, and an
`AbortSignal`. Requests are cancelled when the page unmounts, the App stops, or
the robot changes. **Cortex must implement this instance API proxy**; no backend
endpoints are added here.

Descriptors and federation assets must be browser-reachable with appropriate
CORS, asset base paths, and HTTPS when the host uses HTTPS. They do not receive
robot API signing headers. Federation executes trusted App code with the page's
privileges. Each page has a loading state, timeout, error boundary, and retry;
these contain rendering failures, not arbitrary script behavior.

### Verification

```bash
pnpm --filter @repo/driver-station test:app-ui
APP_UI_TEST_PRODUCTION=true pnpm --filter @repo/driver-station test:app-ui
```

The suite starts Next.js on port 3101. Playwright serves a small federation
container, descriptor, manifest, and stylesheet through request routing at
`https://app-ui.test`. No remote bundler or second server is needed. Tests cover
page navigation, shared React, App-owned layout and CSS, instance services,
validation and error handling, and leaving component exports unloaded. App build
tooling and generated chunks belong in App integration tests.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select a system Chromium executable.
