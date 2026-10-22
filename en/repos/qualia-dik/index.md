# Device identity QualiaDeviceIdentityKit

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">crate qualia-dik</span>
    <span class="q-pill q-pill--version">v0.1.4</span>
    <span class="q-pill">Rust 1.89+</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/QualiaDeviceIdentityKit">GitHub</a>
    <a href="https://crates.io/crates/qualia-dik">crates.io</a>
    <a href="https://docs.rs/qualia-dik">docs.rs</a>
  </div>
</div>

A device identity toolkit: **P-256 device identity primitives** plus **platform-native hardware keystores**.

The library wraps "generate an ECDSA P-256 key inside the device hardware, read its public key, let the hardware sign a message" in a safe Rust interface, and provides the **public-key side** as well — representation, fingerprints and verification — so that callers never touch a platform API and never reimplement the curve arithmetic.

The private key **never leaves the hardware** and never enters this process's address space.

## Two halves, one concept

| Module | Does | Holds the private key |
|---|---|---|
| `device` | Public key representation, device fingerprint (`DeviceId`), verification | No |
| `keystore` | Key generation, public key lookup, signing, application master key storage | Yes (inside the hardware) |

Both halves share one error type. They are separate for a practical reason: **a device has to be able to verify somebody else's signature while holding no hardware key of its own** (a desktop machine without a TPM is exactly that).

```rust
use qualia_dik::{DeviceKeyStore, device};

let signer = store.open_or_create("account-1")?;

// The public key is not a secret and may be shared freely.
println!("device id: {}", signer.public_key().device_id());

let message = b"a message to sign";
let signature = signer.sign(message)?;

// Verification needs neither a keystore nor a private key.
device::verify(signer.public_key(), message, &signature)?;
```

## Platform support

| Platform | Device identity key | Master key: direct | Master key: wrapped |
|---|---|---|---|
| Windows | CNG `NCrypt*` + TPM 2.0; CNG software store without a TPM | Software key store | TPM when present, otherwise the software store |
| Android | Keystore / StrongBox | Implemented, reporting what Keystore says about that entry | Implemented, preferring StrongBox |
| macOS / iOS / Linux | Not implemented; `UnsupportedPlatform` | `UnsupportedPlatform` | `UnsupportedPlatform` |

`DeviceKeyStore::backend` reports the backend a key store is **actually** using at run time. On a Windows machine without a TPM it returns `Backend::Software`: the private key is stored in software and protected only by the operating system user account. **This layer never downgrades silently**; an unimplemented platform returns `UnsupportedPlatform`, and whether to accept a software key is the caller's (and the user's) decision.

::: tip Why the "direct" form lands in software on Windows
The Microsoft Platform Crypto Provider accepts the key and then refuses to export the material (`NTE_PERM`). A store that cannot hand the material back does not satisfy the "direct" contract, so it reports `Backend::Software` honestly. Choose the **wrapped** form when TPM protection is wanted.
:::

## Interface

