# Core Qualia2FA-Core

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">crate qualia2fa-core</span>
    <span class="q-pill q-pill--version">v0.4.1</span>
    <span class="q-pill">Rust 1.89+</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/Qualia2FA-Core">GitHub</a>
    <a href="https://crates.io/crates/qualia2fa-core">crates.io</a>
    <a href="https://docs.rs/qualia2fa-core">docs.rs</a>
  </div>
</div>

The core library of Qualia2FA, carrying all of the logic: code computation, URI parsing, the encrypted vault, device pairing and sync merging.

It **deliberately has no interface or command-line entry point**, and performs no I/O and no clock reads, so that Windows, Android and other platforms can reuse it as independent projects.

## Capabilities

| Feature | Description |
|---|---|
| 2FA codes | HOTP (RFC 4226), TOTP (RFC 6238), mOTP, Yandex OTP, Steam Guard |
| Base32 | RFC 4648, lenient and strict modes |
| URIs | Parsing and serialising `otpauth://` and Aegis `motp:` |
| Vault | Per-entry encrypted local format, tree groups, entry icons, tombstones |
| Import | Aegis JSON / HTML / TXT exports, encrypted exports included |
| Export | `.q2fa` containers (plain / encrypted) and four external formats |
| Unlock password | Fixed-size wrap using Argon2id and XChaCha20-Poly1305 |
| Recovery key | Passphrase-encrypted recovery file (`.q2fa`) |
| Pairing | QR-code login and challenge-response |
| Sync | Generation, merging and conflict reporting for encrypted payloads |

## Install

```toml
[dependencies]
qualia2fa-core = "0.4"
```

## Quick start

### Compute a code

```rust
use qualia2fa_core::otp::{self, Algorithm, Digits, OtpSecret};

let secret = OtpSecret::from_base32("JBSWY3DPEHPK3PXP")?;
// The current time comes from the caller; this library never reads a clock.
let code = otp::totp_code(&secret, 1_700_000_000, 30, Algorithm::Sha1, Digits::SIX)?;
assert_eq!(code.len(), 6);
```

### Parse an `otpauth://` URI

```rust
use qualia2fa_core::uri;

let entry = uri::parse(
    "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
)?;
assert_eq!(entry.issuer.as_deref(), Some("GitHub"));
assert_eq!(entry.account, "alice");
```

### Verify with drift tolerance

```rust
use qualia2fa_core::otp;

// Returns the offset step that matched (0 = current, -1 = one step behind)
// rather than a boolean, so the caller can calibrate the entry's clock drift.
// The comparison is constant-time.
let offset = otp::verify_with_drift(&secret, counter, 1, algorithm, digits, &user_input);
```

### The encrypted vault

Once an `otpauth://` configuration is stored in the vault it becomes a **per-entry encrypted** record: each has its own random 128-bit ID and XChaCha20-Poly1305 ciphertext, and the file carries no plaintext semantics apart from those IDs — not even "TOTP or HOTP".

```rust
use qualia2fa_core::vault::{self, VaultFile};

let parsed = qualia2fa_core::uri::parse(
    "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
)?;
let entry = vault::entry_from_parsed_uri(&parsed, now)?;

let mut file = VaultFile::create()?;              // generates a fresh random master key
let id = file.vault_mut().insert(entry)?;

let bytes = file.serialize()?;
vault::write_file_atomically(std::path::Path::new("vault.q2fa"), &bytes)?;
```

Reading it back needs the **master key** — the file does not contain it, only a check value derived from it (32 bytes since format version 2, able to answer "is this the key" and nothing more):

```rust
use qualia2fa_core::vault;

let master: vault::MasterKey = master_key_from_platform_store()?;
let file = vault::read_file(master, std::path::Path::new("vault.q2fa"))?;
for (id, entry) in file.vault().iter() {
    println!("{id} {}", entry.name);
}
```

Things worth knowing:

