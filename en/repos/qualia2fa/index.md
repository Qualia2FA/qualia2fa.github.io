# Application Qualia2FA

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">Windows · Android</span>
    <span class="q-pill">Compose Multiplatform</span>
    <span class="q-pill q-pill--version">v0.4.0</span>
    <span class="q-pill">Apache-2.0</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/Qualia2FA">GitHub</a>
    <a href="https://github.com/Qualia2FA/Qualia2FA/releases">Releases</a>
    <a href="https://github.com/Qualia2FA/Qualia2FA/security/policy">Security</a>
  </div>
</div>

Qualia2FA is a **serverless, non-realtime** multi-platform two-factor authentication application. Each device runs on its own, with no vendor server and no account registration. Devices signed in to the same account can share entries directly, and merging takes the union.

The interface is written with Compose Multiplatform and shares one codebase between the Windows desktop application and Android. The desktop target uses the official JVM target and is packaged with jlink + jpackage into a self-contained offline installer.

## Features

| Area | Content |
|---|---|
| Codes | TOTP (RFC 6238), HOTP (RFC 4226), mOTP, Yandex OTP, Steam Guard |
| Vault | Per-entry encryption, tree groups, entry icons, tombstone deletes, atomic writes |
| Import | Aegis JSON / HTML / TXT exports (encrypted exports included), `otpauth://` URIs, QR code images |
| Export | `.q2fa` containers, encrypted `.q2fa`, text, JSON, encrypted JSON, HTML |
| Sharing | QR codes (single frame, multiple frames, image import) and a LAN channel on the same subnet |
| Login | Register a new account, or obtain the master key by scanning a signed-in device; import a recovery key |
| Unlock | Unlock password (Argon2id) and biometrics (Windows Hello / Android BiometricPrompt) |
| Appearance | Light / dark / follow system; English and Simplified Chinese |

## Platforms and installation

| Platform | Artifacts | Notes |
|---|---|---|
| Windows 10 / 11 (x64) | `.msi` and `.exe` offline installers | Signed, but with a self-signed certificate, so Windows warns about an unknown publisher |
| Android 8.0 and above (64-bit ARM) | `.apk` | Signed with the project's release key, installable as it is |

Installers live on the [Releases](https://github.com/Qualia2FA/Qualia2FA/releases) page. Android currently ships only `arm64-v8a`, Windows only `x86_64`.

::: tip Permissions
The camera permission is requested only for scanning; declining it still leaves image import. The local network permission is used only for pairing or syncing. The application requests no background permissions and does not sync in the background.
:::

## Security model

- **The master key is never written to disk directly.** The platform key store creates a key-encryption key internally (TPM on Windows, falling back to the CNG software store; Keystore / StrongBox on Android), and the data directory holds only what that key produced. Copying the files does not copy the account.
- **The backend is reported honestly.** The settings screen shows whether the current protection is `tpm`, `android-keystore` or `software`. Without hardware there is no silent downgrade; the user decides whether to accept it.
- **The unlock password is a separate layer.** The master key is first wrapped by a key derived from the password with Argon2id (`master.key.pw`), and, where the device supports it, by a second wrap released by system authentication (`master.key.bio`). Either path opens the same master key, and the password is always the way back in.
- **Automatic locking.** Locking can be triggered from the settings at any time, and fifteen minutes without a touch locks the vault; bringing another window to the front does not lock it immediately.
- **End-to-end encryption.** Entries are encrypted before they leave the device, so an intermediary on the sharing channel sees no plaintext. Conflict decisions apply to the local device only and must be written to disk.

## Interface

Light and dark are two readings of the same mark: light is dark lines on a light ground (`#EAF2F4` ground, `#091012` lines), and dark swaps the two. The theme follows the system setting; the application offers no switch of its own.

The two platforms read that setting at different moments: Android receives configuration changes while running, so a switch takes effect immediately; the Windows desktop toolkit reads it once when the window is created, so a change applies on the next launch.

Strings live in `composeApp/src/commonMain/composeResources/`: `values/` is the default English and `values-zh/` is Chinese. The default follows the system language, and both the login screen and the settings screen can switch it manually.

Contrast is computed rather than judged by eye: `ThemeTest` checks every foreground / background pair that really appears in the interface against WCAG 2.1, and both palettes must reach AA (4.5:1).

## Code layout

```text
composeApp/
├── src/commonMain/             interface and business code (Kotlin, shared)
│   ├── composeResources/       marks and icons, strings in values/ and values-zh/
│   └── kotlin/dev/qualia/qualia2fa/
│       ├── Layout.kt           layout rules as pure functions
│       ├── Theme.kt            two palettes, corner radii and spacing
│       └── *Screen.kt          loading, login, 2FA, sync, settings and pairing
├── src/androidJvmMain/         shared by desktop and Android: vault file and wrapped master key
├── src/jvmMain/                desktop: data directory, file dialogs, window
├── src/androidMain/            Android: Activity, camera, file picker, local network
└── src/jvmTest/                unit tests, including the contrast of both palettes
```

`Qualia.kt` is the only file in the repository that imports the generated bindings: the interface sees ordinary Kotlin values, and replacing, patching or forking the binding layer should touch that one file.

## Building from source

Needs JDK 21 and a Rust toolchain (MSVC on Windows). The application builds the **published** `qualia2fa-ffi`: at configuration time the source is fetched from crates.io, checked against the SHA-256 in the registry and unpacked into the git-ignored `composeApp/rust/`.

```bash
./gradlew :composeApp:jvmTest          # compile and run unit tests
./gradlew :composeApp:run              # start the desktop application
./gradlew :composeApp:packageMsi       # package the MSI
./gradlew :composeApp:assembleRelease  # Android release package
```

See [Install and build](/en/guide/getting-started/) for prerequisites and the commands for each layer.

## Current boundaries

- **Windows and Android only.** Linux, iOS and macOS are planned; the author has no Apple hardware, so the latter two are indefinitely deferred.
- **No background sync.** Devices share on demand, and the LAN channel exists only while a screen that needs it is open.
- **A lost master key cannot be recovered.** Export and keep a recovery key.
- **The Windows installer certificate is not trusted yet.** Until it comes from a trusted issuer, the signature is not an identity to rely on.

## Related repositories

- The binding layer the interface calls: [Qualia2FA-FFI](/en/repos/ffi/)
- All cryptography and protocols: [Qualia2FA-Core](/en/repos/core/)
- Device identity and platform key stores: [QualiaDeviceIdentityKit](/en/repos/qualia-dik/)
- QR codes and the local network: [QualiaTransport](/en/repos/qualia-transport/)
- Platform auth-bound wrapping: [QualiaBioAuth](/en/repos/qualia-bioauth/), [QualiaBioAuth-Android](/en/repos/qualia-bioauth-android/)

## Licence

The application is **Apache License 2.0**. The four Rust layers and the two auth libraries are **LGPL-3.0-or-later**. The split is deliberate: the application layer stays permissive for distribution and downstream work, while the cryptographic core stays copyleft so that changes must be contributed back.
