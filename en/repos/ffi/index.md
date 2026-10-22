# Bindings Qualia2FA-FFI

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">crate qualia2fa-ffi</span>
    <span class="q-pill q-pill--version">v0.4.1</span>
    <span class="q-pill">UniFFI 0.29</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/Qualia2FA-FFI">GitHub</a>
    <a href="https://crates.io/crates/qualia2fa-ffi">crates.io</a>
    <a href="https://docs.rs/qualia2fa-ffi">docs.rs</a>
  </div>
</div>

Exposes [`qualia2fa-core`](/en/repos/core/) as [UniFFI](https://mozilla.github.io/uniffi-rs/) bindings for Kotlin, Swift and other managed languages.

Besides marshalling the core interface, this layer **implements the LAN channel itself** (multicast discovery plus an endpoint data plane) — that half is available only on the Rust side and cannot be written by a host.

## Exported features

- OTP: TOTP / HOTP / mOTP / Yandex OTP / Steam Guard
- The vault, tree groups and entry icons
- Import and export (six formats, including two `.q2fa` containers)
- Recovery keys
- Register / log in
- Challenge-response and sync
- The master key in the platform key store (direct and wrapped forms)
- Platform auth-bound wrapping (Windows Hello)
- QR encoding/decoding and multi-frame reassembly
- The LAN channel (`iroh-lan`)

## Building the dynamic library

```bash
cargo build --release
```

The artifacts are `target/release/qualia2fa_ffi.dll` (Windows), `.so` (Linux / Android) and `.dylib` (macOS / iOS). For a static library take the `.lib` / `.a` from the same directory.

## Generating host bindings

The binding generator is this repository's own binary, so that **the UniFFI version generating the bindings is exactly the one that compiled the library**. A globally installed `uniffi-bindgen` lets the two sides drift, producing bindings that compile but do not match at run time.

```bash
cd FFI    # must run at the repository root: uniffi-bindgen invokes cargo metadata

# Kotlin (shared by the JVM desktop application and Android)
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/qualia2fa_ffi.dll \
    --language kotlin --out-dir ./bindings

# Swift (iOS)
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/qualia2fa_ffi.dll \
    --language swift --out-dir ./bindings-swift
```

Generated bindings are **not committed** — they are derived artifacts, produced by the host build before compilation. Committing them immediately creates the "bindings out of sync with the interface" problem.

::: tip Note
`Unable to auto-format ... using ktlint: program not found` only means the optional `ktlint` is missing; the output is still correct.
:::

## Calling it from Kotlin

The generated bindings live in the `uniffi.qualia2fa_ffi` package:

```kotlin
import uniffi.qualia2fa_ffi.*

// After the vault is open, the master key stays on the Rust side.
val vault = FfiVault.fromMasterKey(masterKeyBytes)
val now = System.currentTimeMillis() / 1000

val parsed = parseOtpauthUri(
    "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
)
// Each kind carries its own fields; only TOTP and mOTP/Yandex have a period.
val period = (parsed.kind as? FfiEntryKind.Totp)?.period ?: 30uL
val code = totpCode(parsed.secretBase32, now, period, parsed.algorithm, parsed.digits)
```

Bindings find the dynamic library by **name** through JNA (JVM) or the system loader (Swift), so `qualia2fa_ffi.dll` / `libqualia2fa_ffi.so` / `libqualia2fa_ffi.dylib` must ship with the application and land where the loader can find it.

## Interface

What crosses this layer is **UniFFI records, enums and objects**. The tables below group them by purpose; full signatures are on [docs.rs](https://docs.rs/qualia2fa-ffi).

### Top-level functions

| Group | Functions | Notes |
|---|---|---|
| URI | `parse_otpauth_uri`, `serialize_otpauth_uri` | Parse and serialise `otpauth://` |
| Codes | `totp_code`, `hotp_code`, `steam_guard_code`, `verify_code_with_drift`, `codes_match` | Compute, verify with drift, compare in constant time |
| Seeds | `generate_secret_base32`, `recommended_min_secret_len`, `is_secret_shorter_than_recommended`, `secret_byte_len` | Generation and strength checks |
| QR | `qr_encode`, `qr_decode`, `qr_decode_text`, `qr_unwrap_text`, `qr_frame_capacity`, `qr_encode_frames` | Encoding, decoding and framing |
| Unlock password | `lock_wrap_len`, `wrap_master_key_with_password`, `unwrap_master_key_with_password`, `lock_marker`, `lock_pending`, `is_lock_marker`, `is_lock_pending`, `is_lock_password_wrap` | Wrapping and state files |
| Recovery | `export_recovery_key_from_master`, `import_recovery_key`, `store_master_key` | Recovery keys and master-key storage |
| Import/export | `detect_import_format`, `export_format_needs_password`, `export_format_extension`, `export_format_carries_groups`, `export_format_group_carrying` | Format self-description |
| Portable files | `detect_portable_file`, `open_portable_file` | `.q2fa` detection and restore |
| Other | `core_version`, `max_group_depth`, `conflict_kind` | Version, group depth, conflict classification |

### Objects

| Object | Purpose |
|---|---|
| `FfiVault` | Holds the vault and master key; entries, groups, sync, export, recovery |
| `FfiImport` | Import preview, comparison against the vault, applying choices |
| `FfiLogin` / `FfiJoiner` | The two ends of a login |
| `FfiVerifier` / `FfiResponder` | The two ends of challenge-response |
| `FfiSyncSession` | Sync sessions and conflict decisions |
| `FfiDirectMasterKeyStore` / `FfiWrappedMasterKeyStore` | The two platform forms of master-key storage |
| `FfiAuthBoundKeyStore` | Platform auth-bound wrapping (Windows Hello and others) |
| `FfiPlatformKeys` | Platform device identity: public key, signature, device ID, backend |
| `FfiLanChannel` / `FfiLanLobby` | LAN endpoint and discovery |
| `FfiFrameCollector` | Multi-frame QR reassembly |

### Records and enums

| Group | Types |
|---|---|
| Codes | `FfiOtpAuth`, `FfiEntryKind`, `FfiAlgorithm`, `FfiDigits` |
| Vault | `FfiVaultEntry`, `FfiEntryIcon`, `FfiIconMime`, `FfiGroup`, `FfiGroupChild` |
| QR | `FfiQrImage`, `FfiQrFrame`, `FfiFrameStep`, `FfiEcLevel` |
| Import | `FfiImportFormat`, `FfiImportedEntry`, `FfiImportProblem`, `FfiImportedGroup`, `FfiDroppedSummary`, `FfiImportMatch`, `FfiImportDecision`, `FfiImportChoice`, `FfiImportApplied` |
| Export | `FfiExportFormat`, `FfiGroupCarrying` |
| Sync | `FfiPayloadKind`, `FfiRecipient`, `FfiRoster`, `FfiTransportCapabilities`, `FfiReceivedMessage`, `FfiSharePlan`, `FfiConflict`, `FfiConflictSide`, `FfiOrderingConflict`, `FfiDecision`, `FfiSyncOutcome` |
| Restore | `FfiPortableKind`, `FfiPortableRestore` |
| Authentication | `FfiAuthAvailability` |
| LAN | `FfiLanPeer` |
| Errors | `FfiError`, `FfiCoreError` |

`FfiException` is the error type a Kotlin caller sees; the generated bindings map it from `FfiError`. See [Error taxonomy](#error-taxonomy) below.

### Codes

| Function | Description |
|---|---|
| `parse_otpauth_uri` / `serialize_otpauth_uri` | Parse and serialise `otpauth://` URIs |
| `totp_code` / `hotp_code` | Compute a code |
| `steam_guard_code` | Steam Guard's 5-character alphabet |
| `verify_code_with_drift` | Drift-tolerant verification returning the matching offset |
| `codes_match` | Constant-time comparison |
| `generate_secret_base32` | Generate a 256-bit random seed (OS CSPRNG) |
| `core_version` | Core version, for compatibility checks |

**Time always comes from the caller.** The core never reads a clock; a host should pass Unix seconds from the system clock.

### Vault (`FfiVault`)

The entries are held by `FfiVault` and **the master key stays on the Rust side**. On the most common path — open, list, edit, write back — the master key never appears as bytes in Kotlin or Swift.

| Method | Description |
|---|---|
| `FfiVault.register(keys, store, label)` | Generate a master key, obtain a device identity, write to the platform key store |
| `FfiVault.open(store, data)` | Open a vault file with the master key in the key store |
| `FfiVault.fromMasterKey(bytes)` | Build an empty vault from an existing master key (after login or recovery) |
| `entries` / `entry(id)` | Read entries (order is not guaranteed; sort the list yourself) |
| `addEntry(entry, now)` / `updateEntry(entry, now)` | Add / modify (an update keeps the ID and leaves no tombstone) |
| `removeEntry(id, now)` | Delete (leaves a tombstone) |
| `serialize` | Serialise for the host to write **atomically** |
| `codeFor(id, now)` / `hotpFor(id, counter)` | Compute a code according to the **entry's kind** |
| `groups` / `childrenOf` / `parentOf` / `depthOf` | The tree itself |
| `createGroupIn` / `renameGroup` / `setChildren` / `removeGroup` | Group editing |
| `export(format, password)` | Export one of six formats |
| `exportRecoveryKey` / `detectPortableFile` / `openPortableFile` | Recovery keys and `.q2fa` restore |

The difference between `updateEntry` and `removeEntry` is not merely semantic: an update keeps the entry ID, a delete leaves a tombstone. The two are read as completely different operations on another device, so **never** implement an edit as "delete + add".

### Register and log in

```kotlin
// New device registration
val vault = FfiVault.register(deviceKeys, secureStore, "qualia2fa-device")

// Existing device (already signed in): show a QR code
val login = FfiLogin.begin()
showQrCode(login.payload())

// New device: scan, send the request, finish after the reply
val joiner = FfiJoiner.fromQr(scannedText, "qualia2fa-device")
val request = joiner.request(deviceKeys)
// …hand the request to the old device…
val reply = login.authorize(oldVault, request)   // the interface must confirm first
val masterKey = joiner.complete(reply, deviceKeys, secureStore)
```

A login can complete only once. A second call reports **the same error as a forged reply** — deliberately, because reporting "already used" would tell a replayer that they were recognised. Host wording should stay vague too.

### The two forms of master key storage

There are only two ways to store the master key on a platform, and **choosing which object to ask is the choice; there is no mode parameter**:

| Method | Description |
|---|---|
| `FfiDirectMasterKeyStore.open()` | The platform store holds the material (CNG on Windows, Keystore on Android) |
| `FfiWrappedMasterKeyStore.open()` | The platform store holds a non-exportable KEK; `store` returns the wrapped bytes the host persists |
| `backend()` / `isHardwareBacked()` | Report the backend that actually answered |

The master key crosses the boundary only as bytes (32 in, 32 out), never in logs or error messages. Wrapped bytes are opaque: the host persists them beside the vault file, and no wrapping, unwrapping or KEK access appears in this interface.

### Challenge-response

Proves that the other side holds the master key without handing it over. **All three steps are required**; skipping the third is half an authentication.

```kotlin
val verifier = FfiVerifier.begin()
val responder = FfiResponder.accept(verifier.challenge())
val response = responder.respond(vault, label, deviceKeys)
verifier.verify(response, vault)
responder.confirm(vault, verifier.sessionId()!!, verifier.confirmation()!!)
```

An empty vault can still tell whether the master key is right: since format version 2 the file ends with a master key check value, so `FfiVault.open` rejects a wrong key even in a file with no entries. The exception is an old version 1 file.

### Sync

Sync is **one code per device, one direction at a time**: one presents its state, the other reads and merges it, then they swap. The core encrypts and authenticates the payload; the channel only moves bytes.

```kotlin
val session = FfiSyncSession.open(vault)

session.send(channel, FfiRecipient.All, FfiPayloadKind.Vault)
showQrCode(channel.takeOutgoing())

channel.accept(senderId, payloadBytes)
val outcome = session.receive(channel)
if (outcome.needsAdjudication) {
    for (conflict in session.pendingConflicts()) {
        showConflict(conflict)
    }
    session.adjudicate(conflict.entryId, FfiDecision.TakeIncoming)
}
vault.serialize()?.let(::saveVault)     // the merge changed the vault: write it out
```

Conflict `kind` values are stable strings:

| kind | Meaning | The two choices |
|---|---|---|
| `entry_mismatch` | Both sides have the entry with different content | Keep local / take incoming |
| `peer_deleted` | The peer deleted it, this device kept and edited it | Keep entry / accept delete |
| `local_deleted` | This device deleted it, the peer still has it | Keep deleted / restore entry |

Decisions apply locally only. "Take incoming" really writes into the vault and therefore **must be persisted**; "keep local" does not make the disagreement disappear — the peer will ask its own user the next time it syncs.

### LAN channel

`FfiLanChannel` is a dialable endpoint and `FfiLanLobby` is discovery on the same subnet. Both satisfy **the same contract** as a host's own `FfiTransport`, so the sync session has no branch for the carrier.

```kotlin
val channel = FfiLanChannel.open(deviceId)      // explicit open: one UDP port and one runtime
val lobby = channel.openLobby()                 // explicit announce; nothing happens without it
showCode(withRecord(host.payload(), channel.record()))

val record = recordOf(scannedText)
val peer = lobby.peers().firstOrNull { it.record.contentEquals(record) }
if (peer?.socket != null) channel.rememberPeer(peer.deviceId, peer.record, peer.socket!!)
```

Three things a caller must know:

1. **Open explicitly, close explicitly, no background sync.** Opening a channel takes one UDP port and one tokio runtime (two worker threads); opening a lobby also announces to the subnet every 30 seconds. Call `shutdown()` when the screen that needs it goes away.
2. **The connection record contains no IP.** `record()` has only the endpoint public key and port; the IP comes from the side that received the multicast datagram, because the endpoint's own socket is a wildcard address that cannot be dialled.
3. **It depends on `qualia-transport` with `iroh-lan` enabled.** iroh, tokio and their dependency trees enter every build, noticeably increasing build time and artifact size.

## Error taxonomy

An FFI error arriving in Kotlin is a `sealed class FfiException`:

| Variant | Meaning |
|---|---|
| `InputTooLong` | Input exceeds the boundary limit |
| `Core` | An error from the core, structured as `FfiCoreError { kind, message }` |
| `Qr` | A failure reported by the QR channel itself |
| `Lan` | A failure reported by the LAN channel itself |
| `InvalidDeviceId` | The device ID is not 64 hexadecimal characters |
| `UnknownConflict` | A decision for a conflict that is not awaiting one |
| `AuthBound` | The platform auth-bound wrap failed |

`kind` is a **stable machine-readable identifier** (such as `secret_empty` or `vault_entry_not_found`) that the host uses to route the interface; `message` is for display and logs only. These strings are public interface: **new ones may be added, existing ones may never be renamed**.

The core is `#[non_exhaustive]`, so the host **must keep a fallback branch for unknown `kind` values**:

```kotlin
try {
    parseOtpauthUri(input)
} catch (e: FfiException.Core) {
    when (e.detail.kind) {
        "uri_missing_secret" -> showReenterHint()
        "randomness_unavailable" -> showRetryHint()
        else -> showGenericError(e.detail.message)   // the fallback must stay
    }
}
```

Some `kind` values are deliberately separate: `device_not_registered` must not merge with `vault_decryption_failed`, `pairing_authentication_failed` must not merge with any more specific error, and `sync_already_applied` must not merge with `sync_authentication_failed`. Merging them produces user-visible wrong diagnoses.

## Secret material

Across the FFI boundary an OTP seed is always a **Base32 string**. The seed bytes never cross as a `Vec<u8>` — that would leave an uneraseable copy on each side.

::: warning Residual risk in managed languages
On the Kotlin / Swift side the Base32 string is an ordinary `String`, outside the core's `secrecy` erasure, and may be copied by the GC or interned. The host should keep it in the narrowest possible scope, drop it immediately and **never log or persist it**.
:::

On the normal path the master key **does not cross at all**: `FfiVault` holds it on the Rust side, and reading, editing, computing codes and serialising all happen there. Only login, recovery and key-store access hand it over.

## Constraints

This crate's job is to turn host types into core types, call the core, and turn the results back. **Cryptography, parsing or validation here is a design regression.**

`uniffi::setup_scaffolding!()` expands the unsafe code the FFI boundary needs, so this crate cannot use `#![forbid(unsafe_code)]`. The safety boundary is drawn **between crates**: the core has no unsafe and is auditable alone, and the FFI layer only marshals.

UniFFI stays at `0.29` because the host binding generator Gobley pins `uniffi = "0.29.4"`, and the Rust and Kotlin scaffolds must match. That is also why `uniffi` never enters `qualia2fa-core`.

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

## Related repositories

- The core being wrapped: [Qualia2FA-Core](/en/repos/core/)
- Device identity and platform key stores: [QualiaDeviceIdentityKit](/en/repos/qualia-dik/)
- QR and LAN implementation: [QualiaTransport](/en/repos/qualia-transport/)
- Auth-bound wrapping: [QualiaBioAuth](/en/repos/qualia-bioauth/)

## Licence

LGPL-3.0-or-later; see `LICENSE` and `COPYING.LESSER` in the repository.
