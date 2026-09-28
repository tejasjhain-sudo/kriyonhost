# EnderHost — Enterprise Cloud VPS & Minecraft Hosting Platform

A high-performance cloud hosting platform powered by **Shulker Cloud** wholesale infrastructure with a custom-engineered pricing engine, dynamic reseller margins, and a built-in browser-based VPS Control Center.

---

## ⚡ Quick Start

```bash
# 1. Clone / Navigate to workspace
cd /Users/tejas/Desktop/enderhost

# 2. Install dependencies
npm install

# 3. Start the platform
npm start
```
The application will launch at **`http://localhost:3000`**.

---

## 💎 Pricing Tiers & Reseller Margin Engine

All prices are calculated on a **30-day billing cycle** with a **flat ₹150 IP charge** per server. VPS and Minecraft server hosting are sold at the **same price** with full hardware parity.

### Wholesale Cost Structure (Shulker Cloud Base)

| Tier | Hardware Node | vCPU / core | RAM / GB | NVMe / GB | Flat IPv4 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ECO** | Intel Xeon E5 · Budget | ₹16 / mo | ₹26 / mo | ₹0.26 / mo | ₹150 / mo |
| **STD** | AMD EPYC 7003 · Balanced | ₹26 / mo | ₹37 / mo | ₹0.37 / mo | ₹150 / mo |
| **PERF** | Intel Core i7 (4.8GHz Turbo) | ₹42 / mo | ₹53 / mo | ₹0.53 / mo | ₹150 / mo |
| **PWR** | AMD Ryzen 9 7950X (5.7GHz Beast) | ₹58 / mo | ₹74 / mo | ₹0.79 / mo | ₹150 / mo |

$$\text{Wholesale Cost} = (\text{vCPU} \times \text{Rate}_{\text{CPU}}) + (\text{RAM} \times \text{Rate}_{\text{RAM}}) + (\text{Disk} \times \text{Rate}_{\text{Disk}}) + ₹150$$

**Example:**
STD VPS (4 vCPU, 8 GB RAM, 100 GB NVMe Disk):
$$(4 \times ₹26) + (8 \times ₹37) + (100 \times ₹0.37) + ₹150 = ₹104 + ₹296 + ₹37 + ₹150 = \mathbf{₹587.00/mo}$$

---

### Configured EnderHost Profit Margins

| Base Wholesale Range | Your EnderHost Profit Margin | Example Tier & Specs | Wholesale | EnderHost Retail Price |
| :--- | :--- | :--- | :--- | :--- |
| **< ₹1,000** | **+₹200 to ₹300** *(Default: ₹260)* | STD 4 vCPU + 8GB RAM + 100GB Disk | ₹587.00 | **₹847.00** |
| **₹1,000 – ₹2,000** | **+₹350 to ₹500** *(Default: ₹420)* | PERF 6 vCPU + 16GB RAM + 120GB Disk | ₹1,329.50 | **₹1,749.00** |
| **₹2,000 – ₹3,000** | **+₹500 to ₹600** *(Default: ₹580)* | PWR 6 vCPU + 24GB RAM + 200GB Disk | ₹2,432.00 | **₹3,012.00** |
| **₹3,000 – ₹4,000** | **+₹1,000 to ₹1,200** *(Default: ₹1,100)* | PWR 8 vCPU + 32GB RAM + 250GB Disk | ₹2,869.50 | **₹3,969.00** |
| **> ₹4,000** | **~30% Margin** | PWR 16 vCPU + 64GB RAM + 500GB Disk | ₹5,909.00 | **₹7,682.00** |

---

## 🕹️ How Customers Control Their VPS From Your Website

```
[ Customer Browser ]
        │
        ▼ (Sends action: Start, Reboot, Stats, Snapshot)
[ EnderHost Server (Node.js/Express) ]
        │ 🔐 Injects secret reseller_token (ZgmjVUsY9orj1uRZ1EQzmuJ87)
        ▼ (HTTPS REST API)
[ Shulker Reseller Gateway (shulker.in/api/reseller-v1/) ]
        │ 💳 Deducts billing from Purple Wallet
        ▼ (Proxies command to physical host)
[ Bare-Metal Hypervisor Node (Mumbai / Delhi / Germany) ]
        │ ⚙️ QEMU / KVM process control & TAP metrics
        ▼
[ Customer's Virtual Machine (Ubuntu / Windows / Minecraft) ]
```

1. **Security**: The customer never sees the `reseller_token`. The client browser communicates with `/api/servers/:id/...` on EnderHost, which injects the token server-side.
2. **Power Controls**:
   - `action=start`: Boots VM, attaches dedicated IP, prepares SSH in ~15s.
   - `action=stop`: Sends ACPI graceful power down signal.
   - `action=reboot`: Warm reboot without host deallocation.
   - `action=force_stop`: Instant SIGKILL to virtual power supply.
   - `action=suspend`: SIGSTOP freeze (preserves all RAM state, zero CPU usage).
   - `action=resume`: Unfreeze VM instantly.
3. **Telemetry & Stats**:
   - `action=stats`: Streams host CPU %, RAM RSS (MB), QCOW2 actual disk size, and inbound/outbound Mbps over TAP interfaces.
4. **Interactive Console**:
   - `action=serial_log`: Streams the VM's serial output (kernel dmesg, systemd boot logs, cloud-init progress).
5. **Remote Display**:
   - `action=vnc_info`: Exposes raw VNC (port 5943) and HTML5 WebSocket (port 6043).
   - `action=rdp_info`: Automatic NAT port forwarding for Windows Remote Desktop (`in.shulker.in:PORT`).
6. **Snapshots & Disks**:
   - `action=snapshot_create`: Point-in-time QCOW2 offline snapshot.
   - `action=list_extra_disks`: Mount up to 8 additional volumes (`/dev/vdb` to `/dev/vdi`).

---

## 🛠️ File Structure

- [`.env`](file:///Users/tejas/Desktop/enderhost/.env): Stores server port and secret `RESELLER_TOKEN`.
- [`server.js`](file:///Users/tejas/Desktop/enderhost/server.js): Express backend API routes and static asset server.
- [`config/pricing.js`](file:///Users/tejas/Desktop/enderhost/config/pricing.js): Tier definitions, hardware clock rates, and margin algorithms.
- [`services/shulkerService.js`](file:///Users/tejas/Desktop/enderhost/services/shulkerService.js): Shulker Reseller API client wrapper with fallback resilience.
- [`public/index.html`](file:///Users/tejas/Desktop/enderhost/public/index.html): Modern dark-aesthetic website, interactive sliders, and control panel.
- [`public/css/style.css`](file:///Users/tejas/Desktop/enderhost/public/css/style.css): Dark glassmorphic design system matching Shulker aesthetics.
- [`public/js/app.js`](file:///Users/tejas/Desktop/enderhost/public/js/app.js): Real-time pricing calculator, live telemetry polling, and VM action handlers.
