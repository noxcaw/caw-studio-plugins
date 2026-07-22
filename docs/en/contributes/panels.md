# Webview Panels (panels)

`contributes.panels` lets a plugin register panels backed by its own HTML. A panel renders inside
a **sandboxed iframe** and communicates with plugin logic (Python host commands) over a
`postMessage` bridge.

```jsonc
"panels": [
  {
    "id": "esp32.monitor",
    "title": "%panel.monitor%",
    "kind": "webview",
    "entry": "ui/monitor.html",
    "area": "bottom"
  }
]
```

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Panel id, unique within the section. |
| `title` | string | Yes | Display name; supports `%key%`. |
| `kind` | string | Yes | `webview` (plugin-supplied HTML, implemented). |
| `entry` | string | Required for `kind=webview` | Entry HTML path (relative to files root). |
| `area` | string | No | Dock area: `bottom` / `left` / `right` (defaults to `bottom`). |

## Opening & lifecycle

- In the Command Palette, each panel automatically gets an "Open panel: X" command.
- Once opened it becomes a bottom output-bar tab (**not persisted**; removed from the layout as
  soon as the plugin is disabled/uninstalled).

## Rendering & sandbox

The entry HTML is loaded into the iframe over the Tauri asset protocol, with **scope limited to
`~/.caw-studio/plugins/**`**. The iframe is sandboxed: `sandbox="allow-scripts"`, with **no
same-origin** — panel scripts cannot reach the main window's DOM or storage. Therefore the panel
communicates with plugin logic only over the postMessage bridge below.

## postMessage bridge

The only channel between a panel and the host. **`command` must be a command declared in the
manifest** (an id under `contributes.commands`), or it is rejected.

```js
// iframe -> host (initiate a call)
parent.postMessage({ type: "caw:invoke", id: 1, command: "esp32.eraseFlash" }, "*");

// host -> iframe (reply with result)
// success: { type: "caw:result", id: 1, ok: true, result: … }
// failure: { type: "caw:result", id: 1, ok: false, error: "…" }
```

`id` is auto-incremented by the panel and used to match a reply to its originating call.

## Full example (hello-contribs panel)

manifest:

```jsonc
"panels": [
  { "id": "hello.panel", "title": "%panel.hello%", "kind": "webview",
    "entry": "ui/panel.html", "area": "bottom" }
]
```

`ui/panel.html` (a minimal wrapper around the bridge):

```html
<!doctype html>
<html>
<body>
  <button id="go">Invoke hello.sayHello</button>
  <pre id="out">(result shows here)</pre>
  <script>
    let seq = 0;
    const pending = new Map();
    window.addEventListener("message", (e) => {
      const m = e.data;
      if (m && m.type === "caw:result" && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
      }
    });
    function invoke(command) {
      return new Promise((resolve) => {
        const id = ++seq;
        pending.set(id, resolve);
        parent.postMessage({ type: "caw:invoke", id, command }, "*");
      });
    }
    document.getElementById("go").onclick = async () => {
      const r = await invoke("hello.sayHello");
      document.getElementById("out").textContent = JSON.stringify(r, null, 2);
    };
  </script>
</body>
</html>
```

Click the button → the bridge invokes the `hello.sayHello` command → the host runs the handler →
the return value is shown in the panel.

## Notes

- Panel assets (HTML/CSS/JS/images) must all be packed into the plugin `package` artifact and
  referenced by paths relative to the files root; files outside the sandbox scope cannot be
  loaded.
- A panel cannot access devices/filesystem directly — all side effects must go through a declared
  command into the host.
