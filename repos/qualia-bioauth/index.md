# 认证包裹 QualiaBioAuth

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

`qualia-bioauth` 是一个独立库：把一个 32 字节密钥包裹成「只有在平台完成用户认证之后才能解开」的字节，供任何需要这种保护的应用使用。它不依赖 Qualia2FA 的保险库格式、协议或核心库。

## 它解决什么问题

口令包裹能保护密钥，但口令可以被猜、被肩窥、被复用。这个库补上另一条路：让平台自己持有解包的钥匙。

| 平台 | 机制 | 状态 |
|---|---|---|
| **Windows** | Windows Hello 凭据的 `hmac-secret`（WebAuthn PRF）输出，只有完成 Hello 手势才释放 | 已实现 |
| **Android** | Keystore 中的 AES 密钥，`setUserAuthenticationRequired(true)`；解包必须用 `BiometricPrompt` 的 `CryptoObject(Cipher)` | Rust 侧计划中；Android 应用请用 [QualiaBioAuth-Android](/repos/qualia-bioauth-android/) |
| **Apple** | 为 Secure Enclave 的 `.userPresence` 预留 | 尚未实现 |
| **Linux** | 没有后端 | 如实返回 `Unsupported` |

两种包裹互相独立：任何一条成功都能解出同一把密钥，因此忘记口令或重新录入指纹不会把用户锁死；两条都不可用时失败关闭，不退回软件密钥。

::: warning 不是口令的替代品
平台可能不可用，用户可能删除 PIN 或指纹，重新录入也可能让凭据失效。**口令路径必须始终保留。**
:::

## 用法

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

真实后端的使用方式相同：

```rust
use qualia_bioauth::{AuthBoundKeyStore, platform};

let store = platform::open_best_available();
match store.availability() {
    qualia_bioauth::Availability::Available { backend, hardware_backed } => {
        // 向用户提供这条路；backend 是实际答话的后端。
    }
    qualia_bioauth::Availability::Unavailable { reason } => {
        // 机制存在，但这台机器或这个用户当前用不了。
    }
    qualia_bioauth::Availability::Unsupported { reason } => {
        // 这个构建没有该平台的后端，只能走口令。
    }
}
```

`open_best_available()` 总是返回一个值；先问 `availability()`，再决定是否向用户展示这条路。它本身不弹窗，也不接触平台。

## 外层格式

```text
magic `Q2FABIO1` (8) | version 1 (1) | backend (1) | wrapped length (4, BE) | wrapped bytes
```

平台私有载荷是不透明的，外层只负责 magic、版本、后端与长度校验。后端标识写出 blob 的平台；未知后端会被拒绝——它意味着包裹字节的布局是当前构建无法解析的。

`MasterKey` 是 32 字节、`Zeroize`，`Debug` 不打印内容。

## Windows 后端

要求平台认证器真的能在 `GetAssertion` 里返回 `hmac-secret`。attestation 里的 `bPrfEnabled` **不作为判据**：Windows 11 23H2 实测会创建凭据但把该字段留成 0。库不信任这个字段，第一次断言就是判据——返回 32 字节则成功，被拒绝或没有返回 hmac-secret 才报 `Unavailable`。

因此浏览器 PRF demo 能成功并不等于原生 Win32 API 也能成功。验收必须跑本库的 `hello_probe`。

WebAuthn API 版本同样决定结构体：API 9 的运行时（Windows 11 25H2）拒绝 v7 的 `WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS`，必须用 v9 布局。库按 `WebAuthNGetApiVersionNumber` 选择布局，并在 x64 上用编译期断言钉住结构体大小。

Windows L3 验收已通过（API 9，`create` / `wrap` / `unwrap` / `delete` 全绿）。验收依赖三件事：本地磁盘上的进程镜像、非 null 的父窗口，以及支持 PRF 的 Windows 版本。

## 接入约定

- 本库**不做 I/O**：`wrap` 返回完整的外层 blob，由调用方决定它写到哪里。
- 本库**不依赖 `qualia2fa-core`**：32 字节密钥类型是本地定义的，应用在边界上转换。
- 平台返回的载荷是私有的，外层格式只负责 magic、版本、后端与长度校验。
- 任何输入都不得导致 panic；错误信息与 `Debug` 不包含密钥或载荷字节。
- `unsafe` 只允许出现在平台后端，每个块都要写明 `// SAFETY:` 理由。

## 构建与测试

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --features mock -- -D warnings
cargo test --all-targets --features mock
cargo test --doc --features mock
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo deny check
```

平台后端在 Windows / Android 上各需要真机验证；没有真机时，`Availability` 必须报告 `Unavailable` 或 `Unsupported`，不得伪装成可用。

## 相关仓库

- 使用它的绑定层：[Qualia2FA-FFI](/repos/ffi/)
- Android 平台实现：[QualiaBioAuth-Android](/repos/qualia-bioauth-android/)
- 应用主密钥的另一层保护：[Qualia2FA-Core 的解锁密码](/repos/core/#解锁密码)

## 许可证

LGPL-3.0-or-later，见仓库里的 `COPYING.LESSER` 与 `LICENSE`。
