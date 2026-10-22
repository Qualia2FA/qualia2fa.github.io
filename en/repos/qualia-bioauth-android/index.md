# Android auth QualiaBioAuth-Android

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">com.qiushui1012.lib:qualia-bioauth-android</span>
    <span class="q-pill q-pill--version">v0.1.0</span>
    <span class="q-pill">Android 26+</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/QualiaBioAuth-Android">GitHub</a>
    <a href="https://github.com/Qualia2FA/QualiaBioAuth-Android/releases">Releases</a>
  </div>
</div>

The Android half of [`qualia-bioauth`](/en/repos/qualia-bioauth/): it seals a 32-byte key behind the device's own user authentication, using the Android Keystore and `BiometricPrompt`.

The Rust crate owns the blob format and the error taxonomy; this library owns the platform calls. Neither knows anything about Qualia2FA.

## Usage

```kotlin
// availability / seal / unseal are suspend; call them from a coroutine or a worker thread.
val sealer = KeystoreBiometricSealer(activity)

lifecycleScope.launch {
    when (val available = sealer.availability()) {
        is Availability.Available -> { /* offer the biometric path */ }
        is Availability.Unavailable -> { /* mechanism exists, this user cannot use it */ }
        is Availability.Unsupported -> { /* API level too low; password only */ }
    }

    // Seal: prompts once, returns the bytes to persist.
    val envelope = sealer.seal(masterKey)

    // Unseal: prompts once, returns the same key or throws.
    val restored = sealer.unseal(envelope)

    // Turning the path off deletes the platform key; the envelope becomes dead.
    sealer.delete()
}
```

The library never sees the key material that protects the envelope: the Keystore key is created with `setUserAuthenticationRequired(true)`, so the platform itself refuses to use it until the user has authenticated.

## Interface

The full declarations live in the repository sources and the generated Dokka documentation.

### `BiometricSealer`

| Member | Notes |
|---|---|
| `suspend fun availability(): Availability` | Report whether this device can use the path, without prompting |
| `suspend fun seal(plaintext: ByteArray): ByteArray` | Prompt once and return the envelope to persist |
| `suspend fun unseal(envelope: ByteArray): ByteArray` | Prompt once and return the same plaintext |
| `fun delete()` | Delete the platform key; existing envelopes become dead |

### `KeystoreBiometricSealer`

```kotlin
class KeystoreBiometricSealer(
    activity: FragmentActivity,
    alias: String = DEFAULT_ALIAS,
    promptInfo: PromptText = PromptText(),
) : BiometricSealer
```

| Item | Notes |
|---|---|
| `activity` | Host of `BiometricPrompt`; construct per screen, do not keep it alive |
| `alias` | The Keystore entry name; the default suits a single account |
| `promptInfo` | Title, subtitle and cancel label of the system prompt |
| `PromptText(title, subtitle, cancel)` | Filled by the caller in the current interface language |

### `Availability`

| Variant | Meaning |
|---|---|
| `Available(backend: String, hardwareBacked: Boolean)` | The mechanism works; `backend` is what actually answered |
| `Unavailable(reason: String)` | The mechanism exists, but this device or user cannot use it now |
| `Unsupported(reason: String)` | The API level is too low or no mechanism exists; password only |

### Exceptions

`BiometricAuthException` is a sealed class thrown by `seal` / `unseal`:

| Subclass | Meaning |
|---|---|
| `Cancelled` | The user dismissed the system prompt |
| `Unavailable` | The platform mechanism is temporarily unavailable |
| `Unsupported` | This build or API level cannot do it |
| `EnvelopeInvalid` | The envelope is corrupt or was not written by this library |

### Contracts

- `availability()` does not prompt; `seal` / `unseal` do. Ask availability before offering the path.
- A new biometric enrolment invalidates the Keystore key, so the envelope stops opening; fall back to the password rather than recreating the key over it.
- When the platform cannot authenticate there is **no fallback to a software key**.
- The library does no I/O: the envelope is returned for the caller to persist.
- No input may panic; errors contain no key or envelope bytes.

## What it guarantees, and what it does not

- **Guaranteed**: the envelope cannot be opened without a fresh user authentication on this device; a new biometric enrolment invalidates the key, so the envelope stops opening instead of silently accepting the new finger.
- **Not guaranteed**: protection against an attacker running code as this user while the vault is unlocked. No biometric scheme provides that.
- **No fallback to a software key.** If the platform cannot authenticate, `availability()` says so and the caller keeps its password path.

::: tip Prompt wording
The system prompt text of `KeystoreBiometricSealer` can be supplied by the caller. An application should pass the current interface language rather than relying on the library's default English wording.
:::

## Requirements

- Android 26+; the biometric path itself needs 28 or newer and reports `Unsupported` below that.
- A screen lock and at least one enrolled biometric.
- `FragmentActivity`: `BiometricPrompt` is its own window, so it needs an Activity to attach to. Construct the sealer per screen rather than holding it for the process lifetime.

## Integrating

```kotlin
dependencies {
    implementation("com.qiushui1012.lib:qualia-bioauth-android:0.1.0")
}
```

## Build and test

Needs JDK 17 and the Android SDK:

```bash
./gradlew :library:testDebugUnitTest --console=plain
./gradlew :library:assembleRelease --console=plain
./gradlew :library:publishReleasePublicationToMavenLocal --console=plain
```

Publishing hangs on a `v*` tag; the tag must match the version in `library/build.gradle.kts` or the workflow stops first. A version on Maven Central exists forever once published.

## Related repositories

- The Rust outer format and Windows backend: [QualiaBioAuth](/en/repos/qualia-bioauth/)
- The application using it: [Qualia2FA](/en/repos/qualia2fa/)

## Licence

LGPL-3.0-or-later; see `LICENSE` and `NOTICE` in the repository.
