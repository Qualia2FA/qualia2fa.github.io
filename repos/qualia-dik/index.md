# 设备身份 QualiaDeviceIdentityKit

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

设备身份工具箱：**P-256 设备身份原语**，加上**平台原生的硬件密钥库**。

该库把「在设备硬件里生成一个 ECDSA P-256 密钥、取回公钥、让硬件对消息签名」封装成安全的 Rust 接口，同时提供**公钥侧**的表示、指纹与验签——让上层不必接触任何平台原生 API，也不必自己实现一遍曲线运算。

私钥**永不离开硬件**，也永不进入本进程的地址空间。

## 两半，一个概念

| 模块 | 做什么 | 持私钥吗 |
|---|---|---|
| `device` | 公钥表示、设备指纹（`DeviceId`）、验签 | 否 |
| `keystore` | 生成密钥、取公钥、对消息签名、存放应用主密钥 | 是（在硬件里） |

两者共用同一个错误类型。分开的原因很实际：**一台设备必须能验证别人的签名，而它自己可能根本不持有任何硬件密钥**（没有 TPM 的桌面机就是这样）。

```rust
use qualia_dik::{DeviceKeyStore, device};

let signer = store.open_or_create("account-1")?;

// 公钥不是秘密，可以随意传播。
println!("device id: {}", signer.public_key().device_id());

let message = b"a message to sign";
let signature = signer.sign(message)?;

// 验签不需要密钥库，也不需要私钥。
device::verify(signer.public_key(), message, &signature)?;
```

## 平台支持

| 平台 | 设备身份密钥 | 主密钥：直接 | 主密钥：包裹 |
|---|---|---|---|
| Windows | CNG `NCrypt*` + TPM 2.0；没有 TPM 时用 CNG 软件库 | 软件密钥库 | 有 TPM 时用 TPM，否则软件密钥库 |
| Android | Keystore / StrongBox | 已实现，报告 Keystore 对该条目的说法 | 已实现，优先 StrongBox |
| macOS / iOS / Linux | 尚未实现，返回 `UnsupportedPlatform` | `UnsupportedPlatform` | `UnsupportedPlatform` |

`DeviceKeyStore::backend` 报告某份密钥库**运行时**实际使用的后端。在没有 TPM 的 Windows 机器上它会返回 `Backend::Software`——私钥以软件形式保存，只受操作系统用户账户保护。**本层不会静默降级**：未实现的平台返回 `UnsupportedPlatform`，是否接受软件密钥由调用方（也就是用户）决定。

::: tip Windows 上为什么「直接」形式落在软件库
Microsoft Platform Crypto Provider 会接受写入的密钥、然后拒绝把材料导出（`NTE_PERM`）。一个拿不回材料的库不满足「直接」的契约，所以它如实报告 `Backend::Software`；想要 TPM 保护请选**包裹**形式。
:::

## 主密钥的两种存法

平台密钥库除了设备身份密钥，还持有**应用的主密钥**——保险库文件就是用它加密的。主密钥是 `MasterKey` 里 32 字节的不透明材料：本 crate 只把它在调用方与平台之间搬运，不从中派生任何东西。有两种存法，**由调用方选哪个类型决定**，不是运行期开关：

| 形式 | 契约 | 平台库里放什么 | 调用方要持久化什么 |
|---|---|---|---|
| 直接 | `DirectMasterKeyStore` | 主密钥材料本身 | 什么都不用 |
| 包裹 | `WrappedMasterKeyStore` | 一把**不可导出**的 KEK | 返回的包裹字节 |

```rust
use qualia_dik::{
    DirectMasterKeyStore, MasterKey, MockDirectMasterKeyStore, MockWrappedMasterKeyStore,
    WrappedMasterKeyStore,
};

let key = MasterKey::from_bytes([0x2A; qualia_dik::MASTER_KEY_LEN]);

// 直接：库持有材料，调用方不持久化任何东西。
let direct = MockDirectMasterKeyStore::new();
direct.store("account-1", &key)?;
let loaded = direct.load("account-1")?;

// 包裹：库持有 KEK，调用方把返回的字节与保险库存在一起。
let wrapped_store = MockWrappedMasterKeyStore::new();
let blob = wrapped_store.store("account-1", &key)?;
let loaded_again = wrapped_store.load("account-1", &blob)?;
```

