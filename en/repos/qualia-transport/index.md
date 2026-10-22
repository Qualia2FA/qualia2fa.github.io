# Transport QualiaTransport

<div class="q-repo-head">
  <div class="q-repo-head__meta">
    <span class="q-pill">crate qualia-transport</span>
    <span class="q-pill q-pill--version">v0.1.6</span>
    <span class="q-pill">Rust 1.89+ / 1.91+ (iroh-lan)</span>
    <span class="q-pill">LGPL-3.0-or-later</span>
  </div>
  <div class="q-repo-head__links">
    <a href="https://github.com/Qualia2FA/QualiaTransport">GitHub</a>
    <a href="https://crates.io/crates/qualia-transport">crates.io</a>
    <a href="https://docs.rs/qualia-transport">docs.rs</a>
  </div>
</div>

Carries a sequence of bytes between two devices: **QR codes** (split across several codes when one is not enough) and **the local network** (discover each other on the same subnet, then transfer).

It generates no key material and knows nothing about Qualia2FA's vault format. QR encoding is deterministic; the multicast lobby only reads the endpoint public key and port the caller supplies. Randomness and keys inside a payload are the caller's responsibility.

## QR codes

```rust
use qualia_transport::qr::{EcLevel, QrProfile};

// Declare the channel's capability: medium error correction, up to version 20 (97x97 modules).
let profile = QrProfile::new(EcLevel::Medium, 20)?;

// One code when it fits; otherwise split into frames, with the user willing to scan 6.
// Running out of room fails here (with "needed" and "limit"), not once the user starts scanning.
let symbols = profile.encode_payload_frames(payload, 6)?;
println!("this exchange needs {} codes", symbols.len());

// The host draws the matrix through modules(); render() produces pixels.
let image = symbols[0].render(4, 4)?;

// The other way: read back **one frame** from a camera or an imported image and feed the reassembler.
let frame = qualia_transport::qr::scan::decode_frame(&image)?;
let mut reassembler = qualia_transport::frame::Reassembler::from_first_frame();
if let Some(payload) = reassembler.accept(frame)? {
    // complete
}
```

For content that is **not this library's envelope** (an `otpauth://` URI being exported, for example) use `encode_text`: it encodes the caller's text as-is, without the envelope, because other applications only understand their own spelling and an envelope would produce a code nobody can use. The error-correction level and **version ceiling** come from the caller, and running out of room reports `Error::TextTooLong`.

### Three capacity numbers, not to be confused

All are in **payload bytes**, but they cover different scopes:

| Method | Meaning |
|---|---|
| `QrProfile::payload_capacity()` | What **one** code holds (single frame, shortest header) |
| `QrProfile::frame_payload_capacity()` | What **each** code holds when framing (allowance for the longest header) |
| `QrProfile::exchange_capacity(n)` | What an exchange of at most n codes holds together |

The first two differ and cannot be substituted for each other: the header sits at the start of the envelope and its length grows with the **number of digits** in the frame count. `payload_capacity` is exactly the point where one more character would not fit, so slicing a payload that needs ten or more codes with it produces frames that cannot be rendered. `encode_payload_frames` picks the right capacity itself; the caller only says how many codes the user is willing to scan.

### Wire format

```text
Q2FA1:<frame>/<count>:<BASE32>
```

The prefix makes somebody else's QR code recognisable at a glance. Frame and count precede the payload, so a scanner knows which codes are still missing **without decrypting any frame**. A single frame is written `1/1`; multiple frames do not fork the format.

Base32 rather than Base64 is what keeps the string inside the QR alphanumeric mode: Base64's lower-case letters are not in that alphabet. It costs about 10% capacity and buys "every scanner reads back the same text".

## Local network

Multicast discovery needs no extra feature.

```rust
use qualia_transport::lan::lobby::Lobby;
use qualia_transport::lan::{LanAddress, LanAddressScanner};
use qualia_transport::qr::{EcLevel, QrProfile};

// Open the lobby: periodically announce "I am here, this is my endpoint key and port"
// into a multicast group, and listen to others.
let mut lobby = Lobby::open(my_device_id, my_endpoint_key, my_port)?;

// Drain the backlog on each interface refresh.
while let Some(event) = lobby.try_poll() {
    println!("{:?} is now {:?} at {:?}", event.peer.device, event.peer.status, event.peer.source);
}

// Across subnets (where multicast does not reach), carry the connection record out of band.
let address = LanAddress::new(my_endpoint_key, my_port);

// Presenter: the record is a 42-byte payload handed to the QR half for rendering.
let profile = QrProfile::new(EcLevel::Low, 10)?;
let symbols = address.to_qr_symbols(&profile, 4)?;

// Scanner: feed every text the camera reads. Any order and repeated scans are fine.
let mut scanner = LanAddressScanner::new();
if let Some(address) = scanner.push(scanned_text)? {
    // Dial it: the endpoint key and port come from here.
}
```

