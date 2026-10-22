# Qualia2FA 文档站

Qualia2FA 项目及其六个库的文档，使用 [VitePress](https://vitepress.dev/) 构建，发布在 <https://qualia2fa.github.io>。

英文版见 [README.en.md](README.en.md)。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev       # http://localhost:5173
```

构建并预览生产版本：

```bash
npm run build
npm run preview
```

## 站点结构

```text
.
├── .vitepress/
│   ├── config.mts          站点配置、双语导航、UA 语言检测
│   └── theme/              导航栏语言切换器与样式
├── public/                 静态资源（标志、robots.txt 等）
├── index.md                中文首页
├── guide/                  中文总览与安装构建
├── repos/                  七个仓库的中文页面
├── en/                     上面对应的英文页面
└── .github/workflows/      GitHub Pages 部署
```

中文页面在根路径（`/`），英文页面在 `/en/` 下。两边的目录结构一一对应，新增页面时请同时补上另一种语言。

## 多语言

- 站点默认语言是简体中文；`/en/` 是英文。
- 首次访问时，页面头部的一小段脚本读取 `navigator.languages`，选择中文或英文，然后跳转到对应语言。检测只在每个会话里做一次。
- 导航栏右上角的切换器（移动端在菜单里）提供「简体中文」「English」和「跟随浏览器语言」三项。手动选择会写入 `localStorage`，此后不再自动跳转。
- 语言切换器按路径映射另一种语言：`/repos/core/` ↔ `/en/repos/core/`。

新增或修改内容时的约定：

- 中英文页面保持相同的章节、代码、版本号与链接。
- 页面内的站内链接使用以 `.md` 结尾的相对路径，VitePress 会在构建时检查死链。
- 版本号写在页面上，必须与各仓库的标签和清单一致；发布新版本时一起更新。
- 不把秘密材料、令牌或本地路径写进文档。

## 部署

推送到 `main` 会触发 `.github/workflows/deploy.yml`：安装依赖、构建、上传 `.vitepress/dist`，再由 GitHub Pages 发布。仓库的 Pages 来源必须设为 **GitHub Actions**。

站点是用户主页仓库（`qualia2fa.github.io`），因此构建的 `base` 是 `/`，不需要 CNAME。仓库当前绑定了自定义域名 `qualia2fa.qiushui1012.com`；`qualia2fa.github.io` 会 301 到它，HTTPS 已强制开启。

## 许可

文档内容与 Qualia2FA 项目一致：应用以 Apache-2.0 发布，Rust 库以 LGPL-3.0-or-later 发布。
