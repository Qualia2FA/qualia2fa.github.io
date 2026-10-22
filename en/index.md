---
layout: home
title: Qualia2FA Docs
titleTemplate: false

hero:
  name: Qualia2FA
  text: Your second lock, held only by you
  tagline: Serverless, non-realtime two-factor authentication. Keys stay on your devices, and entries are encrypted before they leave them.
  image:
    src: /logo.svg
    alt: Qualia2FA
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/getting-started/
    - theme: alt
      text: Overview
      link: /en/guide/

features:
  - title: No centre
    details: No server and no traditional account password. Codes are computed locally and keep working offline.
  - title: End-to-end encryption
    details: Entries are encrypted individually before leaving a device; QR and LAN channels carry ciphertext only.
  - title: Two sharing channels
    details: QR codes support single frames, multiple frames and image import; devices on the same subnet can discover each other directly.
  - title: Hardware protection
    details: The master key is wrapped by a TPM, Android Keystore or StrongBox. The real backend is reported, never silently downgraded.
  - title: Password and biometrics
    details: An Argon2id wrap plus Windows Hello or Android biometrics, with the password always kept as the way back in.
  - title: Open and auditable
    details: The application is Apache-2.0; the Rust libraries are LGPL-3.0-or-later.
---

<section class="q-section">
<div class="q-section__head">
<h2>Seven repositories, one protocol</h2>
<p>
The application itself, three Rust libraries behind it, the binding layer, and two independent platform authentication paths. Every repository builds and publishes on its own, and every dependency names a version on crates.io.
</p>
</div>

<div class="q-repos">
<a class="q-card q-card--wide" href="/en/repos/qualia2fa/">
<div class="q-card__top">
<span class="q-card__tag">Application</span>
<span class="q-card__version">v0.4.0</span>
</div>
<h3>Qualia2FA</h3>
<p>A Compose Multiplatform application sharing one interface and one set of logic between Windows and Android.</p>
<span class="q-card__link">Install and features →</span>
</a>

<a class="q-card" href="/en/repos/core/">
<div class="q-card__top">
<span class="q-card__tag">Core library</span>
<span class="q-card__version">qualia2fa-core · v0.4.1</span>
</div>
<h3>Qualia2FA-Core</h3>
<p>All cryptography, the vault format, and the pairing and sync protocols. No I/O, no clock, no unsafe.</p>
<span class="q-card__link">Read the docs →</span>
</a>

<a class="q-card" href="/en/repos/ffi/">
<div class="q-card__top">
<span class="q-card__tag">Bindings</span>
<span class="q-card__version">qualia2fa-ffi · v0.4.1</span>
</div>
<h3>Qualia2FA-FFI</h3>
<p>Exposes the core as UniFFI bindings for Kotlin and Swift, and implements the LAN channel.</p>
<span class="q-card__link">Read the docs →</span>
</a>

<a class="q-card" href="/en/repos/qualia-dik/">
<div class="q-card__top">
<span class="q-card__tag">Device identity</span>
<span class="q-card__version">qualia-dik · v0.1.4</span>
</div>
<h3>QualiaDeviceIdentityKit</h3>
<p>P-256 device identity primitives plus the platform-native key stores on Windows and Android.</p>
<span class="q-card__link">Read the docs →</span>
</a>

<a class="q-card" href="/en/repos/qualia-transport/">
<div class="q-card__top">
<span class="q-card__tag">Transport</span>
<span class="q-card__version">qualia-transport · v0.1.6</span>
</div>
<h3>QualiaTransport</h3>
<p>QR capacity model, framing and image decoding, plus LAN multicast discovery and data plane.</p>
<span class="q-card__link">Read the docs →</span>
</a>

<a class="q-card" href="/en/repos/qualia-bioauth/">
<div class="q-card__top">
<span class="q-card__tag">Auth-bound keys</span>
<span class="q-card__version">qualia-bioauth · v0.1.0</span>
</div>
<h3>QualiaBioAuth</h3>
<p>Wraps a 32-byte key so that only a completed platform authentication can open it; currently Windows Hello.</p>
<span class="q-card__link">Read the docs →</span>
</a>

<a class="q-card" href="/en/repos/qualia-bioauth-android/">
<div class="q-card__top">
<span class="q-card__tag">Android auth</span>
<span class="q-card__version">qualia-bioauth-android · v0.1.0</span>
</div>
<h3>QualiaBioAuth-Android</h3>
<p>Uses Android Keystore and BiometricPrompt to lock the master key behind the device's own user authentication.</p>
<span class="q-card__link">Read the docs →</span>
</a>
</div>
</section>

<section class="q-section">
<div class="q-section__head">
<h2>Dependencies always point one way</h2>
<p>The independent libraries know nothing about Qualia2FA; the core knows nothing about the interface or the platform.</p>
</div>

<pre class="q-arch">qualia-dik ────────► qualia2fa-core ────────► qualia2fa-ffi ────────► Qualia2FA
qualia-transport ──► qualia2fa-core
qualia-transport ─────────────────────────► qualia2fa-ffi   (iroh-lan)
qualia-bioauth ───────────────────────────► qualia2fa-ffi
qualia-bioauth-android ───────────────────────────────────────────► Qualia2FA (Android)</pre>

<p class="q-section__note">
Every arrow is a versioned crates.io dependency, not a submodule and not a path dependency on a sibling directory.
</p>

<div class="q-cta">
<div>
<h2>Ready to build</h2>
<p>Install the application, or bring one layer into your own project.</p>
</div>
<div class="q-cta__actions">
<a class="q-button q-button--brand" href="/en/guide/getting-started/">Install and build</a>
<a class="q-button" href="https://github.com/Qualia2FA">GitHub organisation</a>
</div>
</div>
</section>
