# 绑定层 Qualia2FA-FFI

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

把 [`qualia2fa-core`](/repos/core/) 暴露为 [UniFFI](https://mozilla.github.io/uniffi-rs/) 绑定，供 Kotlin、Swift 等托管语言调用。

除了搬运核心接口，本层还**自己实现**了局域网通道（组播发现 + 端点数据面）——那一半只在 Rust 侧可用，端侧实现不了。

## 已导出的功能

- OTP：TOTP / HOTP / mOTP / Yandex OTP / Steam Guard
- 保险库、树状分组、条目图标
- 导入与导出（六种格式，含两个 `.q2fa` 容器）
- 恢复密钥
- 注册 / 登录
- 挑战-应答与同步
- 平台密钥库里的主密钥（直接与包裹两种存法）
- 平台认证包裹（Windows Hello）
- 二维码编解码与多帧拼装
- 局域网通道（`iroh-lan`）

## 构建动态库

```bash
cargo build --release
```

产物为 `target/release/qualia2fa_ffi.dll`（Windows）、`.so`（Linux / Android）、`.dylib`（macOS / iOS）。要静态库则取同目录下的 `.lib` / `.a`。

## 生成端侧绑定

绑定生成器是本仓库自己的二进制，这样**生成绑定所用的 UniFFI 版本与库编译时的完全一致**。改用全局安装的 `uniffi-bindgen` 会让两边版本漂移，产出「能编译但运行时不匹配」的绑定。

```bash
cd FFI    # 必须在仓库根执行：uniffi-bindgen 内部会调用 cargo metadata

# Kotlin（JVM 桌面端与 Android 共用同一份绑定）
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/qualia2fa_ffi.dll \
    --language kotlin --out-dir ./bindings

# Swift（iOS）
cargo run --bin uniffi-bindgen -- generate \
    --library target/debug/qualia2fa_ffi.dll \
    --language swift --out-dir ./bindings-swift
```

生成的绑定**不入库**——它们是派生物，应由端侧构建流程在编译前生成。入库会立刻产生「绑定与接口定义不同步」的问题。

::: tip 提示
若出现 `Unable to auto-format ... using ktlint: program not found`，只是缺少可选的 `ktlint`，产物依然正确可用。
:::

## 在 Kotlin 中调用

生成的绑定位于 `uniffi.qualia2fa_ffi` 包下：

```kotlin
import uniffi.qualia2fa_ffi.*

// 打开保险库后，主密钥留在 Rust 侧。
val vault = FfiVault.fromMasterKey(masterKeyBytes)
val now = System.currentTimeMillis() / 1000

val parsed = parseOtpauthUri(
    "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
)
// 取出条目种类里的步长；mOTP / Yandex / Steam 的字段各不相同。
val period = (parsed.kind as? FfiEntryKind.Totp)?.period ?: 30uL
val code = totpCode(parsed.secretBase32, now, period, parsed.algorithm, parsed.digits)
```

绑定通过 JNA（JVM）或系统动态加载器（Swift）按**名字**查找动态库，因此 `qualia2fa_ffi.dll` / `libqualia2fa_ffi.so` / `libqualia2fa_ffi.dylib` 必须与应用一起分发，并落在加载器能找到的位置。

## 接口地图

### 验证码

| 函数 | 说明 |
|---|---|
| `parse_otpauth_uri` / `serialize_otpauth_uri` | 解析与序列化 `otpauth://` URI |
| `totp_code` / `hotp_code` | 计算验证码 |
| `steam_guard_code` | Steam Guard 5 位字母表 |
| `verify_code_with_drift` | 容错校验，返回命中的偏移量 |
| `codes_match` | 常量时间比较 |
| `generate_secret_base32` | 生成 256 位随机种子（OS CSPRNG） |
| `core_version` | 核心版本，供兼容性检查 |

**时间一律由调用方传入。** 核心不读时钟；端侧应传系统时钟的 Unix 秒数。

### 保险库（`FfiVault`）

条目本身由 `FfiVault` 持有，**主密钥留在 Rust 侧**。「打开 → 列条目 → 改条目 → 存回文件」这条最常见的路径上，主密钥一次都不会以字节形式出现在 Kotlin / Swift 里。

| 方法 | 说明 |
|---|---|
| `FfiVault.register(keys, store, label)` | 生成主密钥、取得设备身份、写入平台密钥库 |
| `FfiVault.open(store, data)` | 用密钥库里的主密钥打开保险库文件 |
| `FfiVault.fromMasterKey(bytes)` | 用已有主密钥建立空保险库（登录 / 恢复之后用） |
| `entries` / `entry(id)` | 读取条目（顺序不保证，列表请自行排序） |
| `addEntry(entry, now)` / `updateEntry(entry, now)` | 新增 / 修改（修改保留标识，不留墓碑） |
| `removeEntry(id, now)` | 删除（留墓碑） |
| `serialize` | 序列化，供端侧**原子地**落盘 |
| `codeFor(id, now)` / `hotpFor(id, counter)` | 按**条目的种类**算验证码 |
| `groups` / `childrenOf` / `parentOf` / `depthOf` | 树本身 |
| `createGroupIn` / `renameGroup` / `setChildren` / `removeGroup` | 分组编辑 |
| `export(format, password)` | 导出六种格式之一 |
| `exportRecoveryKey` / `detectPortableFile` / `openPortableFile` | 恢复密钥与 `.q2fa` 恢复 |

`updateEntry` 与 `removeEntry` 的区别不只是语义：修改保留条目标识，删除留下墓碑。两者在另一台设备上被读成完全不同的操作，因此**不要**用「删除 + 新增」实现修改。

### 注册与登录

```kotlin
// 新设备注册
val vault = FfiVault.register(deviceKeys, secureStore, "qualia2fa-device")

// 老设备（已登录）：出示二维码
val login = FfiLogin.begin()
showQrCode(login.payload())

// 新设备：扫码、发请求、拿回应答后完成
val joiner = FfiJoiner.fromQr(scannedText, "qualia2fa-device")
val request = joiner.request(deviceKeys)
// …把 request 交给老设备…
val reply = login.authorize(oldVault, request)   // 界面在这里必须先让用户确认
val masterKey = joiner.complete(reply, deviceKeys, secureStore)
```

一次登录只能完成一次。第二次调用报的是**与「应答是伪造的」相同的错误**，这是故意的——单独报「已经用过了」等于告诉重放者他被认出来了。端侧文案也应保持笼统。

### 主密钥的两种存法

主密钥在平台上只有两种存法，**用哪个对象去问就是选择，没有模式参数**：

| 方法 | 说明 |
|---|---|
| `FfiDirectMasterKeyStore.open()` | 平台库直接持有材料（Windows 上是 CNG，Android 上是 Keystore） |
| `FfiWrappedMasterKeyStore.open()` | 平台库持有一把不可导出的 KEK；`store` 返回由端侧持久化的包裹字节 |
| `backend()` / `isHardwareBacked()` | 如实报告实际答话的后端 |

主密钥只以字节过边界（32 字节进、32 字节出），既不进日志也不进错误消息。包裹形式交出的字节是不透明的：端侧只负责把它们与保险库文件一起持久化，任何包裹 / 解包操作都不在这层接口里。

### 挑战-应答

用来证明「对方持有主密钥」而不把主密钥交出去。**三步都要走完**，漏掉第三步等于只做了一半认证。

```kotlin
val verifier = FfiVerifier.begin()
val responder = FfiResponder.accept(verifier.challenge())
val response = responder.respond(vault, label, deviceKeys)
verifier.verify(response, vault)
responder.confirm(vault, verifier.sessionId()!!, verifier.confirmation()!!)
```

空保险库也能判定主密钥对错：文件格式版本 2 起末尾有主密钥检查值，因此 `FfiVault.open` 在一个条目都没有的文件上也会拒绝错误的主密钥。例外是版本 1 的旧文件。

### 同步

同步是**两台设备各出一个码、一次一个方向**：一方出示自己的状态，另一方读入并合并，然后反过来。载荷由核心加密并认证，通道只负责搬字节。

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
vault.serialize()?.let(::saveVault)     // 合并写进了保险库，必须落盘
```

冲突的 `kind` 是稳定字符串：

| kind | 含义 | 两个选择 |
|---|---|---|
| `entry_mismatch` | 两边都有这条条目，内容不同 | 保留本机版本 / 采用对方版本 |
| `peer_deleted` | 对方删除了它，本机改过它并留着 | 保留条目 / 接受删除 |
| `local_deleted` | 本机删除了它，对方还留着 | 保持删除 / 恢复条目 |

裁决只作用于本机。「采用对方版本」会真正写进保险库，所以**必须落盘**；「保留本机版本」不会让分歧消失——轮到对方同步时它会问它的用户。

### 局域网通道

`FfiLanChannel` 是一个可以拨号的端点，`FfiLanLobby` 是同一网段上的发现。它与端侧自己实现的 `FfiTransport` **满足同一套契约**，因此同步会话对两种载体没有分支。

```kotlin
val channel = FfiLanChannel.open(deviceId)      // 显式打开：占一个 UDP 端口与一套运行时
val lobby = channel.openLobby()                 // 显式开始公告；不调用就不公告
showCode(withRecord(host.payload(), channel.record()))

val record = recordOf(scannedText)
val peer = lobby.peers().firstOrNull { it.record.contentEquals(record) }
if (peer?.socket != null) channel.rememberPeer(peer.deviceId, peer.record, peer.socket!!)
```

三件使用者必须知道的事：

1. **显式打开、显式关闭，不做后台同步。** 打开一个通道就占一个 UDP 端口与一套 tokio 运行时（2 个工作线程），打开大厅之后还会按 30 秒周期公告自己。离开界面时请 `shutdown()`。
2. **连接记录里没有 IP。** `record()` 只有端点公钥与端口，IP 来自收到组播报文的那一方——端点自己报出来的 socket 是通配地址，照它拨号拨不通。
3. **依赖 `qualia-transport` 并打开 `iroh-lan`。** iroh、tokio 及其依赖树会进入每一次构建，构建时间与产物体积都明显增加。

## 错误分类

FFI 错误跨到 Kotlin 后是 `sealed class FfiException`：

| 变体 | 含义 |
|---|---|
| `InputTooLong` | 输入超过边界上限 |
| `Core` | 核心返回的错误，结构化为 `FfiCoreError { kind, message }` |
| `Qr` | 二维码通道自身报出的失败 |
| `Lan` | 局域网通道自身报出的失败 |
| `InvalidDeviceId` | 设备标识不是 64 位十六进制 |
| `UnknownConflict` | 为一条不在等待裁决的冲突做了裁决 |
| `AuthBound` | 平台认证包裹失败 |

`kind` 是**稳定的机器可读标识**（如 `secret_empty`、`vault_entry_not_found`），端侧据此分流 UI；`message` 仅供展示与日志。这些字符串属于公开接口：**可以新增，但既有值不得改名**。

核心是 `#[non_exhaustive]` 的，未来会新增错误变体，因此端侧**必须对未知 `kind` 有兜底分支**：

```kotlin
try {
    parseOtpauthUri(input)
} catch (e: FfiException.Core) {
    when (e.detail.kind) {
        "uri_missing_secret" -> showReenterHint()
        "randomness_unavailable" -> showRetryHint()
        else -> showGenericError(e.detail.message)   // 必须保留兜底分支
    }
}
```

有几组 `kind` 是刻意分开的：`device_not_registered` 不与 `vault_decryption_failed` 合并，`pairing_authentication_failed` 不与任何更具体的错误合并，`sync_already_applied` 不与 `sync_authentication_failed` 合并。合并它们会造成用户可见的错误判断。

## 秘密材料

跨 FFI 边界时，OTP 种子统一以 **Base32 字符串**表示。种子的字节永远不会以 `Vec<u8>` 形式经过 FFI——那会在两侧各留一份不受擦除控制的拷贝。

::: warning 托管语言的残留风险
Base32 字符串在 Kotlin / Swift 侧是普通 `String`，不受核心 `secrecy` 的擦除保护，且可能被 GC 复制、进字符串常量池。端侧应约定：种子的 Base32 只在必要作用域内存在，用完立即丢弃，**绝不写入日志或持久化**。
:::

主密钥正常路径下**根本不过边界**：`FfiVault` 在 Rust 侧持有它，读条目、改条目、算验证码、序列化都在 Rust 内完成。只有登录、恢复与密钥库存取这几个入口需要端侧交出或接收它。

## 约束

本 crate 的职责是：把端侧传来的原始类型转成核心类型、调用核心、把结果转回去。**任何加密、解析、校验逻辑出现在这里都是设计倒退。**

`uniffi::setup_scaffolding!()` 在本 crate 内展开 FFI 边界所需的 unsafe 代码，因此这里不能 `#![forbid(unsafe_code)]`。安全边界划在 **crate 之间**：核心无 unsafe、可独立审计，FFI 只做搬运。

UniFFI 停在 `0.29` 是因为端侧绑定生成器 Gobley 强制 `uniffi = "0.29.4"`，Rust 侧与 Kotlin 侧的脚手架必须同版本。这也是 `uniffi` 不进入 `qualia2fa-core` 的原因。

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

## 相关仓库

- 被包装的核心：[Qualia2FA-Core](/repos/core/)
- 设备身份与平台密钥库：[QualiaDeviceIdentityKit](/repos/qualia-dik/)
- 二维码与局域网实现：[QualiaTransport](/repos/qualia-transport/)
- 认证包裹：[QualiaBioAuth](/repos/qualia-bioauth/)

## 许可证

LGPL-3.0-or-later，见仓库里的 `LICENSE` 与 `COPYING.LESSER`。
