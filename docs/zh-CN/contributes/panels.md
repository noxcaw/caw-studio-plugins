# Webview 面板（panels）

`contributes.panels` 让插件注册自带 HTML 的面板。面板在**沙箱 iframe** 里渲染，通过
`postMessage` 桥与插件逻辑（Python 宿主命令）互通。

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

## 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 面板 id，节内唯一。 |
| `title` | string | 是 | 展示名；支持 `%key%`。 |
| `kind` | string | 是 | `webview`（插件自带 HTML，已实现）。 |
| `entry` | string | `kind=webview` 必填 | 入口 HTML 路径（相对 files 根）。 |
| `area` | string | 否 | 停靠区域：`bottom` / `left` / `right`（缺省 `bottom`）。 |

## 打开与生命周期

- 命令面板里，每个面板自动有一条"打开面板: X"命令。
- 打开后进底部输出栏 tab（**不持久化**;插件停用/卸载即从布局摘除）。

## 渲染与沙箱

入口 HTML 经 Tauri asset 协议加载进 iframe，**scope 限 `~/.caw-studio/plugins/**`**。iframe 是
沙箱：`sandbox="allow-scripts"`，**无 same-origin**——面板脚本拿不到主窗口的 DOM 与存储。因此
面板与插件逻辑互通只能走下面的 postMessage 桥。

## postMessage 桥

面板与宿主通信的唯一通道。**`command` 必须是 manifest 声明过的命令**（`contributes.commands`
里的 id），否则被拒。

```js
// iframe → 宿主(发起调用)
parent.postMessage({ type: "caw:invoke", id: 1, command: "esp32.eraseFlash" }, "*");

// 宿主 → iframe(回结果)
// 成功: { type: "caw:result", id: 1, ok: true, result: … }
// 失败: { type: "caw:result", id: 1, ok: false, error: "…" }
```

`id` 由面板自增，用于把回包匹配到发起的调用。

## 完整示例（hello-contribs 面板)

manifest：

```jsonc
"panels": [
  { "id": "hello.panel", "title": "%panel.hello%", "kind": "webview",
    "entry": "ui/panel.html", "area": "bottom" }
]
```

`ui/panel.html`（桥的最小封装）：

```html
<!doctype html>
<html>
<body>
  <button id="go">调用 hello.sayHello</button>
  <pre id="out">(结果显示在这里)</pre>
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

点按钮 → 桥调用 `hello.sayHello` 命令 → 宿主执行 handler → 返回值显示在面板里。

## 注意

- 面板资源（HTML/CSS/JS/图片）都要打进插件 `package` 制品，用相对 files 根的路径引用；沙箱
  scope 之外的文件加载不到。
- 面板无法直接访问设备/文件系统——一切副作用都要经声明过的命令走宿主。