### Two contracts

- **Discovery may be unauthenticated; credentials must come from the channel.** A multicast group is shared media, and any machine on the subnet can inject arbitrary bytes, including "I am device X". Announcements are therefore **unsigned**: they only answer "who is probably on this subnet and where do I find them". "Is it really that device" is answered by the handshake when a connection is established.
- **The online format carries the sender's device ID.** The transport knows only the endpoint public key, while the upper layer wants the device ID. The mapping between them comes from unauthenticated announcements and therefore **cannot be trusted**: every message reports the sender's device ID so the receiver can apply its existing allow-list. The field is not for **establishing** trust, but for letting the receiver **apply** it.

### Data plane

Enable `iroh-lan` when the LAN data plane (QUIC transport) is needed:

```toml
[dependencies]
qualia-transport = { version = "0.1", features = ["iroh-lan"] }
```

Multicast discovery and QR codes do **not** need it; the feature only brings in the QUIC transport. Three notes: it significantly enlarges the dependency tree and build time; its minimum Rust version is **1.91** (iroh 1.3.0), above this crate's 1.89; and "does not use the network" currently means only "builds no relay, registers no DNS/pkarr, disables HTTPS probing" — packet-capture proof is not finished, so do not claim "this channel has been proven not to use the network".

## Interface

