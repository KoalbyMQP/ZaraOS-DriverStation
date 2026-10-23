// Minimal federation container. Playwright serves this file directly; no remote build is needed.
let React;

export async function init(shareScope) {
  const sharedReact = Object.values(shareScope.react)[0];
  React = (await sharedReact.get())();
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("./counter.css", import.meta.url).href;
  document.head.append(stylesheet);
}

export async function get(name) {
  (window.__fixtureModuleRequests ??= []).push(name);
  if (name === "./Overview") return () => ({ default: Overview });
  if (name === "./Settings") return () => ({ default: Settings });
  if (name === "./Counter") return () => ({ default: Counter });
  if (name === "./Broken") return () => ({ default: Broken });
  throw new Error(`Unknown fixture component: ${name}`);
}

function Overview(props) {
  return React.createElement(
    "section",
    { className: "federation-test-page" },
    React.createElement("h1", null, "Remote overview"),
    React.createElement("p", null, `App instance: ${props.instanceId}`),
    React.createElement(
      "div",
      { className: "federation-test-layout" },
      React.createElement(Counter, { ...props, label: "First counter" }),
      React.createElement(Counter, { ...props, label: "Second counter" })
    )
  );
}

function Settings({ instanceId }) {
  const [name, setName] = React.useState("");
  return React.createElement(
    "section",
    { className: "federation-test-page" },
    React.createElement("h1", null, "Custom settings"),
    React.createElement("p", null, `App instance: ${instanceId}`),
    React.createElement(
      "label",
      null,
      "Display name",
      React.createElement("input", {
        value: name,
        onChange: (event) => setName(event.target.value),
      })
    )
  );
}

function Counter({ label, services }) {
  const [count, setCount] = React.useState(0);
  const [result, setResult] = React.useState("");
  return React.createElement(
    "div",
    { className: "federation-test-counter" },
    React.createElement("p", null, label),
    React.createElement("button", { onClick: () => setCount(count + 1) }, `Count: ${count}`),
    React.createElement(
      "button",
      {
        onClick: () =>
          services
            .request("/status")
            .then((value) => setResult(value.status))
            .catch((error) => setResult(error.message)),
      },
      "Read App status"
    ),
    React.createElement("p", { role: "status" }, result)
  );
}

function Broken() {
  throw new Error("Intentional fixture render failure");
}
