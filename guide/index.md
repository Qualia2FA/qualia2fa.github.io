# 项目总览

Qualia2FA 是一个**无中心服务器、不实时同步**的双因素认证（2FA）应用。每台设备各自独立运行，不依赖任何厂商的服务器，也不需要注册账号；解锁密码只在本机使用。登录了同一账号的设备之间可以按需分享条目，合并规则取并集。

围绕它的是七个仓库：一个应用，加上六个可以单独使用的库。它们共享同一套安全纪律，但依赖方向始终单向。

## 设计取向

| 取向 | 含义 |
|---|---|
| **无中心** | 没有服务端、没有传统账号体系、没有「忘记密码」流程。密钥只存在于用户自己的设备上。 |
| **不实时同步** | 设备之间按需手动分享，而不是后台持续同步。服务器宕机不会让用户拿不到验证码。 |
| **端到端加密** | 条目在离开设备之前就已逐条加密，二维码与局域网通道上的中间人拿不到明文。 |
| **离线可用** | 断网时验证码照常计算，导入、导出与本地管理也不受影响。 |
| **不静默降级** | 没有硬件密钥库时如实报告 `software`，由用户决定是否接受较弱的保护。 |
| **秘密不进日志** | 主密钥、OTP 种子与会话密钥不进入日志、错误消息、panic 信息或 `Debug` 输出。 |

## 账号与密钥模型

Qualia2FA 的账号**没有密码**，唯一的凭证是一把 32 字节的随机主密钥。

1. **第一台设备选择注册**：本地生成主密钥，保险库用它加密。主密钥本身由平台密钥库保管——Windows 上是 TPM 或 CNG，Android 上是 Keystore / StrongBox。
2. **后续设备选择登录**：已登录的设备出示一张二维码，新设备扫码后与它建立一次 ECDH 会话，在验证双方身份之后取得主密钥。主密钥从不经过任何服务器。
3. **主密钥可以备份**：导出恢复密钥文件（口令加密）是唯一的离线找回方式。主密钥丢失，数据就永久无法解密。
4. **解锁密码是额外一层**：从 0.4.0 起，主密钥会先用 Argon2id 派生的口令包裹，设备支持时再加一层由 Windows Hello 或 Android 生物识别放行的包裹。两条路都能打开同一把主密钥，密码始终保留为后路。

同步时，两台设备各出一个码、一次一个方向：一方出示自己的状态，另一方读入并合并，然后反过来。载荷由核心加密并认证，通道只负责搬运字节。冲突由用户逐条裁决，裁决只作用于本机，并且必须落盘。

## 仓库地图

下表是本文写作时的版本；以各仓库的标签与清单为准。

| 仓库 | 产物 | 版本 | 职责 | 许可证 |
|---|---|---|---|---|
| [Qualia2FA](/repos/qualia2fa/) | Windows / Android 应用 | 0.4.0 | Compose Multiplatform 界面与端侧集成 | Apache-2.0 |
| [Qualia2FA-Core](/repos/core/) | crate `qualia2fa-core` | 0.4.1 | 密码学、保险库、配对与同步协议 | LGPL-3.0-or-later |
| [Qualia2FA-FFI](/repos/ffi/) | crate `qualia2fa-ffi` | 0.4.1 | UniFFI 绑定层与局域网通道 | LGPL-3.0-or-later |
| [QualiaDeviceIdentityKit](/repos/qualia-dik/) | crate `qualia-dik` | 0.1.4 | 设备身份原语与平台密钥库 | LGPL-3.0-or-later |
| [QualiaTransport](/repos/qualia-transport/) | crate `qualia-transport` | 0.1.6 | 二维码与局域网传输 | LGPL-3.0-or-later |
| [QualiaBioAuth](/repos/qualia-bioauth/) | crate `qualia-bioauth` | 0.1.0 | 平台认证绑定的密钥包裹（Windows Hello） | LGPL-3.0-or-later |
| [QualiaBioAuth-Android](/repos/qualia-bioauth-android/) | `com.qiushui1012.lib:qualia-bioauth-android` | 0.1.0 | Android Keystore + BiometricPrompt 的包裹实现 | LGPL-3.0-or-later |

## 依赖方向

