# 核心库 Qualia2FA-Core

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

Qualia2FA 的核心库，承载全部核心逻辑：验证码计算、URI 解析、加密保险库、设备配对与同步合并。

它**刻意不含任何界面或命令行入口**，也不做 I/O 与时钟读取——以便 Windows、Android 等平台各自作为独立项目复用它。

## 能力

| 功能 | 说明 |
|---|---|
| 2FA 验证码 | HOTP（RFC 4226）、TOTP（RFC 6238）、mOTP、Yandex OTP、Steam Guard |
| Base32 | RFC 4648，宽容与严格两种模式 |
| URI | 解析与序列化 `otpauth://` 与 Aegis 的 `motp:` |
| 保险库 | 逐条加密的本地存储格式，树状分组，条目图标，墓碑 |
| 导入 | Aegis 的 JSON / HTML / TXT 导出（加密导出也能开） |
| 导出 | `.q2fa` 容器（明文 / 加密）与四种外部格式 |
| 解锁密码 | Argon2id 派生 + XChaCha20-Poly1305 的定长包裹 |
| 恢复密钥 | 口令加密的恢复文件（`.q2fa`） |
| 设备配对 | 二维码登录、挑战-应答 |
| 同步 | 加密载荷的生成、合并、冲突报告 |

## 安装

```toml
[dependencies]
qualia2fa-core = "0.4"
```

## 快速开始

### 计算验证码

```rust
use qualia2fa_core::otp::{self, Algorithm, Digits, OtpSecret};

let secret = OtpSecret::from_base32("JBSWY3DPEHPK3PXP")?;
// 当前时间由调用方传入——本库不读时钟
let code = otp::totp_code(&secret, 1_700_000_000, 30, Algorithm::Sha1, Digits::SIX)?;
assert_eq!(code.len(), 6);
```

### 解析 `otpauth://`

```rust
use qualia2fa_core::uri;

let entry = uri::parse(
    "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
)?;
assert_eq!(entry.issuer.as_deref(), Some("GitHub"));
assert_eq!(entry.account, "alice");
```

### 容错校验

```rust
use qualia2fa_core::otp;

// 返回命中的偏移步数（0 = 当前步，-1 = 落后一步），而不是布尔值，
// 便于据此校准该条目的时钟偏差。比较是常量时间的。
let offset = otp::verify_with_drift(&secret, counter, 1, algorithm, digits, &user_input);
```

### 加密保险库

一条 `otpauth://` 配置存进保险库后就变成一条**逐条加密**的条目：每条有自己的 128-bit 随机 ID 与 XChaCha20-Poly1305 密文，文件里除了那些 ID 之外没有任何明文语义——连「这是 TOTP 还是 HOTP」都看不出来。

```rust
use qualia2fa_core::vault::{self, VaultFile};

let parsed = qualia2fa_core::uri::parse(
    "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
)?;
let entry = vault::entry_from_parsed_uri(&parsed, now)?;

let mut file = VaultFile::create()?;              // 生成新的随机主密钥
let id = file.vault_mut().insert(entry)?;

let bytes = file.serialize()?;
vault::write_file_atomically(std::path::Path::new("vault.q2fa"), &bytes)?;
```

读回来需要**主密钥**——文件里不含它，只含一个由它派生的检查值（格式版本 2 起，32 字节，只能回答「是不是这把密钥」）：

```rust
use qualia2fa_core::vault;

let master: vault::MasterKey = master_key_from_platform_store()?;
let file = vault::read_file(master, std::path::Path::new("vault.q2fa"))?;
for (id, entry) in file.vault().iter() {
    println!("{id} {}", entry.name);
}
```

几件需要知道的事：

- **主密钥丢失 = 数据永久无法解密。** 没有服务端、没有账号密码，也就没有找回途径。
- **文件可以被攻击者随意改写。** 任何一个字节被改动都会导致解密失败，而不是悄悄解出一份被篡改的数据。
- **落盘请用 `write_file_atomically`。** 直接 `fs::write` 在断电时可能留下一个被截断的文件。
- **删除会留下墓碑**（同样加密，只有 ID 与时间戳），这样「另一台设备还有这条」才可裁决。墓碑不设过期，每条 45 字节。
- 密文长度会泄露备注、账号名的**长短**。这是已知的、有意的取舍。

### 解锁密码

主密钥通常放在平台密钥库里，读出它不需要用户做任何事。要在打开保险库之前先要求一次认证，就把主密钥另存一份**只有口令能打开**的包裹，放在保险库旁边：

