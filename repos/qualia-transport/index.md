# 传输 QualiaTransport

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">crate qualia-transport</span>
    <span class="q-pill q-pill--version">v0.1.6</span>
    <span class="q-pill">Rust 1.89+ / 1.91+（iroh-lan）</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/QualiaTransport">GitHub</a>
    <a href="https://crates.io/crates/qualia-transport">crates.io</a>
    <a href="https://docs.rs/qualia-transport">docs.rs</a>
  </div>
</div>

提供两台设备之间传输一段字节的方案：**二维码**（一张装不下就拆成多张）与**局域网**（先在同一网段上互相发现，再进行传输）。

它不生成任何密钥材料，也不知道 Qualia2FA 的保险库格式。二维码编码是确定性的；组播大厅只读取调用方给的端点公钥与端口。载荷里的随机数与密钥由调用方负责。

## 二维码

```rust
use qualia_transport::qr::{EcLevel, QrProfile};

// 声明这条通道的能力：M 级纠错、最多显示到第 20 版（97×97 模块）。
let profile = QrProfile::new(EcLevel::Medium, 20)?;

// 一张装得下就一张；装不下就按帧切开，最多愿意让用户扫 6 张。
// 装不下会在此处就报出来（带上「需要多少字节、上限多少字节」），而不是等用户开始扫。
let symbols = profile.encode_payload_frames(payload, 6)?;
println!("本次需要扫 {} 张码", symbols.len());

// 端侧按 modules() 把矩阵画到界面上；要一份像素用 render()。
let image = symbols[0].render(4, 4)?;

// 反过来：从摄像头或用户导入的图片里读回**其中一帧**，逐张喂给拼装器。
let frame = qualia_transport::qr::scan::decode_frame(&image)?;
let mut reassembler = qualia_transport::frame::Reassembler::from_first_frame();
if let Some(payload) = reassembler.accept(frame)? {
    // 齐了
}
```

**不是本库信封的内容**（例如要导出的 `otpauth://` URI）用 `encode_text`：它按原样编码调用方给的文本，不让它过信封——别的应用只认自己那套拼法，信封会得到一张谁也用不了的码。纠错级别与**版本上限**由调用方给，装不下报 `Error::TextTooLong`。

### 三个容量数字，别弄混

单位都是**载荷字节**，覆盖的范围不同：

| 方法 | 含义 |
|---|---|
| `QrProfile::payload_capacity()` | **一张**码能装多少（单帧，帧头最短） |
| `QrProfile::frame_payload_capacity()` | 拆帧时**每一张**能装多少（按最长帧头扣） |
| `QrProfile::exchange_capacity(n)` | 一次交换（最多 n 张码）合起来能装多少 |

前两个不相等，而且不能混用：帧头写在信封开头，长度随帧数的**位数**增长，而 `payload_capacity` 恰好是「再多一个字符就装不下」的那个位置——拿它去切帧，一份需要十张以上码的载荷就会切出渲染不出来的帧。`encode_payload_frames` 自己取正确的容量，调用方只需说「最多愿意让用户扫几张」。

### 线格式

```text
Q2FA1:<帧号>/<帧数>:<BASE32>
```

前缀让别人的二维码能被一眼认出来；帧号 / 帧数写在载荷之前，因此扫描方**不解开任何一帧**就知道还差哪几张。单帧写成 `1/1`，多帧不与它分叉。

选 Base32 而不是 Base64 是为了落在二维码的字母数字模式里：Base64 的小写字母不在那张表内。代价约 10% 容量，换来的是「任何扫码器读出来的都是同一串文本」。

## 局域网

组播发现不需要额外 feature。

```rust
use qualia_transport::lan::lobby::Lobby;
use qualia_transport::lan::{LanAddress, LanAddressScanner};
use qualia_transport::qr::{EcLevel, QrProfile};

// 打开大厅：往一个组播组里周期性地报「我在这里、我的端点公钥与端口是这个」，
// 同时听别人报。
let mut lobby = Lobby::open(my_device_id, my_endpoint_key, my_port)?;

// 界面每次刷新时把积压的事件取完。
while let Some(event) = lobby.try_poll() {
    println!("{:?} 现在 {:?}，地址 {:?}", event.peer.device, event.peer.status, event.peer.source);
}

// 跨网段（组播到不了）时，把连接信息放进二维码带外传过去。
let address = LanAddress::new(my_endpoint_key, my_port);

// 展示方：记录就是一段 42 字节载荷，交给二维码那一半渲染。
let profile = QrProfile::new(EcLevel::Low, 10)?;
let symbols = address.to_qr_symbols(&profile, 4)?;

// 扫码方：把相机读到的每一段文本喂进扫描器。任意顺序、重复扫同一张都可以。
let mut scanner = LanAddressScanner::new();
if let Some(address) = scanner.push(scanned_text)? {
    // 拨过去——端点公钥与端口就是从这里来的。
}
```

### 两点约定