真实平台上把两个 `Mock*` 换成 `PlatformDirectMasterKeyStore` / `PlatformWrappedMasterKeyStore` 即可。

KEK 的加解密**不出现在任何接口里**：没有 wrap / unwrap / encrypt / decrypt，也没有任何方法能拿到那把密钥——包裹是这一形式的内部设计。两种形式都通过 `backend()` 如实报告实际生效的后端。

## 安装与接入

```toml
[dependencies]
qualia-dik = "0.1"
```

要在自己的测试里使用内存后端（例如在没有 TPM 的 CI 上测试协议逻辑）：

```toml
[dev-dependencies]
qualia-dik = { version = "0.1", features = ["mock"] }
```

```rust
use qualia_dik::{DeviceKeyStore, MockKeyStore};

let store = MockKeyStore::new();
let signer = store.create("test-device")?;
```

`mock` 后端的「硬件」是一个 `HashMap`，且**不做持久化**。它只用于测试：任何在生产路径上使用它的代码，都会在重启后立刻暴露（密钥不见了），而不是带着一份没有硬件保护的密钥一直跑下去。

## 接口约定

- **`label` 是身份的持久名字**，只允许 ASCII 字母、数字、`-`、`_`、`.`。它会被放进系统密钥库的命名空间，因此不允许空字符之类的字符——`"a\0b"` 与 `"a"` 在 C 字符串看来是同一个名字，那会让两个不同的身份撞在一起。
- **`create` 不覆盖已有密钥**，已存在时返回 `KeyAlreadyExists`。想表达「有则打开、无则创建」请用 `open_or_create`。
- **`delete` 是不可逆的**：那台设备将永久无法再证明自己是原来的那台设备，对方设备上记录的它会变成无法验证的孤儿。调用前请取得用户确认。
- **`sign` 收消息，`sign_digest` 收摘要。** 签名与验签必须对「谁负责哈希」有唯一答案，所以消息模式固定使用 SHA-256；`device::verify` 遵循同一约定。
- **签名算法固定 ECDSA P-256。** 这不是偏好而是硬约束：Android KeyMint 没有 EdDSA，Apple 的 Secure Enclave 只支持 NIST P-256。

## 安全边界

本 crate 是整个项目里**唯一允许出现 `unsafe` 的地方**，也是唯一接触平台原生 API 的地方。它存在的原因就是让上层能保住 `#![forbid(unsafe_code)]`。因此**不要**把协议逻辑、密码学原语或任何能用纯 Rust 表达的东西放进来。

- 每个 `unsafe` 块都要有 `// SAFETY:` 说明，写清为什么这里的不变式成立。
- 任何输入都不得导致 panic。
- 错误里不得出现秘密材料。
- **不得静默降级到软件密钥。** 那会让用户以为自己受硬件保护，而实际不是。
- 新增平台后端时，请同时把它加进 `platform_backend_is_implemented`，并在平台表里登记。

## 构建与测试

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets                    # 含打真 TPM 的集成测试
cargo test --doc --features mock            # 文档示例只在 mock 下有后端可用
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo check --features mock
cargo deny check
```

非 Windows 的代码在 Windows 上永远看不到，但 Linux CI 会看到。本机可以用已安装的交叉目标提前验证：

```bash
cargo clippy --target x86_64-unknown-linux-gnu --lib -- -D warnings
cargo check  --target aarch64-linux-android --lib
```

## 发布

打一个 `v*` 标签会触发发布流程。它先在 Windows / Linux / macOS 三个平台上各跑一次 `cargo publish --dry-run`，确认打包结果无误后才真正发布。`workflow_dispatch` 只验证、不发布。

发布是不可撤销的：crates.io 上一个版本号一旦占位就永久存在。因此发布挂在**标签**上，不挂在 push 到 master 上。

## 相关仓库

- 使用它的核心库：[Qualia2FA-Core](/repos/core/)
- 把它暴露给 Kotlin / Swift：[Qualia2FA-FFI](/repos/ffi/)
- 平台认证包裹：[QualiaBioAuth](/repos/qualia-bioauth/)

## 许可证

LGPL-3.0-or-later，见仓库里的 `LICENSE` 与 `COPYING.LESSER`。选择 LGPL 而非 MIT / Apache 是刻意的：本 crate 处理的是设备身份的私钥，任何修改都应当以源码形式回馈，以便被审计。