```text
qualia-dik ────────► qualia2fa-core ────────► qualia2fa-ffi ────────► Qualia2FA
qualia-transport ──► qualia2fa-core
qualia-transport ─────────────────────────► qualia2fa-ffi   (iroh-lan)
qualia-bioauth ───────────────────────────► qualia2fa-ffi
qualia-bioauth-android ───────────────────────────────────────────► Qualia2FA (Android)
```

三条约束把这个形状固定下来：

- **独立库只被依赖，绝不反向依赖核心。** 判断标准只有一句：它对 Qualia2FA 一无所知也成立吗？「在平台硬件里生成一对 P-256 身份密钥」成立；「保险库文件格式」不成立。
- **依赖一律写 crates.io 的版本号**，不用 submodule，也不用 `../Xxx` 路径依赖。四个 Rust 清单都不声明 `[workspace]`，各自是独立的工作区根。
- **应用在构建时取已发布的 `qualia2fa-ffi`**，按 crate 索引里的 SHA-256 校验后解包。换版本时必须同时换掉校验值，否则构建会失败——这挡住了「版本号写着新、实际拿到旧包」的静默错配。

## 安全边界

| 层 | 约束 |
|---|---|
| `qualia2fa-core` | `#![forbid(unsafe_code)]`；无 I/O、无时钟；任何输入都不得 panic；全部密码学、保险库格式与协议 |
| `qualia-dik` | 整个项目里唯一允许 `unsafe` 的 crate，也是唯一接触平台原生 API 的地方；不放协议逻辑 |
| `qualia2fa-ffi` | 只做搬运；任何加密、解析、校验逻辑出现在这里都是设计倒退 |
| `qualia-transport` | 二维码与局域网的线格式是纯逻辑；只有组播大厅开 socket、起线程、读时钟 |
| `qualia-bioauth` | 只封装平台认证边界；不做 I/O，不知道保险库格式 |
| `qualia-bioauth-android` | 只做平台调用；blob 格式与错误分类留在 Rust crate |
| `Qualia2FA` | 端侧适配层不含判断；界面只看到 facade 暴露的普通 Kotlin 值 |

算法选择同样固定：设备身份签名使用 **ECDSA P-256**（Android KeyMint 没有 EdDSA，Apple Secure Enclave 只支持 P-256）；保险库使用 **XChaCha20-Poly1305** 逐条加密；口令包裹使用 **Argon2id**；消息模式统一使用 **SHA-256**。

## 版本与兼容性

- **保险库文件格式：4。** 当前版本写 4，并能读 1–3（可读版本只增不减）。老版本应用读到版本 4 的文件会得到明确的「版本不支持」错误。
- **同步载荷版本：4。** 载荷只接受当前版本，因此载荷版本不同的两端无法同步；升级时请把所有设备一起升级。版本号在明文头部，不需要密钥就能读到，所以报的是版本错误而不是认证失败。
- **MSRV：1.89。** `qualia-transport` 打开 `iroh-lan` 时要求 1.91（iroh 1.3.0 的声明），CI 用真实工具链分别验证两个下限。
- **发布顺序是硬约束：** `qualia-dik` → `qualia2fa-core` → `qualia2fa-ffi`。下游依赖上游在 crates.io 上的具体版本，上游没发布时下游的 `--dry-run` 会解析失败。`qualia-transport`、`qualia-bioauth` 与 `qualia-bioauth-android` 不依赖其它层，可以随时发布。

## 从哪里开始

- **想用应用**：读[安装与构建](/guide/getting-started/)，或者直接看[应用本体](/repos/qualia2fa/)。
- **写 Rust**：从[核心库](/repos/core/)开始；需要设备身份或平台密钥库时看 [QualiaDeviceIdentityKit](/repos/qualia-dik/)；需要传输通道时看 [QualiaTransport](/repos/qualia-transport/)。
- **写 Kotlin 或 Swift**：看 [Qualia2FA-FFI](/repos/ffi/)。它已经导出 OTP、保险库、导入导出、配对、同步与局域网通道。
- **接入生物识别**：Windows 与 Rust 侧看 [QualiaBioAuth](/repos/qualia-bioauth/)；Android 应用看 [QualiaBioAuth-Android](/repos/qualia-bioauth-android/)。