The crate root exports four modules: `qr`, `frame`, `envelope` and `lan`; `lan` splits into `lobby` (multicast discovery) and `transport` (the iroh data plane behind the `iroh-lan` feature). Full signatures are on [docs.rs](https://docs.rs/qualia-transport).

### QR codes (`qr`)

| Item | Notes |
|---|---|
| `EcLevel` | `Low` / `Medium` / `Quartile` / `High`; `letter`, `from_letter` |
| `QrProfile::new(ec, max_version)` | Declare the channel capability; computes both capacities by binary search |
| `payload_capacity()` / `frame_payload_capacity()` / `exchange_capacity(n)` | One code, one framed code, and an exchange of n codes |
| `encode_payload(payload)` / `encode_payload_frames(payload, max_frames)` | Single-frame and multi-frame encoding |
| `qr::encode_text(text, ec, max_version)` | Encode text as-is, without the envelope |
| `Symbol` | `version`, `ec_level`, `mask`, `size`, `modules`, `module(x, y)`, `render(scale, quiet_zone)` |
| `qr::scan::decode_text` / `decode_payload` / `decode_frame` | Decode text, a payload, or one frame from pixels |
| `GrayImage` | A grayscale pixel buffer; input is not an image file |

### Envelope and framing (`envelope`, `frame`)

| Item | Notes |
|---|---|
| `envelope::encode(payload)` / `decode(text)` | `Q2FA1:<frame>/<count>:<BASE32>` |
| `frame::encode_frames(payload, capacity)` | Split a payload at the given capacity |
| `Frame` / `frame::decode_frame(text)` | One frame and its parser |
| `Reassembler::new(capacity)` / `from_first_frame()` | Known capacity / learn it from the first frame |
| `Reassembler::push(text)` / `accept(frame)` | Any order, repeated scans allowed |
| `missing()` / `received()` / `expected_frames()` | Which codes are missing, how many arrived, how many in total |

### Local network (`lan`)

| Item | Notes |
|---|---|
| `LanAddress::new(endpoint_key, port)` | The 42-byte connection record |
| `encode` / `decode` / `to_qr_text` / `from_qr_text` | Fixed record and single-code text |
| `to_qr_symbols(profile, max_frames)` / `to_qr_frame_texts(...)` | Hand the record to the QR half |
| `LanAddressScanner::new()` / `push(text)` / `missing()` / `expected_codes()` | Reassemble a multi-code record |
| `Lobby::open(me, endpoint_key, port)` / `open_with(...)` | Start announcing and listening |
| `Lobby::try_poll()` / `poll(timeout)` / `announce_now()` / `shutdown()` / `view()` | Drain events, announce now, stop |
| `LanConfig` | Multicast group, port, TTL and interface; `interface` narrows the candidates |
| `Event` / `EventKind` / `Peer` / `PeerStatus` / `LanView` / `candidate_interfaces()` | Discovery results and interface enumeration |
| `IrohLan::open(device, secret_key)` / `open_with(...)` | Open the QUIC data plane (feature `iroh-lan`) |
| `remember_peer(PeerAddress)` / `forget_peer(device)` / `connected_peers()` | Register, forget, list peers |
| `send(Recipient, message)` / `send_blocking` / `try_receive` / `receive_timeout` | Directed or broadcast, non-blocking or timed receive |
| `shutdown()` | Stop the endpoint and runtime; idempotent |
| `Recipient` / `PeerAddress` / `ALPN` / `MAX_MESSAGE_LEN` / `INBOX_CAPACITY` | Recipients, dialable addresses and data-plane constants |

A lobby announcement is a fixed 84-byte datagram and a `LanAddress` is a fixed 42 bytes; multicast TTL is 1. Discovery is **not** authenticated; the handshake proves the real identity.

### Errors and contracts

- Every fallible API returns `Result<T, Error>`; `Error` is `#[non_exhaustive]`, so hosts must keep a fallback branch.
- Not fitting is an error carrying `needed` / `limit`, never an "almost fits" code.
- Reassembly checks shape only; authentication always sits in the payload's AEAD layer.
- QR and LAN wire formats are pure logic; only `Lobby` opens sockets, starts a thread and reads the clock.
- No input may panic; `#![forbid(unsafe_code)]` holds throughout.
- The library **generates no key material**: QR encoding is deterministic, and the lobby only reads the endpoint key and port the caller supplies.

## Design contracts

- **Not fitting is an error, not an approximation.** Exceeding the limit returns an error and never produces a code that is "almost" enough. The error carries `needed` and `limit`, so the caller can tell the user how much is missing.
- **Whatever can be encoded can be reassembled.** The framer produces an empty frame only for an empty payload; the reassembler accepts an empty frame only when there is exactly one code.
- **Reassembly checks shape, not authenticity.** "Every frame except the last has equal length" catches user-level mix-ups; real authentication always sits in the payload's AEAD layer.
- **The scanner does not know the capacity and must not assume it.** How many bytes a code holds is a property of the presenter's screen; the scanner uses `Reassembler::from_first_frame()` and learns the full length from the first frame it sees.
- **One payload has exactly one text representation.** Case, padding and non-zero trailing bits are normalised or rejected.
- **Input is pixels, not image files.** Image format decoding belongs to the platform (`ImageIO` on the JVM, `BitmapFactory` on Android, `UIImage` on iOS).
- **A panic inside the decoder does not take the process down.** `rqrr` has an `assert!` that a degenerate image can trigger; every call is wrapped in `catch_unwind`, turning the panic into `Error::QrDecoderPanicked`. This is containment, not a fix: the real fix is upstream, and it depends on unwinding.
- **A LAN announcement is a fixed 84-byte UDP datagram, and a connection record is a fixed 42 bytes.** Fixed sizes make the parser's shape "reject anything of the wrong length". Multicast TTL is fixed at 1.
- **Discovery runs on every candidate interface.** Whether an interface has neighbours is a broadcast-domain question, not a routing one: with VPN tunnels, VM bridges or container networks, picking one interface by route can join a group where nobody announces. Every candidate interface gets its own socket, joins the group, sends and listens. Use `LanConfig::interface` to narrow it.
- **Rosters and inboxes are bounded.** A device ID is public, so any machine on the subnet can invent unlimited "new devices" (84 bytes each). The peer list has a limit and drops the least active; a full inbox drops the oldest. The limits are a security property, not performance tuning.
- **Recipients are explicit.** A directed send must never degrade into a broadcast.
- **Pure logic, with one exception.** QR and LAN wire formats touch no filesystem, network, clock or environment variables; only the multicast lobby opens sockets, starts a background thread and reads the clock. `#![forbid(unsafe_code)]` holds throughout, and no input may panic — the only failure mode is an error.

## Integrating

```toml
[dependencies]
qualia-transport = "0.1"
```

A mobile host that uses the platform camera and never decodes an image can drop the whole image decoding chain by disabling the default feature:

```toml
[dependencies]
qualia-transport = { version = "0.1", default-features = false }
```

## Build and test

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

Both MSRVs are verified with real toolchains:

```bash
cargo +1.89 check --all-targets                        # default build floor
cargo +1.91 check --all-targets --features iroh-lan    # iroh-lan floor
```

The fuzz targets live in `fuzz/`:

```bash
cd fuzz
cargo +nightly fuzz run envelope_decode -- -max_total_time=60
cargo +nightly fuzz run frame_reassemble -- -max_total_time=60
cargo +nightly fuzz run qr_scan -- -max_total_time=60
cargo +nightly fuzz run lan_datagram -- -max_total_time=60
```

## Related repositories

- The core using QR and multicast discovery: [Qualia2FA-Core](/en/repos/core/)
- The layer exposing the LAN data plane: [Qualia2FA-FFI](/en/repos/ffi/)

## Licence

LGPL-3.0-or-later; see `LICENSE` and `COPYING.LESSER` in the repository. LGPL is deliberate: this library parses attacker-controlled input (scanned text, imported images, datagrams from anyone on the subnet), so any modification should come back as source and remain auditable.