The crate exports two modules: `device` (the public-key side) and `keystore` (platform key stores). Full signatures are on [docs.rs](https://docs.rs/qualia-dik).

### The `device` module

| Item | Notes |
|---|---|
| `DeviceId` | 32-byte device fingerprint; `from_public_key`, `from_bytes`, `as_bytes`, `to_hex` |
| `DevicePublicKey` | SEC1 public key; `from_sec1_bytes`, `as_sec1_bytes`, `device_id` |
| `DeviceSignature` | 64-byte ECDSA signature; `from_bytes`, `as_bytes` |
| `device::verify(public_key, message, signature)` | Hash with SHA-256 and verify; no key store needed |
| `PUBLIC_KEY_LEN` / `SIGNATURE_LEN` / `DEVICE_ID_LEN` | Length constants |

### The `keystore` module

| Type / method | Notes |
|---|---|
| `Backend` | `Tpm`, `SecureEnclave`, `AndroidKeystore`, `Software`, `Unavailable`; `is_hardware_backed`, `as_str` |
| `DeviceKeyStore` | `backend()`, `open(label)`, `create(label)`, `delete(label)`, `open_or_create(label)` |
| `DeviceSigner` | `backend()`, `public_key()`, `sign(message)`, `sign_digest(digest)` |
| `DirectMasterKeyStore` | `backend()`, `store(label, key)`, `load(label)`, `delete(label)` |
| `WrappedMasterKeyStore` | `backend()`, `store(label, key) -> WrappedMasterKey`, `load(label, &wrapped)`, `delete(label)` |
| `MasterKey` | 32 bytes; `from_bytes([u8; 32])`, `as_bytes()`; zeroized on drop, `Debug` prints the length only |
| `WrappedMasterKey` | Opaque platform-wrapped bytes; `from_bytes`, `as_bytes`, `into_bytes` |
| `PlatformKeyStore` | The current platform's `DeviceKeyStore`; `open_best_available()` returns `Result` on Windows / Android |
| `PlatformDirectMasterKeyStore` / `PlatformWrappedMasterKeyStore` | The current platform's two master-key stores |
| `PlatformProvider` | Selects the TPM or software provider on Windows (`Tpm` / `Software`) |
| `platform_backend_is_implemented()` | Whether this platform has an implementation at all (**never probes hardware**) |
| `sha256(message)` | The project-wide message digest |

`platform_backend_is_implemented()` answers "does this platform have an implementation", not "can this machine use it"; the runtime answer is `backend()`.

### Errors and contracts

- Every fallible operation returns `Result<T, Error>`; `Error` is `#[non_exhaustive]`.
- `label` is a persistent name allowing only ASCII letters, digits, `-`, `_` and `.`; `create` never overwrites, while `open_or_create` opens or creates.
- `delete` is irreversible; ask the user first.
- `sign` signs a **message**, `sign_digest` signs a **digest**; message mode uses SHA-256, and callers must not hash first.
- `backend()` must report the real backend; without hardware it returns `Software`, never a pretence of `Tpm`.
- No input may panic, and no error may contain secret material.

## The two forms of master key storage

Besides the device identity key, the platform key store holds **the application's master key** — the vault file is encrypted with it. The master key is 32 opaque bytes in `MasterKey`: this crate only moves it between the caller and the platform and derives nothing from it. There are two forms, and **the caller chooses by choosing a type**, not by a runtime flag:

| Form | Contract | What the platform store holds | What the caller persists |
|---|---|---|---|
| Direct | `DirectMasterKeyStore` | The master key material itself | Nothing |
| Wrapped | `WrappedMasterKeyStore` | A **non-exportable** KEK | The returned wrapped bytes |

```rust
use qualia_dik::{
    DirectMasterKeyStore, MasterKey, MockDirectMasterKeyStore, MockWrappedMasterKeyStore,
    WrappedMasterKeyStore,
};

let key = MasterKey::from_bytes([0x2A; qualia_dik::MASTER_KEY_LEN]);

// Direct: the store holds the material, the caller persists nothing.
let direct = MockDirectMasterKeyStore::new();
direct.store("account-1", &key)?;
let loaded = direct.load("account-1")?;

// Wrapped: the store holds the KEK, the caller keeps the returned bytes with the vault.
let wrapped_store = MockWrappedMasterKeyStore::new();
let blob = wrapped_store.store("account-1", &key)?;
let loaded_again = wrapped_store.load("account-1", &blob)?;
```

On a real platform, replace the two `Mock*` types with `PlatformDirectMasterKeyStore` / `PlatformWrappedMasterKeyStore`.

KEK encryption and decryption **appear in no interface**: there is no wrap / unwrap / encrypt / decrypt, and no method returns that key — wrapping is an internal design of this form. Both forms report the backend that actually took effect through `backend()`.

## Install and integrate

```toml
[dependencies]
qualia-dik = "0.1"
```

To use the in-memory backend in your own tests (for example, testing protocol logic on a CI machine without a TPM):

```toml
[dev-dependencies]
qualia-dik = { version = "0.1", features = ["mock"] }
```

```rust
use qualia_dik::{DeviceKeyStore, MockKeyStore};

let store = MockKeyStore::new();
let signer = store.create("test-device")?;
```

The `mock` backend's "hardware" is a `HashMap` and it **does not persist**. It is for tests only: code that used it on a production path would expose itself immediately on restart (the key is gone), rather than running forever with a key that has no hardware protection.

## Interface contracts

- **`label` is the persistent name of an identity.** It allows only ASCII letters, digits, `-`, `_` and `.`. It becomes part of the system key store's namespace, so NUL and similar characters are forbidden — `"a\0b"` and `"a"` are the same name to a C string, which would collide two different identities.
- **`create` never overwrites an existing key**; it returns `KeyAlreadyExists`. Use `open_or_create` for "open if present, create otherwise".
- **`delete` is irreversible**: that device can never prove it is the same device again, and peers' records of it become unverifiable orphans. Ask the user first.
- **`sign` takes a message, `sign_digest` takes a digest.** Signing and verification need one answer to "who hashes", so message mode always uses SHA-256; `device::verify` follows the same rule.
- **The signature algorithm is fixed to ECDSA P-256.** This is a hard constraint, not a preference: Android KeyMint has no EdDSA, and Apple's Secure Enclave supports only NIST P-256.

## Security boundary

This crate is the **only place in the project where `unsafe` is allowed**, and the only place touching platform-native APIs. It exists so that upper layers can keep `#![forbid(unsafe_code)]`. Therefore **do not** put protocol logic, cryptographic primitives or anything expressible in pure Rust here.

- Every `unsafe` block states why its invariant holds under `// SAFETY:`.
- No input may cause a panic.
- Errors must not contain secret material.
- **Never downgrade to a software key silently.** That would let users believe they are hardware-protected when they are not.
- When adding a platform backend, add it to `platform_backend_is_implemented` and to the platform table.

## Build and test

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets                    # including the real-TPM integration tests
cargo test --doc --features mock            # doc examples need the mock backend
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo check --features mock
cargo deny check
```

Code for non-Windows platforms is invisible on Windows but visible to Linux CI. The installed cross targets can check it early:

```bash
cargo clippy --target x86_64-unknown-linux-gnu --lib -- -D warnings
cargo check  --target aarch64-linux-android --lib
```

## Publishing

A `v*` tag triggers the publish workflow. It first runs `cargo publish --dry-run` on Windows, Linux and macOS, and only publishes after all three agree that the package is sound. `workflow_dispatch` verifies without publishing.

Publishing is irreversible: a version number on crates.io exists forever once taken. That is why it hangs on a **tag**, not on a push to master.

## Related repositories

- The core that uses it: [Qualia2FA-Core](/en/repos/core/)
- Exposing it to Kotlin / Swift: [Qualia2FA-FFI](/en/repos/ffi/)
- Platform auth-bound wrapping: [QualiaBioAuth](/en/repos/qualia-bioauth/)

## Licence

LGPL-3.0-or-later; see `LICENSE` and `COPYING.LESSER` in the repository. LGPL rather than MIT / Apache is deliberate: this crate handles the private keys of a device identity, so any modification should come back as source and remain auditable.
