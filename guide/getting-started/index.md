# 安装与构建

## 安装应用

每个版本都发布在 [Qualia2FA Releases](https://github.com/Qualia2FA/Qualia2FA/releases) 页面。

| 平台 | 产物 | 说明 |
|---|---|---|
| Windows 10 / 11（x64） | `.msi` 与 `.exe` 离线安装器 | 带签名，但证书是自签发的，Windows 会警告「未知发布者」 |
| Android 8.0 及以上（64 位 ARM） | `.apk` | 用项目的发布密钥签名，可直接安装 |

Android 目前只提供 `arm64-v8a`，Windows 目前只提供 `x86_64`。安装后不需要账号，也不需要联网。

相机权限只在需要扫码时询问；拒绝之后仍然可以用「选一张二维码图片」的方式扫码。局域网权限只在配对或同步时使用。应用不申请后台权限，也不做后台同步。

### 第一次打开

1. **注册或登录。** 第一台设备选择注册，本地生成主密钥；其他设备选择登录，扫描已登录设备出示的二维码。登录需要两台设备都在场，并且已登录的设备要先确认。
2. **设置解锁密码。** 从 0.4.0 起，打开应用需要密码或一次系统认证。密码是永远的后路：平台凭据被删除、指纹或人脸重新录入之后，仍然可以用密码打开。
3. **添加条目。** 可以扫描 `otpauth://` 二维码、从图片识别、手动输入，或从 Aegis 的 JSON / HTML / TXT 导出导入（加密导出也可以）。
4. **分享或同步。** 两台设备距离很近时可以用二维码；在同一网段时也可以使用局域网通道。同步一次只走一个方向，两边各出一次码。

::: tip 主密钥丢失等于数据丢失
没有服务端，也就没有找回流程。请在设置里导出恢复密钥并妥善保管；恢复文件由口令加密，口令同样不能丢。
:::

## 从源码构建应用

构建需要 **JDK 21** 与 **Rust 工具链**（Windows 上是 MSVC）。打 Android 包还需要 Android SDK。

```bash
git clone https://github.com/Qualia2FA/Qualia2FA
cd Qualia2FA

./gradlew :composeApp:jvmTest          # 编译并运行单元测试，含打通 Rust 库的往返测试
./gradlew :composeApp:run              # 启动桌面应用
./gradlew :composeApp:packageMsi       # 打包 MSI（jlink + jpackage）
./gradlew :composeApp:assembleRelease  # Android 发布包，签名后可直接安装
```

Android 产物在 `composeApp/build/outputs/apk/release/`，安装命令：

```bash
adb install -r composeApp/build/outputs/apk/release/composeApp-release.apk
```

::: warning 用 release 包检查界面
Android 拒绝优化 `debuggable` 的应用，debug 构建天生慢好几倍。判断流畅度请用 `assembleRelease`，不要用 `assembleDebug`。
:::

应用构建的是**已发布的** `qualia2fa-ffi`：源码在配置阶段从 crates.io 下载，按索引里的 SHA-256 校验后解包进 git 忽略的 `composeApp/rust/`。换版本时必须同时换掉 `ffiCrateSha256`，只改版本号会在校验那一步失败。

开发时若要针对本地的 FFI 改动构建，可以临时指向兄弟目录：

```bash
./gradlew :composeApp:run -Pqualia2fa.ffi.localDir=../FFI
```

## 构建各个库

每个仓库都在自己的根目录下构建，彼此不通过 submodule 或路径依赖连接。

### Qualia2FA-Core

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo deny check
```

模糊测试需要 nightly 与 cargo-fuzz：

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

生成 Kotlin / Swift 绑定：

```bash
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/qualia2fa_ffi.dll \
    --language kotlin --out-dir ./bindings
```

### QualiaDeviceIdentityKit

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets                        # 含打真 TPM 的集成测试
cargo test --doc --features mock                # 文档示例只在 mock 下有后端可用
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

需要 JDK 17 与 Android SDK：

```bash
./gradlew :library:testDebugUnitTest --console=plain
./gradlew :library:assembleRelease --console=plain
./gradlew :library:publishReleasePublicationToMavenLocal --console=plain
```

## 作为依赖接入

四个 Rust 库都已发布到 crates.io：

```toml
[dependencies]
qualia2fa-core = "0.4"
qualia-dik = "0.1"
qualia-transport = "0.1"
qualia-bioauth = "0.1"
```

`qualia2fa-ffi` 产出 `cdylib` 与 `staticlib`，没有可供其他 Rust 目标链接的 `rlib`。端侧应当构建动态库并生成绑定，而不是把它当作普通 Rust 依赖：

```bash
cd FFI
cargo build --release
cargo run --bin uniffi-bindgen -- generate \
    --library target/release/qualia2fa_ffi.dll \
    --language kotlin --out-dir ./bindings
```

生成绑定所用的 UniFFI 版本与库编译时完全一致；不要改用全局安装的 `uniffi-bindgen`，否则两边版本漂移，产出「能编译但运行时不匹配」的绑定。

Android 上的认证包裹库通过 Maven Central 获取：

```kotlin
dependencies {
    implementation("com.qiushui1012.lib:qualia-bioauth-android:0.1.0")
}
```

## 文档站的语言选择

本站默认显示简体中文，英文页面在 `/en/` 下。首次访问时会根据浏览器语言（`navigator.languages`）自动选择；手动切换过语言之后，选择会记在本地，不再自动跳转。

导航栏右上角（移动端在菜单里）的切换器提供三个选项：

- **简体中文** / **English**：记住选择并切换。
- **跟随浏览器语言**：清除已记住的选择，重新按浏览器语言决定。