```rust
use qualia2fa_core::{KdfParams, SecretString, lock};

let password = SecretString::from("the unlock password".to_owned());

// 写入：Argon2id 派生 + XChaCha20-Poly1305，结果写进 master.key.pw。
let wrap = lock::wrap(&master_key, &password, &KdfParams::recommended())?;
std::fs::write("master.key.pw", &wrap)?;

// 读取：口令错就是口令错，不会解出一把「另一把密钥」。
let recovered = lock::unwrap(&wrap, &password)?;
```

包裹文件是定长 110 字节，自带 KDF 参数与随机盐，因此旧文件永远读得回来。参数来自文件，属于不可信输入，**边界检查在 Argon2id 运行之前**完成。口令错、参数越界、版本不认识是三种不同的错误。

## 设计约定

### 无 I/O、无时钟

不访问文件系统、网络、环境变量，不读系统时钟。**时间一律由调用方以 `u64` Unix 秒传入。** 这不是洁癖：只有时间作为参数传入，RFC 6238 的测试向量才能被确定性地验证。

随机数只用 `getrandom`（OS CSPRNG），不经任何用户态 PRNG。核心再导出 `getrandom`，让上层取用同一份 CSPRNG。

唯一的文件 I/O 是两处可选的便利函数：`write_file_atomically` 与 `read_file`。FFI 与端侧都不走它们；「核心无 I/O」指的是逻辑层不依赖 I/O。

### 绝不 panic

所有对外函数返回 `Result`，错误类型化。任何输入都不得导致 panic——包括恶意二维码、剪贴板内容与手输链接。错误类型**绝不携带秘密材料**：不放进原始输入、不放密钥字节、不放 OTP 码。

### 秘密材料

库内所有秘密（OTP 种子、保险库主密钥、会话密钥）一律用 [`secrecy`](https://crates.io/crates/secrecy) 的类型承载，**不用裸 `Vec<u8>` / `String`**：

| 用途 | 类型 |
|---|---|
| 任意字节秘密（种子、密钥、nonce） | `SecretBytes`（= `SecretSlice<u8>`） |
| 文本秘密（口令、恢复短语） | `SecretString` |
| 定长 / 其它秘密 | `SecretBox` |
| 取用明文 | `ExposeSecret` / `ExposeSecretMut` |

这些类型全部由本库再导出，调用方不需要直接依赖 `secrecy`。注意 `secrecy` 的 `Debug` 连长度都不打印；它只为原始整数实现 `CloneableSecret`，因此字节秘密统一用可克隆的 `SecretSlice<u8>`。

## 兼容性

**保险库文件格式：4。** 本版本一律写版本 4，并且仍然能读版本 1–3（可读版本只增不减）。版本 4 的分组记录是「名字 + 有序子节点列表」，条目可以带图标。老版本应用读到版本 4 的文件会得到明确的「版本不支持」错误；唯一的例外是版本 1 的解析器，它报的是文件尾部有多余内容（那 32 字节的主密钥检查值在它看来就是多余内容）。

**同步载荷版本：4。** 载荷只接受当前版本，因此载荷版本不同的两台设备无法同步；升级时请把所有设备一起升级。版本号在明文头部，不需要密钥就能读到，所以报的是版本错误而不是认证失败。

## 测试与模糊测试

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps      # 文档链接不得有警告
cargo deny check
```

`otpauth://` 解析器、Base32 解码与保险库文件解析都是**攻击者可控**的输入面，改动它们时必须跑 fuzz：

```bash
cd fuzz
cargo +nightly fuzz run uri_parse -- -max_total_time=300
cargo +nightly fuzz run vault_parse -- -max_total_time=300
cargo +nightly fuzz run login_handshake -- -max_total_time=300
```

fuzz 目标必须用 `cargo fuzz` 构建，不能用 `cargo build`——`fuzz_target!` 生成的入口点依赖 cargo-fuzz 注入的链接参数。

## 相关仓库

- 端侧绑定：[Qualia2FA-FFI](/repos/ffi/)
- 平台密钥库与设备身份：[QualiaDeviceIdentityKit](/repos/qualia-dik/)
- 传输通道：[QualiaTransport](/repos/qualia-transport/)

## 许可证

LGPL-3.0-or-later。完整文本见仓库里的 `LICENSE` 与 `COPYING.LESSER`。
