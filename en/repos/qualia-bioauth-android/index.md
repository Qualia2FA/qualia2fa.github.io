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
val sealer = KeystoreBiometricSealer(activity)

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
```

The library never sees the key material that protects the envelope: the Keystore key is created with `setUserAuthenticationRequired(true)`, so the platform itself refuses to use it until the user has authenticated.

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