- **发现可以无认证，凭据必须来自信道。** 组播组是共享介质，同网段上任何一台机器都能往组里灌任意字节，包括「我是设备 X」这种伪造公告。因此公告**不签名**，它只用来回答「这个网段上大概有谁、去哪里找他」；「他真的是那台设备吗」由连接建立时的握手回答。
- **在线格式里带上发送方的设备标识。** 传输层只认端点公钥，而上层要的是设备标识。两者之间的映射来自无认证的公告，因此每条消息由发送方自己报一次设备标识，接收方用它去套已有的白名单。这个字段不是用来**建立**信任的，而是用来让接收方**应用**信任。

### 数据面

需要局域网的数据面（QUIC 传输）时打开 `iroh-lan`：

```toml
[dependencies]
qualia-transport = { version = "0.1", features = ["iroh-lan"] }
```

组播发现与二维码**不**需要这个 feature——它只带进 QUIC 传输层。注意三点：它会显著增大依赖树与构建时间；它的最低 Rust 版本是 **1.91**（iroh 1.3.0 的要求），高于本 crate 的 1.89；「不联网」目前只到「不构建 relay、不注册 DNS/pkarr、关掉 HTTPS 探测」这一层，抓包实证尚未完成。

## 设计约定

- **装不下是一个错误，不是一个近似。** 超过上限就返回错误，绝不产出「差一点」的码。错误带着 `needed` 与 `limit`，调用方据此告诉用户「差多少」。
- **能编出来的必定拼得回去。** 拆帧侧只在空载荷时产出空帧，拼装侧也只在「只有一张码」时接受空帧。
- **拼装层只做形状检查，不做认证。** 「除末帧外每帧等长」挡的是用户层面的混淆，真正的认证始终在载荷的 AEAD 那一层。
- **扫码方不知道容量，也不该假定。** 每张码装多少字节是展示方屏幕的属性；扫码方用 `Reassembler::from_first_frame()`，满载长度从收到的第一帧观察得到。
- **同一个载荷只有一种文本表示。** 大小写、填充、非零尾比特都被规范化或拒绝。
- **输入是像素，不是图片文件。** 图像格式的解码归平台（JVM 的 `ImageIO`、Android 的 `BitmapFactory`、iOS 的 `UIImage`）。
- **解码器自己的 panic 也不会带崩进程。** `rqrr` 里有一处会被退化图像触发的 `assert!`，调用处包了 `catch_unwind`，panic 变成 `Error::QrDecoderPanicked`。这是收敛而不是修复：真正的修复在上游，而且它依赖 panic 展开。
- **局域网公告是定长 84 字节的 UDP 报文，连接信息是定长 42 字节。** 定长让解析器的形状就是「长度不对就拒绝」。组播 TTL 固定为 1。
- **发现同时在每一张候选网卡上进行。** 网卡上有没有别人，是「广播域」的问题，不是「路由」的问题。因此每一张候选网卡各开一个 socket，全部加入组播组、全部发送、全部监听。需要指定时用 `LanConfig::interface`。
- **列表与收件箱都有界。** 设备标识是公开信息，同网段的任何一台机器都能凭空造出无数个「新设备」发公告。对端名单有上限，超出时丢掉最不活跃的；收件箱满了丢最旧的。上限是安全性质，不是性能调优。
- **收件人是显式的。** 定向发送不得退化成广播。
- **纯逻辑，除了一处。** 二维码与局域网线格式不碰文件系统、网络、时钟与环境变量；只有组播大厅会开 socket、起后台线程、读时钟。`#![forbid(unsafe_code)]` 全程成立，唯一的失败方式是返回错误。

## 接入

```toml
[dependencies]
qualia-transport = "0.1"
```

移动端走平台相机、不需要从图片里解码时，关掉默认 feature 可以甩掉整条图像解码链：

```toml
[dependencies]
qualia-transport = { version = "0.1", default-features = false }
```

## 构建与测试

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
cargo clippy --all-targets --no-default-features -- -D warnings
cargo test --no-default-features --all-targets
cargo clippy --all-targets --features iroh-lan -- -D warnings
cargo test --features iroh-lan
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps
cargo deny check
```

两个 MSRV 都用真实工具链验证：

```bash
cargo +1.89 check --all-targets                        # 默认构建的下限
cargo +1.91 check --all-targets --features iroh-lan    # iroh-lan 的下限
```

fuzz 目标在 `fuzz/`：

```bash
cd fuzz
cargo +nightly fuzz run envelope_decode -- -max_total_time=60
cargo +nightly fuzz run frame_reassemble -- -max_total_time=60
cargo +nightly fuzz run qr_scan -- -max_total_time=60
cargo +nightly fuzz run lan_datagram -- -max_total_time=60
```

## 相关仓库

- 使用二维码与组播发现的核心库：[Qualia2FA-Core](/repos/core/)
- 对外暴露局域网数据面：[Qualia2FA-FFI](/repos/ffi/)

## 许可证

LGPL-3.0-or-later，见仓库里的 `LICENSE` 与 `COPYING.LESSER`。选择 LGPL 是刻意的：本库解析的是攻击者可控的输入（扫到的文本、导入的图片、同网段上任何人发来的报文），任何修改都应当以源码形式回馈，以便被审计。
