# Android 认证 QualiaBioAuth-Android

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

[`qualia-bioauth`](/repos/qualia-bioauth/) 的 Android 一半：用 Android Keystore 与 `BiometricPrompt`，把一把 32 字节密钥锁在设备自身的用户认证之后。

Rust crate 管 blob 格式与错误分类，这个库管平台调用；两边都不知道 Qualia2FA 的存在。

## 用法

```kotlin
val sealer = KeystoreBiometricSealer(activity)

when (val available = sealer.availability()) {
    is Availability.Available -> { /* 可以提供生物识别入口 */ }
    is Availability.Unavailable -> { /* 机制存在，但这个用户当前用不了 */ }
    is Availability.Unsupported -> { /* API 太低，只能走口令 */ }
}

// 封印：弹一次认证，返回要持久化的字节。
val envelope = sealer.seal(masterKey)

// 解封：弹一次认证，返回同一把密钥，或抛异常。
val restored = sealer.unseal(envelope)

// 关闭这条路径会删除平台密钥，之前写下的 envelope 随之作废。
sealer.delete()
```

库本身看不到保护 envelope 的那把密钥：Keystore 密钥以 `setUserAuthenticationRequired(true)` 创建，在用户完成认证之前，平台自己就拒绝使用它。

## 它保证什么，不保证什么

- **保证**：没有本设备上的一次新的用户认证，envelope 打不开；新录入生物识别会让密钥失效，于是 envelope 停止打开，而不是悄悄接受新指纹。
- **不保证**：保险库已解锁时，能防住以该用户身份运行代码的攻击者。任何生物识别方案都做不到。
- **不会**退回软件密钥。平台无法认证时 `availability()` 如实报告，调用方保留口令路径。

::: tip 提示文案
`KeystoreBiometricSealer` 的系统弹窗文案可以由调用方传入。应用应当把当前界面语言写进去，而不是依赖库里的默认英文。
:::

## 要求

- Android 26+；生物识别路径本身需要 28 或更高，更低版本报 `Unsupported`。
- 设备已设屏幕锁，且至少录入一种生物识别。
- `FragmentActivity`：`BiometricPrompt` 是独立窗口，需要 Activity 承载。请按界面构造 sealer，不要让它活过整个进程。

## 接入

```kotlin
dependencies {
    implementation("com.qiushui1012.lib:qualia-bioauth-android:0.1.0")
}
```

## 构建与测试

需要 JDK 17 与 Android SDK：

```bash
./gradlew :library:testDebugUnitTest --console=plain
./gradlew :library:assembleRelease --console=plain
./gradlew :library:publishReleasePublicationToMavenLocal --console=plain
```

发布挂在 `v*` 标签上；标签号与 `library/build.gradle.kts` 里的版本必须一致，否则发布流程会先停下。Maven Central 上一个版本号一旦发布就永久存在。

## 相关仓库

- Rust 侧的外层格式与 Windows 后端：[QualiaBioAuth](/repos/qualia-bioauth/)
- 使用它的应用：[Qualia2FA](/repos/qualia2fa/)

## 许可证

LGPL-3.0-or-later，见仓库里的 `LICENSE` 与 `NOTICE`。
