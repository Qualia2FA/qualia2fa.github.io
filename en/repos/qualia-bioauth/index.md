# Auth-bound keys QualiaBioAuth

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">crate qualia-bioauth</span>
    <span class="q-pill q-pill--version">v0.1.0</span>
    <span class="q-pill">Windows Hello</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/QualiaBioAuth">GitHub</a>
    <a href="https://crates.io/crates/qualia-bioauth">crates.io</a>
    <a href="https://docs.rs/qualia-bioauth">docs.rs</a>
  </div>
</div>

`qualia-bioauth` is an independent library: it wraps a 32-byte key so that it can be opened only after the platform has completed user authentication. It does not depend on Qualia2FA's vault format, protocols or core library.

## What it solves

A password wrap protects a key, but passwords can be guessed, shoulder-surfed and reused. This library adds another route: the platform itself holds the key that opens the wrap.

| Platform | Mechanism | Status |
|---|---|---|
| **Windows** | The `hmac-secret` output (WebAuthn PRF) of a Windows Hello credential, released only by a Hello gesture | Implemented |
| **Android** | An AES key in Keystore with `setUserAuthenticationRequired(true)`; unwrapping must use `BiometricPrompt`'s `CryptoObject(Cipher)` | Planned for the Rust side; Android applications should use [QualiaBioAuth-Android](/en/repos/qualia-bioauth-android/) |
| **Apple** | Reserved for the Secure Enclave's `.userPresence` | Not implemented |
| **Linux** | No backend | Reports `Unsupported` honestly |

The two wraps are independent: either one opens the same key, so a forgotten password or a re-enrolled fingerprint does not lock the user out; when neither is usable the library fails closed and does not fall back to a software key.

::: warning Not a substitute for a password
The platform may be unavailable, the user may remove a PIN or fingerprint, and re-enrolment can invalidate a credential. **The password path must always stay in place.**
:::

## Usage

```toml
[dependencies]
qualia-bioauth = { version = "0.1", features = ["mock"] }
```

```rust
use qualia_bioauth::{AuthBoundKeyStore, Availability, MasterKey, mock::MockKeyStore};

let store = MockKeyStore::new();
if store.availability().is_available() {
    let master = MasterKey::from_bytes(&[7_u8; 32]).expect("32 bytes");
    let blob = store.wrap(&master).expect("wrap");
    let restored = store.unwrap(&blob).expect("unwrap");
    assert_eq!(restored, master);
}
```

A real backend is used the same way:

```rust
use qualia_bioauth::{AuthBoundKeyStore, platform};

let store = platform::open_best_available();
match store.availability() {
    qualia_bioauth::Availability::Available { backend, hardware_backed } => {
        // Offer the path; backend names the mechanism that answered.
    }
    qualia_bioauth::Availability::Unavailable { reason } => {
        // The mechanism exists, but this machine or user cannot use it right now.
    }
    qualia_bioauth::Availability::Unsupported { reason } => {
        // This build has no backend for the platform; password only.
    }
}
```

`open_best_available()` always returns a value; ask `availability()` before offering the path. It does not prompt and does not touch the platform.

## Outer format

```text
magic `Q2FABIO1` (8) | version 1 (1) | backend (1) | wrapped length (4, BE) | wrapped bytes
```

The platform-private payload is opaque; the outer layer only checks the magic, version, backend and length. The backend identifies the platform that wrote the blob; an unknown backend is rejected because the wrapped bytes have a layout this build cannot parse.

`MasterKey` is 32 bytes, zeroizes on drop, and its `Debug` output shows no content.

## Interface