- **A lost master key means permanently unreadable data.** With no server and no account password there is no recovery route.
- **An attacker can rewrite the file freely.** Changing any byte makes decryption fail rather than quietly yielding tampered data.
- **Write with `write_file_atomically`.** A plain `fs::write` interrupted by a power cut can leave a truncated file.
- **Deletion leaves a tombstone** (also encrypted, carrying only an ID and a timestamp), so that "another device still has this entry" can be adjudicated. Tombstones never expire and are 45 bytes each.
- Ciphertext length leaks the **length** of notes and account names. This is a known and deliberate trade-off.

### Unlock password

The master key normally lives in the platform key store, where reading it costs the user nothing. To require authentication before a vault can be opened, store a second copy of the master key as a wrap that **only the passphrase opens**, next to the vault:

```rust
use qualia2fa_core::{KdfParams, SecretString, lock};

let password = SecretString::from("the unlock password".to_owned());

// Write: Argon2id derivation + XChaCha20-Poly1305, written to master.key.pw.
let wrap = lock::wrap(&master_key, &password, &KdfParams::recommended())?;
std::fs::write("master.key.pw", &wrap)?;

// Read: a wrong passphrase is a wrong passphrase, not "a different key".
let recovered = lock::unwrap(&wrap, &password)?;
```

The wrap file is a fixed 110 bytes and carries its own KDF parameters and random salt, so old files remain readable forever. The parameters come from the file and are untrusted input, so **bounds checks happen before Argon2id runs**. A wrong passphrase, out-of-range parameters and an unknown version are three distinct errors.

## Interface

