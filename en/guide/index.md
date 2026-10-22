# Overview

Qualia2FA is a **serverless, non-realtime** two-factor authentication (2FA) application. Each device runs on its own, with no vendor server and no account registration; the unlock password stays on the device. Devices signed in to the same account can share entries on demand, and merging takes the union.

Seven repositories sit around it: one application and six libraries that can be used on their own. They share one set of security rules, but dependencies always point in a single direction.

## Design choices

| Choice | Meaning |
|---|---|
| **No centre** | No server, no traditional account system, no "forgot password" flow. Keys live only on the user's devices. |
| **No realtime sync** | Devices share on demand instead of syncing in the background. A server outage cannot keep a user away from a code. |
| **End-to-end encryption** | Entries are encrypted individually before they leave a device. Intermediaries on the QR and LAN channels see no plaintext. |
| **Works offline** | Codes keep working without a network, as do import, export and local management. |
| **No silent downgrade** | Without a hardware key store the backend is reported as `software`, and the user decides whether to accept weaker protection. |
| **No secrets in logs** | Master keys, OTP seeds and session keys never enter logs, error messages, panic messages or `Debug` output. |

## Accounts and keys

A Qualia2FA account has **no password**. Its only credential is a random 32-byte master key.

1. **The first device registers.** It generates the master key locally and encrypts the vault with it. The master key itself is held by the platform key store: TPM or CNG on Windows, Keystore / StrongBox on Android.
2. **Later devices log in.** A signed-in device shows a QR code. The new device scans it, establishes an ECDH session with the old one, and receives the master key after both sides are verified. The master key never passes through a server.
3. **The master key can be backed up.** Exporting a recovery key file (protected by a passphrase) is the only offline way back. If the master key is lost, the data can never be decrypted.
4. **The unlock password is an extra layer.** Since 0.4.0 the master key is first wrapped by a key derived from the password with Argon2id, and, where the device supports it, by a second wrap released by Windows Hello or Android biometrics. Either path opens the same master key, and the password always remains the way back in.

During sync the two devices each show one code, one direction at a time: one presents its state, the other reads and merges it, then they swap. The core encrypts and authenticates the payload; the channel only moves bytes. Conflicts are decided entry by entry, the decision applies to the local device only, and it must be written to disk.

## Repository map

The versions below are those at the time of writing; the tags and manifests in each repository are authoritative.

| Repository | Artifact | Version | Responsibility | Licence |
|---|---|---|---|---|
| [Qualia2FA](/en/repos/qualia2fa/) | Windows / Android application | 0.4.0 | Compose Multiplatform interface and host integration | Apache-2.0 |
| [Qualia2FA-Core](/en/repos/core/) | crate `qualia2fa-core` | 0.4.1 | Cryptography, vault, pairing and sync protocols | LGPL-3.0-or-later |
| [Qualia2FA-FFI](/en/repos/ffi/) | crate `qualia2fa-ffi` | 0.4.1 | UniFFI bindings and the LAN channel | LGPL-3.0-or-later |
| [QualiaDeviceIdentityKit](/en/repos/qualia-dik/) | crate `qualia-dik` | 0.1.4 | Device identity primitives and platform key stores | LGPL-3.0-or-later |
| [QualiaTransport](/en/repos/qualia-transport/) | crate `qualia-transport` | 0.1.6 | QR and LAN transport | LGPL-3.0-or-later |
| [QualiaBioAuth](/en/repos/qualia-bioauth/) | crate `qualia-bioauth` | 0.1.0 | Auth-bound key wrapping (Windows Hello) | LGPL-3.0-or-later |
| [QualiaBioAuth-Android](/en/repos/qualia-bioauth-android/) | `com.qiushui1012.lib:qualia-bioauth-android` | 0.1.0 | Android Keystore + BiometricPrompt wrapping | LGPL-3.0-or-later |

## Dependency direction

```text
qualia-dik ────────► qualia2fa-core ────────► qualia2fa-ffi ────────► Qualia2FA
qualia-transport ──► qualia2fa-core
qualia-transport ─────────────────────────► qualia2fa-ffi   (iroh-lan)
qualia-bioauth ───────────────────────────► qualia2fa-ffi
qualia-bioauth-android ───────────────────────────────────────────► Qualia2FA (Android)
```

Three rules hold this shape in place:

