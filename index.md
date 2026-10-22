---
layout: home
title: Qualia2FA 文档
titleTemplate: false

hero:
  name: Qualia2FA
  text: 你的第二把锁，只在你手里
  tagline: 无中心服务器、不实时同步的双因素认证。密钥留在设备上，条目在离开设备之前就已加密。
  image:
    src: /logo.svg
    alt: Qualia2FA
  actions:
    - theme: brand
      text: 开始使用
      link: /guide/getting-started/
    - theme: alt
      text: 项目总览
      link: /guide/

features:
  - title: 无中心
    details: 没有服务端，也没有传统的账号密码。验证码在本地计算，断网时照常可用。
  - title: 端到端加密
    details: 条目逐条加密后才离开设备，二维码与局域网通道都只搬运密文。
  - title: 双通道分享
    details: 二维码支持单帧、多帧与图片导入；设备在同一网段时可以直接发现并传输。
  - title: 硬件保护
    details: 主密钥由 TPM、Android Keystore 或 StrongBox 包裹；实际后端如实上报，不静默降级。
  - title: 密码与生物识别
    details: Argon2id 包裹加 Windows Hello 或 Android 生物识别，密码始终保留为后路。
  - title: 开源可审计
    details: 应用以 Apache-2.0 发布，Rust 库以 LGPL-3.0-or-later 发布。
---

<section class="q-section">
<div class="q-section__head">
<h2>七个仓库，一套协议</h2>
<p>
应用本身、三个支撑它的 Rust 库、绑定层，以及两条独立的平台认证路径。
每个仓库都能单独构建、单独发布，依赖一律指向 crates.io 上的版本号。
</p>
</div>

<div class="q-repos">
<a class="q-card q-card--wide" href="/repos/qualia2fa/">
<div class="q-card__top">
<span class="q-card__tag">应用</span>
<span class="q-card__version">v0.4.0</span>
</div>
<h3>Qualia2FA</h3>
<p>Compose Multiplatform 应用，Windows 与 Android 共用同一套界面与逻辑。</p>
<span class="q-card__link">安装与功能 →</span>
</a>

<a class="q-card" href="/repos/core/">
<div class="q-card__top">
<span class="q-card__tag">核心库</span>
<span class="q-card__version">qualia2fa-core · v0.4.1</span>
</div>
<h3>Qualia2FA-Core</h3>
<p>全部密码学、保险库格式、配对与同步协议。无 I/O、无时钟、无 unsafe。</p>
<span class="q-card__link">查看文档 →</span>
</a>

<a class="q-card" href="/repos/ffi/">
<div class="q-card__top">
<span class="q-card__tag">绑定层</span>
<span class="q-card__version">qualia2fa-ffi · v0.4.1</span>
</div>
<h3>Qualia2FA-FFI</h3>
<p>把核心能力暴露为 UniFFI 绑定，供 Kotlin 与 Swift 调用，并实现局域网通道。</p>
<span class="q-card__link">查看文档 →</span>
</a>

<a class="q-card" href="/repos/qualia-dik/">
<div class="q-card__top">
<span class="q-card__tag">设备身份</span>
<span class="q-card__version">qualia-dik · v0.1.4</span>
</div>
<h3>QualiaDeviceIdentityKit</h3>
<p>P-256 设备身份原语，以及 Windows 与 Android 上的平台原生密钥库。</p>
<span class="q-card__link">查看文档 →</span>
</a>

<a class="q-card" href="/repos/qualia-transport/">
<div class="q-card__top">
<span class="q-card__tag">传输</span>
<span class="q-card__version">qualia-transport · v0.1.6</span>
</div>
<h3>QualiaTransport</h3>
<p>二维码的容量模型、拆帧与图像解码，以及局域网组播发现与数据面。</p>
<span class="q-card__link">查看文档 →</span>
</a>

<a class="q-card" href="/repos/qualia-bioauth/">
<div class="q-card__top">
<span class="q-card__tag">认证包裹</span>
<span class="q-card__version">qualia-bioauth · v0.1.0</span>
</div>
<h3>QualiaBioAuth</h3>
<p>把 32 字节密钥包裹成「平台完成用户认证后才能解开」的字节，当前实现 Windows Hello。</p>
<span class="q-card__link">查看文档 →</span>
</a>

<a class="q-card" href="/repos/qualia-bioauth-android/">
<div class="q-card__top">
<span class="q-card__tag">Android 认证</span>
<span class="q-card__version">qualia-bioauth-android · v0.1.0</span>
</div>
<h3>QualiaBioAuth-Android</h3>
<p>用 Android Keystore 与 BiometricPrompt，把主密钥锁在设备自身的用户认证之后。</p>
<span class="q-card__link">查看文档 →</span>
</a>
</div>
</section>

<section class="q-section">
<div class="q-section__head">
<h2>依赖方向永远单向</h2>
<p>独立库不知道 Qualia2FA 的存在；核心库不知道界面与平台。</p>
</div>

<pre class="q-arch">qualia-dik ────────► qualia2fa-core ────────► qualia2fa-ffi ────────► Qualia2FA
qualia-transport ──► qualia2fa-core
qualia-transport ─────────────────────────► qualia2fa-ffi   (iroh-lan)
qualia-bioauth ───────────────────────────► qualia2fa-ffi
qualia-bioauth-android ───────────────────────────────────────────► Qualia2FA (Android)</pre>

<p class="q-section__note">
每个箭头都是 crates.io 上的版本依赖，不是 submodule，也不是指向兄弟目录的路径依赖。
</p>

<div class="q-cta">
<div>
<h2>准备动手</h2>
<p>安装应用，或者把某一层接进你自己的项目。</p>
</div>
<div class="q-cta__actions">
<a class="q-button q-button--brand" href="/guide/getting-started/">安装与构建</a>
<a class="q-button" href="https://github.com/Qualia2FA">GitHub 组织</a>
</div>
</div>
</section>
