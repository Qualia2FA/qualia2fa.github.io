# 应用本体 Qualia2FA

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">Windows · Android</span>
    <span class="q-pill">Compose Multiplatform</span>
    <span class="q-pill q-pill--version">v0.4.0</span>
    <span class="q-pill">Apache-2.0</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/Qualia2FA">GitHub</a>
    <a href="https://github.com/Qualia2FA/Qualia2FA/releases">Releases</a>
    <a href="https://github.com/Qualia2FA/Qualia2FA/security/policy">Security</a>
  </div>
</div>

Qualia2FA 是一个**无中心服务器、不实时同步**的多平台双因素认证应用。每台设备各自独立运行，不依赖厂商服务器，也不需要注册账号；解锁密码只在本机使用。登录了同一账号的设备之间可以直接分享条目，合并规则取并集。

界面用 Compose Multiplatform 编写，Windows 桌面端与 Android 共用同一套界面和业务逻辑。桌面端走官方 JVM 目标，打包方式是 jlink + jpackage，产物是自包含的离线安装包。

## 功能

| 类别 | 内容 |
|---|---|
| 验证码 | TOTP（RFC 6238）、HOTP（RFC 4226）、mOTP、Yandex OTP、Steam Guard |
| 保险库 | 逐条加密、树状分组、条目图标、墓碑式删除、原子落盘 |
| 导入 | Aegis 的 JSON / HTML / TXT 导出（含加密导出）、`otpauth://` URI、二维码图片 |
| 导出 | `.q2fa` 容器、加密 `.q2fa`、文本、JSON、加密 JSON、HTML |
| 分享 | 二维码（单帧、多帧、图片导入）、同一网段内的局域网通道 |
| 登录 | 注册新账号，或从已登录设备扫码取得主密钥；恢复密钥导入 |
| 解锁 | 解锁密码（Argon2id）与生物识别（Windows Hello / Android BiometricPrompt） |
| 外观 | 浅色 / 深色 / 跟随系统；英文与简体中文 |

## 平台与安装

| 平台 | 产物 | 说明 |
|---|---|---|
| Windows 10 / 11（x64） | `.msi` 与 `.exe` 离线安装器 | 带签名，但证书是自签发的，Windows 会警告「未知发布者」 |
| Android 8.0 及以上（64 位 ARM） | `.apk` | 用项目的发布密钥签名，可直接安装 |

安装包在 [Releases](https://github.com/Qualia2FA/Qualia2FA/releases) 页面。Android 目前只提供 `arm64-v8a`，Windows 目前只提供 `x86_64`。

::: tip 权限
相机权限只在扫码时询问；拒绝后仍可从图片识别。局域网权限只在配对或同步时使用。应用不申请后台权限，也不做后台同步。
:::

## 安全模型

- **主密钥从不直接落盘。** 平台密钥库内部生成一把加密密钥（Windows 上是 TPM，没有 TPM 时是 CNG 软件库；Android 上是 Keystore / StrongBox），数据目录里存的是它产出的密文。拷走文件不等于拷走账号。
- **后端如实上报。** 设置界面会显示当前是 `tpm`、`android-keystore` 还是 `software`。没有硬件时不会静默降级，是否接受由用户决定。
- **解锁密码是独立的一层。** 主密钥先用 Argon2id 派生的口令包裹（`master.key.pw`），设备支持时再加一层由系统认证放行的包裹（`master.key.bio`）。两条路都能打开同一把主密钥，密码始终是后路。
- **自动锁定。** 锁定可随时在设置里触发，15 分钟没有操作也会自动锁定；切到别的窗口不会立刻要求解锁。
- **端到端加密。** 条目离开设备之前就已加密，分享通道上的中间人拿不到明文。冲突裁决只作用于本机，且必须落盘。

## 界面

浅色与深色是同一个标志的两种读法：浅色是白底黑线（底色 `#EAF2F4`、线条 `#091012`），深色把这两个色对调。界面主题跟随系统设置，应用内不再提供自己的开关。

两个平台读到系统设置的时刻不同：Android 会在运行期间收到配置变更，切换立即生效；Windows 的桌面工具包在创建窗口时读一次，运行中切换要下次启动才生效。

界面文案放在 `composeApp/src/commonMain/composeResources/`：`values/` 是默认的英文，`values-zh/` 是中文。默认跟随系统语言，登录界面与设置界面都能手动切换。

对比度是算出来的而不是看出来的：`ThemeTest` 把界面上真会出现的每一对前景 / 背景按 WCAG 2.1 算一遍，两套配色都要达到 AA（4.5:1）。

## 代码结构

```text
composeApp/
├── src/commonMain/             界面与业务代码（Kotlin，两个平台共用）
│   ├── composeResources/       标志与图标，界面文案 values/ 与 values-zh/
│   └── kotlin/dev/qualia/qualia2fa/
│       ├── Layout.kt           按窗口尺寸决定布局的纯函数
│       ├── Theme.kt            两套配色、圆角与间距
│       └── *Screen.kt          加载、登录、2FA、同步、设置与配对
├── src/androidJvmMain/         桌面端与 Android 共用：保险库文件与主密钥包裹
├── src/jvmMain/                桌面端：数据目录、文件对话框、窗口
├── src/androidMain/            Android：Activity、相机、文件选择器、局域网
└── src/jvmTest/                单元测试（含两套配色的对比度）
```

`Qualia.kt` 是全仓唯一 import 生成绑定的文件：界面只看到普通的 Kotlin 值，绑定层要换、要打补丁或 fork 时只应该动这一个文件。

## 从源码构建

需要 JDK 21 与 Rust 工具链（Windows 上是 MSVC）。应用构建的是**已发布**的 `qualia2fa-ffi`：源码在配置阶段从 crates.io 取下来、按索引里的 SHA-256 校验后解包进 git 忽略的 `composeApp/rust/`。

```bash
./gradlew :composeApp:jvmTest          # 编译并运行单元测试
./gradlew :composeApp:run              # 启动桌面应用
./gradlew :composeApp:packageMsi       # 打包 MSI
./gradlew :composeApp:assembleRelease  # Android 发布包
```

完整的环境准备与各层构建命令见[安装与构建](/guide/getting-started/)。

## 当前边界

- **只支持 Windows 与 Android。** Linux、iOS、macOS 仍在计划中；作者没有苹果设备，后两者的支持计划已无限延迟。
- **不做后台同步。** 设备之间按需手动分享，局域网通道只在需要它的界面打开时启用。
- **主密钥丢失不可恢复。** 请导出并保管恢复密钥。
- **Windows 安装器的证书尚未被信任。** 在证书来自受信任的签发者之前，签名不能当作身份依据。

## 相关仓库

- 界面调用的绑定层：[Qualia2FA-FFI](/repos/ffi/)
- 全部密码学与协议：[Qualia2FA-Core](/repos/core/)
- 设备身份与平台密钥库：[QualiaDeviceIdentityKit](/repos/qualia-dik/)
- 二维码与局域网：[QualiaTransport](/repos/qualia-transport/)
- 平台认证包裹：[QualiaBioAuth](/repos/qualia-bioauth/)、[QualiaBioAuth-Android](/repos/qualia-bioauth-android/)

## 许可证

应用本体采用 **Apache License 2.0**。四个 Rust 层与两个认证库采用 **LGPL-3.0-or-later**。应用层用宽松许可证，便于分发与二次开发；核心的密码学实现保持 copyleft，使任何修改都必须回馈。