Public APIs are grouped into modules, with the main types re-exported at the crate root; full signatures, examples and platform notes live on [docs.rs](https://docs.rs/qualia2fa-core).

### Modules and entry points

| Module | Main public items | Responsibility |
|---|---|---|
| `otp` | `Algorithm`, `Digits`, `OtpSecret`, `hotp`, `totp`, `hotp_code`, `totp_code`, `verify_code`, `verify_with_drift`, `steam_guard_code` | TOTP / HOTP / Steam Guard |
| `motp` | `MotpPin`, `motp_code` | mOTP |
| `yaotp` | `YandexPin`, `normalize_secret`, `yaotp_code` | Yandex OTP |
| `base32` | `encode`, `decode`, `decode_strict` | RFC 4648 encoding and two decoding modes |
| `uri` | `OtpAuth`, `UriType`, `parse`, `serialize`, `DEFAULT_PERIOD` | `otpauth://` and `motp:` |
| `vault` | `Vault`, `VaultFile`, `Entry`, `EntryKind`, `EntryIcon`, `Group`, `GroupChild`, `EntryId`, `GroupId`, `Tombstone`, `MasterKey` | In-memory vault and file format |
| `lock` | `wrap`, `unwrap`, `WrapHeader`, `FILE_LEN` | Unlock-password wrap |
| `recovery` | `KdfParams`, `export`, `import` | Recovery-key file |
| `portable` | `PortableKind`, `PortableFile`, `detect`, `parse`, `pack_plain`, `pack_encrypted` | `.q2fa` portable containers |
| `import` | `ImportFormat`, `import`, `ImportReport`, `ImportedEntry`, `ImportProblem`, `apply::compare`, `apply::apply` | Aegis JSON / HTML / TXT import |
| `export` | `ExportFormat`, `GroupCarrying`, `export` | Six export formats |
| `flow` | `DeviceKeys`, `SecureStore`, `registration`, `Login`, `Joiner`, `Registered`, `open_vault`, `open_portable` | Registration, login and recovery orchestration |
| `pairing` | `QrPayload`, `PendingSession`, `JoinerSession`, `Adoption`, `NonceLog`, `begin`, `join` | Pairing messages and state machines |
| `auth` | `Verifier`, `Responder`, `Verified`, `begin`, `accept`, `confirm` | Challenge-response |
| `sync` | `Payload`, `PayloadHeader`, `PayloadKind`, `Record`, `SyncId`, `derive_record_key`, `derive_envelope_key` | Sync payloads and merging |
| `transport` | `Transport`, `TransportCapabilities`, `Recipient`, `Roster`, `SyncSession`, `SyncOutcome`, `SharePlan` | Channel abstraction and sessions |
| Root exports | `SecretBytes`, `SecretString`, `SecretBox`, `ExposeSecret`, `ExposeSecretMut` | `secrecy` types (the `secret` module itself is private) |

### The vault

| Area | API | Notes |
|---|---|---|
| Read | `Vault::len` / `is_empty` / `tombstone_count` / `iter` / `get` / `get_tombstone` | Live entries and tombstones are read separately |
| Entries | `Vault::insert` / `insert_with_id` / `replace` / `remove` / `record_tombstone` / `forget_tombstone` | `remove` leaves a tombstone; `record_tombstone` stores a peer's tombstone |
| Groups | `Vault::groups` / `group` / `children_of` / `parent_of` / `depth_of` / `top_group` / `ordering` / `group_of` / `entries_in` | Tree groups and mixed child order |
| Group editing | `create_group` / `create_group_in` / `rename_group` / `remove_group` / `set_children` / `set_ordering` / `assign_to_group` | `set_children` writes a whole child list |
| Files | `VaultFile::create` / `with_master_key` / `master_key` / `vault` / `vault_mut` / `split_mut` / `serialize` / `parse` / `into_parts` | Binds the master key to the vault |
| Convenience | `entry_from_parsed_uri`, `write_file_atomically`, `read_file` | Build from a URI, atomic write, file read |

`Vault::remove` returns the removed entry and leaves a tombstone; `replace` keeps the entry ID and leaves none. **Never** implement an edit as "delete + add".

### Registration and login

| API | Notes |
|---|---|
| `DeviceKeys::get_or_create(label)` / `sign(label, message)` | Implemented by the host; the identity must be retrievable repeatedly and persisted immediately |
| `SecureStore::load_master_key` / `store_master_key` / `delete_master_key` / `is_hardware_backed` | Master-key persistence; `Ok(None)` and `Err` mean different things |
| `registration(keys, store, label)` → `Registered` | Generate the master key, obtain the device identity, write to the platform store |
| `Login::new()` / `payload()` / `authorize(msg1, master)` | A signed-in device starts a login and authorises it |
| `Joiner::from_base32(text, label)` / `request(keys)` / `complete(msg2, keys, store)` | A new device scans, requests and completes |
| `open_vault(store, data)` | Open a vault with the master key in storage |
| `master_key_from_bytes` / `master_key_to_bytes` | Convert between master-key bytes and `MasterKey` |
| `open_portable(file, passphrase, store)` → `PortableRestore` | Open a `.q2fa` container |
| `export_recovery_key` / `import_recovery_key` | Export and import a recovery key |

### Codes and URIs

| API | Notes |
|---|---|
| `otp::totp_code(secret, unix_time, period, algorithm, digits)` / `hotp_code(secret, counter, algorithm, digits)` | Compute a code; time is `u64` Unix seconds |
| `otp::verify_code(expected, provided)` / `verify_with_drift(...)` | Constant-time comparison; the latter returns the matching offset |
| `otp::steam_guard_code(secret, unix_time)` | Steam Guard's 5-character alphabet |
| `uri::parse(input)` / `uri::serialize(auth)` | Parse and serialise `otpauth://` and `motp:` |
| `base32::decode_strict(input)` | Strict Base32; use `decode` for the lenient mode |

### Sync and sessions

| API | Notes |
|---|---|
| `Payload::from_vault(master, sender, vault)` | Build a full payload from the local vault |
| `Payload::request(sender)` | Build a "send me your state" request payload |
| `Payload::peek(data)` | Read the plaintext header for the replay log; authenticates nothing |
| `Payload::seal(master)` / `Payload::open(master, data)` | Encrypt and decrypt a payload |
| `Payload::open_records(master)` | Decrypt record by record into `OpenedRecord` |
| `SyncSession::open(master, vault, seen)` / `restricted(...)` | Open a session; `seen` is the cross-session replay log |
| `SyncSession::send` / `receive` / `plan_share` | Send, merge, or decide whether it fits first |
| `Transport::capabilities` / `local_device` / `send` / `receive` / `peers` | The channel contract implemented by hosts and the LAN channel |

### Errors and contracts

- Every fallible API returns `Result<T, Error>`; `Error` is `#[non_exhaustive]`, so code outside the crate must keep a wildcard arm.
- An error never carries secret material: no original input, key bytes or OTP codes.
- No input may panic; the only failure mode is an `Error`.
- `SecureStore::load_master_key` returning `Ok(None)` means "never registered or logged in"; `Err` means "something was stored but cannot be read". Conflating them sends the user to re-register and lose data permanently.
- `DeviceKeys::get_or_create` must be idempotent and **persist immediately**: the login request and reply can be far apart, and an identity that lives only in memory is lost forever when the process exits.

## Design contracts

### No I/O, no clock

The library does not touch the filesystem, the network or environment variables, and does not read the system clock. **Time is always passed in by the caller as `u64` Unix seconds.** This is not fastidiousness: only when time is a parameter can the RFC 6238 test vectors be verified deterministically.

Randomness comes only from `getrandom` (the OS CSPRNG), never from a user-space PRNG. The core re-exports `getrandom` so that upper layers draw from the same CSPRNG.

The only file I/O is two optional convenience functions: `write_file_atomically` and `read_file`. Neither the FFI layer nor a host uses them; "no I/O in the core" means the logic layer does not depend on I/O.

### Never panic

Every public function returns a `Result` with a typed error. No input may cause a panic — including malicious QR codes, clipboard contents and hand-typed links. Error types **never carry secret material**: no original input, no key bytes, no OTP codes.

### Secret material

Every secret inside the library (OTP seeds, the vault master key, session keys) is carried in [`secrecy`](https://crates.io/crates/secrecy) types, **never a bare `Vec<u8>` / `String`**:

| Purpose | Type |
|---|---|
| Arbitrary byte secrets (seeds, keys, nonces) | `SecretBytes` (= `SecretSlice<u8>`) |
| Text secrets (passphrases, recovery phrases) | `SecretString` |
| Fixed-size or other secrets | `SecretBox` |
| Access the plaintext | `ExposeSecret` / `ExposeSecretMut` |

All of these types are re-exported, so callers need not depend on `secrecy` directly. Note that `secrecy`'s `Debug` does not even print the length, and that it implements `CloneableSecret` only for primitive integers; byte secrets therefore use the cloneable `SecretSlice<u8>`.

## Compatibility

**Vault file format: 4.** This version always writes 4 and still reads versions 1–3 (the readable set only grows). A version 4 group record is a name plus an ordered child list, and an entry may carry an icon. An older application reading a version 4 file gets a clear "unsupported version" error; the one exception is the version 1 parser, which reports trailing bytes (it sees the 32-byte master key check value as extra content).

**Sync payload version: 4.** A payload accepts only the current version, so two devices with different payload versions cannot sync; upgrade every device together. The version sits in the plaintext header and is readable without a key, so the failure is a version error, not an authentication failure.

## Tests and fuzzing

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps      # no broken doc links
cargo deny check
```

The `otpauth://` parser, Base32 decoding and vault file parsing are all **attacker-controlled** input surfaces, and changing them requires fuzzing:

```bash
cd fuzz
cargo +nightly fuzz run uri_parse -- -max_total_time=300
cargo +nightly fuzz run vault_parse -- -max_total_time=300
cargo +nightly fuzz run login_handshake -- -max_total_time=300
```

Fuzz targets must be built with `cargo fuzz`, not `cargo build`: the entry point generated by `fuzz_target!` depends on linker arguments that cargo-fuzz injects.

## Related repositories

- Host bindings: [Qualia2FA-FFI](/en/repos/ffi/)
- Platform key stores and device identity: [QualiaDeviceIdentityKit](/en/repos/qualia-dik/)
- Transport channels: [QualiaTransport](/en/repos/qualia-transport/)

## Licence

LGPL-3.0-or-later. The full text is in `LICENSE` and `COPYING.LESSER` in the repository.