- **Independent libraries are only ever depended on, never the other way round.** The test is one sentence: does it still make sense knowing nothing about Qualia2FA? "Generate a P-256 identity key inside platform hardware" does. "The vault file format" does not.
- **Dependencies always name a crates.io version**, never a submodule and never a `../Xxx` path. None of the four Rust manifests declares `[workspace]`; each is its own workspace root.
- **The application builds the published `qualia2fa-ffi`.** The crate is fetched at configuration time and checked against the SHA-256 in the registry before unpacking. Changing the version requires changing the checksum too, which prevents "new version number, old crate" from passing silently.

## Security boundaries

| Layer | Constraint |
|---|---|
| `qualia2fa-core` | `#![forbid(unsafe_code)]`; no I/O, no clock; no input may panic; owns all cryptography, the vault format and the protocols |
| `qualia-dik` | The only crate allowed to use `unsafe`, and the only one touching platform-native APIs; no protocol logic |
| `qualia2fa-ffi` | Marshalling only; cryptography, parsing or validation here is a design regression |
| `qualia-transport` | QR and LAN wire formats are pure logic; only the multicast lobby opens sockets, starts a thread and reads the clock |
| `qualia-bioauth` | Wraps the platform authentication boundary; no I/O, no knowledge of the vault format |
| `qualia-bioauth-android` | Platform calls only; the blob format and error taxonomy stay in the Rust crate |
| `Qualia2FA` | Host adapters contain no decisions; the interface only sees ordinary Kotlin values through the facade |

The algorithms are fixed as well: device identity signatures use **ECDSA P-256** (Android KeyMint has no EdDSA, and Apple's Secure Enclave supports only P-256); the vault uses **XChaCha20-Poly1305** per entry; password wrapping uses **Argon2id**; message mode uses **SHA-256**.

## Versions and compatibility

- **Vault file format: 4.** The current version always writes 4 and still reads 1–3 (the readable set only grows). An older application reading a version 4 file gets a clear "unsupported version" error.
- **Sync payload version: 4.** A payload accepts only the current version, so two devices with different payload versions cannot sync; upgrade every device together. The version is in the plaintext header, readable without a key, so the error is a version error rather than an authentication failure.
- **MSRV: 1.89.** `qualia-transport` needs 1.91 when `iroh-lan` is enabled (iroh 1.3.0's declaration). CI verifies both floors with real toolchains.
- **Publishing order is a hard constraint:** `qualia-dik` → `qualia2fa-core` → `qualia2fa-ffi`. A downstream crate depends on the exact version of its upstream on crates.io, so its `--dry-run` fails if the upstream has not been published. `qualia-transport`, `qualia-bioauth` and `qualia-bioauth-android` depend on no other layer and can be published at any time.

## Library interfaces

Each of the six libraries documents its public surface on its repository page, grouped by module, type, method and error:

| Library | Interface |
|---|---|
| Qualia2FA-Core | [Modules, vault, registration, sync and errors](/en/repos/core/#interface) |
| Qualia2FA-FFI | [Top-level functions, objects, records and errors](/en/repos/ffi/#interface) |
| QualiaDeviceIdentityKit | [`device` and `keystore` types and methods](/en/repos/qualia-dik/#interface) |
| QualiaTransport | [QR, framing, envelope and LAN](/en/repos/qualia-transport/#interface) |
| QualiaBioAuth | [`AuthBoundKeyStore`, `Availability` and the outer format](/en/repos/qualia-bioauth/#interface) |
| QualiaBioAuth-Android | [`BiometricSealer`, `KeystoreBiometricSealer` and exceptions](/en/repos/qualia-bioauth-android/#interface) |

## Where to start

- **Using the application:** read [Install and build](/en/guide/getting-started/), or go straight to [the application](/en/repos/qualia2fa/).
- **Writing Rust:** start with [the core](/en/repos/core/). For device identity or platform key stores see [QualiaDeviceIdentityKit](/en/repos/qualia-dik/); for transport channels see [QualiaTransport](/en/repos/qualia-transport/).
- **Writing Kotlin or Swift:** see [Qualia2FA-FFI](/en/repos/ffi/). It already exports OTP, the vault, import/export, pairing, sync and the LAN channel.
- **Adding biometrics:** for Windows and Rust see [QualiaBioAuth](/en/repos/qualia-bioauth/); for an Android application see [QualiaBioAuth-Android](/en/repos/qualia-bioauth-android/).
