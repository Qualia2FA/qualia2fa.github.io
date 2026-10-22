# Install and build

## Installing the application

Every version is published on the [Qualia2FA Releases](https://github.com/Qualia2FA/Qualia2FA/releases) page.

| Platform | Artifacts | Notes |
|---|---|---|
| Windows 10 / 11 (x64) | `.msi` and `.exe` offline installers | Signed, but with a self-signed certificate, so Windows warns about an unknown publisher |
| Android 8.0 and above (64-bit ARM) | `.apk` | Signed with the project's release key, installable as it is |

Android currently ships only `arm64-v8a`, and Windows only `x86_64`. After installing, no account and no network are needed.

The camera permission is requested only when a scan is needed; declining it still leaves the option to scan an image of a QR code. The local network permission is used only for pairing or syncing. The application requests no background permissions and does not sync in the background.

### First run

1. **Register or log in.** The first device registers and generates the master key locally. Other devices log in by scanning the QR code shown by a signed-in device; both devices must be present, and the signed-in one must be confirmed first.
2. **Set the unlock password.** Since 0.4.0, opening the application costs the password or one system gesture. The password is always the way back in: a deleted credential or a new fingerprint or face still leaves it usable.
3. **Add entries.** Scan an `otpauth://` QR code, read one from an image, type it manually, or import an Aegis JSON / HTML / TXT export (encrypted exports included).
4. **Share or sync.** Use QR codes when the devices are close, or the LAN channel when they are on the same subnet. One sync carries one direction at a time; each side shows one code.

::: tip Losing the master key means losing the data
With no server there is no recovery flow. Export a recovery key from the settings and keep it safe; the file is protected by a passphrase, which must not be lost either.
:::

## Building the application from source

Building needs **JDK 21** and a **Rust toolchain** (MSVC on Windows). Building the Android package also needs the Android SDK.

```bash
git clone https://github.com/Qualia2FA/Qualia2FA
cd Qualia2FA

./gradlew :composeApp:jvmTest          # compile and run unit tests, including the Rust round trip
./gradlew :composeApp:run              # start the desktop application
./gradlew :composeApp:packageMsi       # package the MSI (jlink + jpackage)
./gradlew :composeApp:assembleRelease  # Android release package, signed and installable
```

The Android artifact is under `composeApp/build/outputs/apk/release/`:

```bash
adb install -r composeApp/build/outputs/apk/release/composeApp-release.apk
```

::: warning Check the interface with a release build
Android refuses to optimise a `debuggable` application, so a debug build is inherently several times slower. Use `assembleRelease` to judge smoothness, not `assembleDebug`.
:::

The application builds the **published** `qualia2fa-ffi`: at configuration time the source is downloaded from crates.io, checked against the SHA-256 in the registry and unpacked into the git-ignored `composeApp/rust/`. Changing the version requires changing `ffiCrateSha256` as well; changing only the version number fails at the checksum.

To build against a local FFI change, point at the sibling directory temporarily:

```bash
./gradlew :composeApp:run -Pqualia2fa.ffi.localDir=../FFI
```

## Building the libraries

Each repository is built from its own root; none is connected through a submodule or a path dependency.

### Qualia2FA-Core

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo deny check
```

Fuzzing needs nightly and cargo-fuzz:

```bash
cd fuzz
cargo +nightly fuzz run uri_parse -- -max_total_time=300
cargo +nightly fuzz run vault_parse -- -max_total_time=300
cargo +nightly fuzz run login_handshake -- -max_total_time=300
```

### Qualia2FA-FFI

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

Generating Kotlin / Swift bindings:

```bash
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/qualia2fa_ffi.dll \
    --language kotlin --out-dir ./bindings
```

### QualiaDeviceIdentityKit

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets                        # including the real-TPM integration tests
cargo test --doc --features mock                # the doc examples need a backend, which mock provides
cargo check --features mock
cargo deny check
```

### QualiaTransport

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
cargo test --no-default-features --all-targets
cargo test --features iroh-lan
cargo deny check
```

### QualiaBioAuth

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --features mock -- -D warnings
cargo test --all-targets --features mock
cargo test --doc --features mock
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo deny check
```

### QualiaBioAuth-Android

Needs JDK 17 and the Android SDK:

```bash
./gradlew :library:testDebugUnitTest --console=plain
./gradlew :library:assembleRelease --console=plain
./gradlew :library:publishReleasePublicationToMavenLocal --console=plain
```

## Using a library as a dependency

All four Rust libraries are published on crates.io:

```toml
[dependencies]
qualia2fa-core = "0.4"
qualia-dik = "0.1"
qualia-transport = "0.1"
qualia-bioauth = "0.1"
```

`qualia2fa-ffi` produces a `cdylib` and a `staticlib`, with no `rlib` for another Rust target to link against. A host should build the dynamic library and generate bindings rather than treating it as an ordinary Rust dependency:

```bash
cd FFI
cargo build --release
cargo run --bin uniffi-bindgen -- generate \
    --library target/release/qualia2fa_ffi.dll \
    --language kotlin --out-dir ./bindings
```

The bindings are generated by the same UniFFI version that compiled the library. Do not use a globally installed `uniffi-bindgen`: the two sides drift apart and produce bindings that compile but do not match at run time.

On Android the auth-bound library comes from Maven Central:

```kotlin
dependencies {
    implementation("com.qiushui1012.lib:qualia-bioauth-android:0.1.0")
}
```

## Language selection on this site

This site shows Simplified Chinese by default, with English under `/en/`. On the first visit the browser languages (`navigator.languages`) choose a locale; once a language has been chosen manually, the choice is remembered locally and automatic redirects stop.

The switcher at the top right (inside the menu on mobile) offers three options:

- **简体中文** / **English**: remember the choice and switch.
- **Follow browser language**: forget the saved choice and decide from the browser languages again.