Full signatures are on [docs.rs](https://docs.rs/qualia-bioauth).

### Core types

| Item | Notes |
|---|---|
| `MasterKey` | 32-byte key; `from_array([u8; 32])`, `from_bytes(&[u8])`, `expose_secret()`, `ct_eq()`; zeroized on drop, `Debug` prints the length only |
| `MASTER_KEY_LEN` | 32 |
| `AuthBoundKeyStore` | The platform auth-bound key-store trait |
| `platform::open_best_available()` | Returns the best implementation for this platform (`Box<dyn AuthBoundKeyStore>`); no prompt, no platform access |

### `AuthBoundKeyStore` methods

| Method | Notes |
|---|---|
| `availability()` | Report whether this machine can use the path, without prompting: `Available` / `Unavailable` / `Unsupported` |
| `create()` | Create the platform key or credential; may prompt; idempotent |
| `wrap(&master)` | Wrap the master key and return the complete blob (magic included) |
| `unwrap(&blob)` | Complete one platform authentication and return the master key; a blob from another backend reports `WrongBackend` |
| `delete_blob(&blob)` | Delete the platform credential the blob names; used when the path is turned off |
| `delete()` | Delete this store's platform key; idempotent |

The three `Availability` variants are deliberately separate:

| Variant | Meaning |
|---|---|
| `Available { backend, hardware_backed }` | The mechanism works; `hardware_backed` is what the platform **actually** reported |
| `Unavailable { reason }` | The mechanism exists, but this machine or user cannot use it now (no Hello enrolment, a removed fingerprint, an Android version below 28) |
| `Unsupported { reason }` | This build has no backend for the platform |

### Outer format

| Item | Notes |
|---|---|
| `AuthBlob` | `magic + version + backend + length + wrapped` |
| `AuthBlob::new(backend, wrapped)` / `parse(bytes)` / `encode()` | Construct, parse, serialise |
| `AuthBlob::backend()` / `wrapped()` / `expect_backend(expected)` | Read the backend and payload; reject another backend |
| `FORMAT_VERSION` / `HEADER_LEN` / `MAX_WRAPPED_LEN` / `MAX_BLOB_LEN` | Format constants |

### Host side

| Item | Notes |
|---|---|
| `PlatformSealer` | The narrow interface a host implements: one prompt plus one AES-GCM operation |
| `DelegatingKeyStore` | Adapts a `PlatformSealer` into an `AuthBoundKeyStore` for the FFI or host side |

### Errors and contracts

- Every fallible API returns `Result<T, Error>`; `Error` is `#[non_exhaustive]`.
- When the platform is unavailable, return `Unavailable` / `Unsupported`; **never** fall back to a software key.
- `wrap` may prompt; `availability` does not. Ask `availability` before offering the path.
- A blob is not a secret, but do not log it: a copied blob is still a target.
- No input may panic; errors and `Debug` contain no key or payload bytes.
- `unsafe` is allowed only in platform backends, and every block states its `// SAFETY:` reason.

## Windows backend

It requires the platform authenticator to really return `hmac-secret` from `GetAssertion`. The attestation's `bPrfEnabled` is **not** used as the criterion: on Windows 11 23H2 the credential is created with that flag at zero. The library distrusts the flag and treats the first assertion as the test — 32 bytes returned means success; a refusal or a missing hmac-secret means `Unavailable`.

A browser PRF demo succeeding therefore does not prove that the native Win32 API works. Acceptance must run this library's `hello_probe`.

The WebAuthn API version also decides the struct layout: an API 9 runtime (Windows 11 25H2) rejects the v7 `WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS` with `NTE_INVALID_PARAMETER`, so the v9 layout is required. The library picks the layout from `WebAuthNGetApiVersionNumber` and pins the struct size with a compile-time assertion on x64.

Windows L3 acceptance has passed (API 9; `create` / `wrap` / `unwrap` / `delete` all green). It depends on three things: a process image on local disk, a non-null parent window, and a Windows build that supports PRF.

## Integration contracts

- The library **does no I/O**: `wrap` returns the complete outer blob and the caller decides where it goes.
- It **does not depend on `qualia2fa-core`**: the 32-byte key type is local, and an application converts at the boundary.
- Platform payloads are private; the outer format only checks magic, version, backend and length.
- No input may panic; error messages and `Debug` contain no key or payload bytes.
- `unsafe` is allowed only in platform backends, and every block states its reason under `// SAFETY:`.

## Build and test

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --features mock -- -D warnings
cargo test --all-targets --features mock
cargo test --doc --features mock
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo deny check
```

Platform backends need verification on real Windows / Android hardware; without it, `Availability` must report `Unavailable` or `Unsupported`, never pretend to work.

## Related repositories

- The binding layer exposing it: [Qualia2FA-FFI](/en/repos/ffi/)
- The Android implementation: [QualiaBioAuth-Android](/en/repos/qualia-bioauth-android/)
- The other protection layer for the master key: [the core's unlock password](/en/repos/core/#unlock-password)

## Licence

LGPL-3.0-or-later; see `COPYING.LESSER` and `LICENSE` in the repository.
