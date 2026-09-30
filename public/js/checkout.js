/**
 * KryonHost Universal Manual Checkout & UPI QR Flow
 * Multi-step modal: 1. Details -> 2. Scanner & QR -> 3. Payment Verification -> 4. Confirmation
 */

(function() {
  const CHECKOUT_CSS = `
  .kryon-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 4, 8, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 16px;
    opacity: 0;
    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .kryon-modal-overlay.active {
    display: flex;
    opacity: 1;
  }
  .kryon-checkout-card {
    background: #0d0c15;
    border: 1px solid rgba(124, 106, 255, 0.25);
    border-radius: 20px;
    width: 100%;
    max-width: 520px;
    max-height: 92vh;
    overflow-y: auto;
    box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.9), 0 0 40px rgba(124, 106, 255, 0.12);
    position: relative;
    color: #fafafa;
    font-family: 'Inter', -apple-system, sans-serif;
  }
  
  /* Header */
  .checkout-header {
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #121120;
    border-radius: 20px 20px 0 0;
  }
  .checkout-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .checkout-brand-logo {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    object-fit: contain;
  }
  .checkout-title {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #fff;
  }
  .checkout-close-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.15s;
  }
  .checkout-close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* Multi-Step Progress Stepper */
  .kco-stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 28px;
    background: #0a0912;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .kco-step-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    font-weight: 600;
    color: #6b7280;
    transition: 0.2s;
  }
  .kco-step-item.active {
    color: #a78bfa;
  }
  .kco-step-item.completed {
    color: #34d399;
  }
  .kco-dot {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #181726;
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: #9ca3af;
    font-family: 'DM Mono', monospace;
  }
  .kco-step-item.active .kco-dot {
    background: #7c6aff;
    border-color: #7c6aff;
    color: #fff;
    box-shadow: 0 0 10px rgba(124, 106, 255, 0.5);
  }
  .kco-step-item.completed .kco-dot {
    background: #10b981;
    border-color: #10b981;
    color: #fff;
  }
  .kco-step-divider {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 8px;
  }

  .checkout-body {
    padding: 22px 24px;
  }
  .checkout-step {
    display: none;
    animation: kcoFadeIn 0.2s ease forwards;
  }
  .checkout-step.active {
    display: block;
  }
  @keyframes kcoFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Order Summary Box */
  .checkout-order-summary {
    background: #141322;
    border: 1px solid rgba(124, 106, 255, 0.2);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 18px;
  }
  .cos-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .cos-row:last-child {
    margin-bottom: 0;
    padding-top: 8px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
  }
  .cos-label {
    font-size: 0.8rem;
    color: #9ca3af;
  }
  .cos-val {
    font-size: 0.84rem;
    font-weight: 600;
    color: #fff;
  }
  .cos-val.highlight {
    font-size: 1.15rem;
    font-weight: 800;
    color: #22c55e;
    font-family: 'DM Mono', monospace;
  }

  /* Form Elements */
  .form-group {
    margin-bottom: 14px;
  }
  .form-label {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    color: #d1d5db;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }
  .form-input, .form-select {
    width: 100%;
    padding: 10px 14px;
    background: #141322;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #fff;
    font-size: 0.88rem;
    outline: none;
    transition: 0.2s;
    box-sizing: border-box;
  }
  .form-input:focus, .form-select:focus {
    border-color: #7c6aff;
    background: #171629;
    box-shadow: 0 0 0 3px rgba(124, 106, 255, 0.18);
  }

  /* Buttons */
  .btn-checkout-primary {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #7c6aff 0%, #5e4ae3 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: 0.2s;
    box-shadow: 0 4px 14px rgba(124, 106, 255, 0.35);
  }
  .btn-checkout-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .btn-checkout-success {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: 0.2s;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
  }
  .btn-checkout-success:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .btn-kco-back {
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 0.78rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 0;
    transition: 0.15s;
    text-decoration: none;
  }
  .btn-kco-back:hover {
    color: #fff;
  }
  
  /* QR & Timer Screen */
  .timer-banner {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .timer-clock {
    font-family: 'DM Mono', monospace;
    font-size: 1.15rem;
    font-weight: 800;
    color: #f59e0b;
    letter-spacing: 0.05em;
  }
  .qr-box-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    border-radius: 14px;
    padding: 14px;
    width: fit-content;
    margin: 0 auto 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .qr-image {
    width: 185px;
    height: 185px;
    display: block;
    image-rendering: pixelated;
  }
  .upi-id-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #141322;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 12px;
    font-family: 'DM Mono', monospace;
    font-size: 0.84rem;
    color: #38bdf8;
    margin-bottom: 14px;
    justify-content: space-between;
  }
  .copy-upi-btn {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 0.72rem;
    cursor: pointer;
    font-weight: 600;
  }
  .copy-upi-btn:hover {
    background: rgba(56, 189, 248, 0.25);
  }
  .upi-apps-icons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
    font-size: 0.72rem;
    color: #9ca3af;
  }
  .app-tag {
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.7rem;
    font-weight: 500;
    color: #d1d5db;
  }

  /* Screenshot Upload Area */
  .screenshot-upload-wrap {
    position: relative;
    background: #141322;
    border: 1px dashed rgba(124, 106, 255, 0.35);
    border-radius: 10px;
    padding: 14px;
    text-align: center;
    cursor: pointer;
    transition: 0.2s;
  }
  .screenshot-upload-wrap:hover {
    border-color: #7c6aff;
    background: #171628;
  }

  /* Confirmation Step */
  .pending-card {
    text-align: center;
    padding: 16px 8px;
  }
  .pending-icon-ring {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(245, 158, 11, 0.15);
    border: 2px solid rgba(245, 158, 11, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px;
    color: #f59e0b;
  }
  `;

  // Inject Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = CHECKOUT_CSS;
  document.head.appendChild(styleEl);

  // Modal HTML Template with Stepper & Clean Scanner Screen
  const MODAL_HTML = `
  <div class="kryon-modal-overlay" id="kryon-checkout-modal">
    <div class="kryon-checkout-card">
      
      <!-- Header -->
      <div class="checkout-header">
        <div class="checkout-title-wrap">
          <img src="/images/logo.jpg" alt="KryonHost" class="checkout-brand-logo">
          <span class="checkout-title" id="kco-header-title">Order Cloud Infrastructure</span>
        </div>
        <button class="checkout-close-btn" onclick="KryonCheckout.close()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- 4-Step Progress Stepper -->
      <div class="kco-stepper">
        <div class="kco-step-item active" id="kco-step-ind-1">
          <div class="kco-dot">1</div>
          <span>Config</span>
        </div>
        <div class="kco-step-divider"></div>
        <div class="kco-step-item" id="kco-step-ind-2">
          <div class="kco-dot">2</div>
          <span>UPI QR</span>
        </div>
        <div class="kco-step-divider"></div>
        <div class="kco-step-item" id="kco-step-ind-3">
          <div class="kco-dot">3</div>
          <span>Verify</span>
        </div>
        <div class="kco-step-divider"></div>
        <div class="kco-step-item" id="kco-step-ind-4">
          <div class="kco-dot">4</div>
          <span>Done</span>
        </div>
      </div>

      <div class="checkout-body">
        
        <!-- ═══════════════════════════════════════════════════════════════════
             STEP 1: CONFIGURATION & CUSTOMER DETAILS
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="checkout-step active" id="kco-step-1">
          <div class="checkout-order-summary">
            <div class="cos-row">
              <span class="cos-label">Selected Plan</span>
              <span class="cos-val" id="kco-sum-plan">PWR Extreme (5.7GHz)</span>
            </div>
            <div class="cos-row">
              <span class="cos-label">Hardware Specs</span>
              <span class="cos-val" id="kco-sum-specs">4 vCPU · 8GB RAM · 80GB NVMe</span>
            </div>
            <div class="cos-row">
              <span class="cos-label">Datacenter Region</span>
              <span class="cos-val" id="kco-sum-region">India (Mumbai Tier-4)</span>
            </div>
            <div class="cos-row">
              <span class="cos-label">Payable Amount</span>
              <span class="cos-val highlight" id="kco-sum-price">₹1,499</span>
            </div>
          </div>

          <form id="kco-details-form" onsubmit="event.preventDefault(); KryonCheckout.proceedToBilling();">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" class="form-input" id="kco-input-name" placeholder="Tejas Jha" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address (for dashboard login & credentials) *</label>
              <input type="email" class="form-input" id="kco-input-email" placeholder="client@example.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp Number (Optional for order alerts)</label>
              <input type="tel" class="form-input" id="kco-input-phone" placeholder="+91 98765 43210">
            </div>
            <div class="form-group">
              <label class="form-label">Server Hostname / Alias</label>
              <input type="text" class="form-input" id="kco-input-alias" placeholder="srv-production-node">
            </div>
            <div class="form-group">
              <label class="form-label">Operating System / Version</label>
              <select class="form-select" id="kco-input-os">
                <option value="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS (Recommended)</option>
                <option value="Debian 12 Bookworm">Debian 12 Bookworm</option>
                <option value="Alpine Linux 3.20">Alpine Linux 3.20 (Minimal)</option>
                <option value="Paper 1.21.1">Paper 1.21.1 (Minecraft)</option>
                <option value="Purpur 1.21.1">Purpur 1.21.1 (Minecraft High-Perf)</option>
                <option value="Fabric 1.21.1">Fabric 1.21.1</option>
                <option value="Forge 1.20.1">Forge 1.20.1</option>
                <option value="Windows Server 2022">Windows Server 2022</option>
              </select>
            </div>

            <div id="kco-error-1" style="color:#ef4444; font-size:0.82rem; margin-bottom:12px; display:none;"></div>

            <button type="submit" class="btn-checkout-primary" id="kco-btn-step1">
              Proceed to UPI Payment
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </form>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             STEP 2: SCANNER & UPI QR SCREEN (FOCUSED & CLEAN)
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="checkout-step" id="kco-step-2">
          <div class="timer-banner">
            <div style="display:flex; align-items:center; gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style="font-size:0.82rem; color:#d1d5db;">Payment Window:</span>
            </div>
            <div class="timer-clock" id="kco-timer-display">05:00</div>
          </div>

          <div class="checkout-order-summary" style="margin-bottom:14px; padding:10px 14px;">
            <div class="cos-row">
              <span class="cos-label">Order Invoice</span>
              <span class="cos-val" style="font-family:'DM Mono',monospace; color:#38bdf8;" id="kco-invoice-id">#KRYON-ORD-00000</span>
            </div>
            <div class="cos-row">
              <span class="cos-label">Total Payable</span>
              <span class="cos-val highlight" id="kco-invoice-price">₹1,499</span>
            </div>
          </div>

          <!-- White QR Code Container -->
          <div class="qr-box-wrap">
            <img src="" alt="Scan UPI QR" class="qr-image" id="kco-qr-img">
            <div style="margin-top:6px; font-size:0.7rem; color:#111; font-weight:800; letter-spacing:0.04em;">SCAN TO PAY VIA ANY UPI APP</div>
          </div>

          <!-- UPI ID Copy Bar -->
          <div class="upi-id-pill">
            <span>UPI ID: <strong style="color:#fff;" id="kco-upi-id-text">8750287172@fam</strong></span>
            <button type="button" class="copy-upi-btn" onclick="KryonCheckout.copyUpiId()">Copy UPI</button>
          </div>

          <div class="upi-apps-icons">
            <span>Supported:</span>
            <span class="app-tag">Google Pay</span>
            <span class="app-tag">PhonePe</span>
            <span class="app-tag">Paytm</span>
            <span class="app-tag">CRED / BHIM</span>
          </div>

          <!-- ONLY ONE Prominent Action Button on Scanner Screen -->
          <button type="button" class="btn-checkout-success" onclick="KryonCheckout.showStep(3)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            I Have Completed The Payment
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>

          <div style="text-align:center; margin-top:10px;">
            <button type="button" class="btn-kco-back" onclick="KryonCheckout.showStep(1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Configuration
            </button>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             STEP 3: PAYMENT VERIFICATION FORM (SEPARATE PAGE)
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="checkout-step" id="kco-step-3">
          <div style="background:#141322; border:1px solid rgba(124,106,255,0.25); border-radius:12px; padding:12px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; color:#9ca3af;">Verifying Payment For</div>
              <div style="font-weight:700; font-size:0.92rem; color:#38bdf8;" id="kco-verify-order-id">#KRYON-ORD-00000</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.75rem; color:#9ca3af;">Amount Transferred</div>
              <div style="font-weight:800; font-size:1.1rem; color:#22c55e; font-family:'DM Mono',monospace;" id="kco-verify-price">₹1,499</div>
            </div>
          </div>

          <form id="kco-verify-form" onsubmit="event.preventDefault(); KryonCheckout.submitPaymentProof();">
            
            <!-- Sender UPI ID -->
            <div class="form-group">
              <label class="form-label">Your UPI ID (The ID you sent payment from) *</label>
              <input type="text" class="form-input" id="kco-input-sender-upi" placeholder="e.g. user@okhdfcbank or 9876543210@paytm" required style="font-family:'DM Mono',monospace; font-size:0.88rem;">
            </div>

            <!-- 12-Digit UTR Number -->
            <div class="form-group">
              <label class="form-label">12-Digit UPI Transaction / UTR Ref Number *</label>
              <input type="text" class="form-input" id="kco-input-utr" placeholder="e.g. 427189012345" required maxlength="24" style="font-family:'DM Mono',monospace; letter-spacing:0.08em; font-size:0.95rem; text-align:center;">
            </div>

            <!-- Screenshot File Upload -->
            <div class="form-group">
              <label class="form-label">Payment Screenshot / Receipt *</label>
              <div class="screenshot-upload-wrap" onclick="document.getElementById('kco-input-screenshot').click()">
                <input type="file" id="kco-input-screenshot" accept="image/*" style="display:none;" onchange="KryonCheckout.handleScreenshotSelect(event)">
                <div id="kco-screenshot-placeholder" style="display:flex; flex-direction:column; align-items:center; gap:6px; color:#9ca3af; font-size:0.8rem;">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7c6aff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span><strong style="color:#a78bfa;">Click to attach payment receipt</strong> (PNG, JPG)</span>
                </div>
                <div id="kco-screenshot-preview-wrap" style="display:none; align-items:center; justify-content:center; gap:12px;">
                  <img id="kco-screenshot-preview" src="" style="max-height:75px; max-width:110px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); object-fit:contain;">
                  <div style="text-align:left; font-size:0.78rem; color:#34d399;">
                    <div style="font-weight:700;">✓ Screenshot Attached</div>
                    <div id="kco-screenshot-name" style="color:#9ca3af; font-family:'DM Mono',monospace; font-size:0.72rem;">receipt.png</div>
                    <span style="color:#ef4444; cursor:pointer; text-decoration:underline; font-size:0.72rem;" onclick="event.stopPropagation(); KryonCheckout.removeScreenshot();">Remove / Change</span>
                  </div>
                </div>
              </div>
            </div>

            <div id="kco-error-2" style="color:#ef4444; font-size:0.82rem; margin-bottom:12px; display:none;"></div>

            <button type="submit" class="btn-checkout-success" id="kco-btn-submit-pay">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Submit Payment Verification
            </button>
          </form>

          <div style="text-align:center; margin-top:10px;">
            <button type="button" class="btn-kco-back" onclick="KryonCheckout.showStep(2)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back to QR Scanner
            </button>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             STEP 4: SUBMITTED / PENDING ADMIN VERIFICATION
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="checkout-step" id="kco-step-4">
          <div class="pending-card">
            <div class="pending-icon-ring">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3 style="font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:6px;">Payment Proof Submitted!</h3>
            <p style="font-size:0.82rem; color:#9ca3af; margin-bottom:16px; line-height:1.5;">
              Order <strong style="color:#38bdf8;" id="kco-done-ord-id">#KRYON-ORD-00000</strong> has been queued for verification. Our NOC team will verify your transfer and activate your instance in your dashboard.
            </p>

            <div style="background:#141322; border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:12px; margin-bottom:18px; text-align:left; font-size:0.8rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#9ca3af;">Status:</span>
                <span style="color:#f59e0b; font-weight:700;">● Pending Admin Approval</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#9ca3af;">Client Email:</span>
                <span style="color:#fff;" id="kco-done-email">client@example.com</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#9ca3af;">Sender UPI ID:</span>
                <span style="color:#a78bfa; font-family:'DM Mono',monospace;" id="kco-done-sender-upi">user@upi</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#9ca3af;">UTR Number:</span>
                <span style="color:#38bdf8; font-family:'DM Mono',monospace;" id="kco-done-utr">427189012345</span>
              </div>
            </div>

            <button class="btn-checkout-primary" onclick="KryonCheckout.goToDashboard()">
              Open My Dashboard
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
  `;

  // Inject Modal to DOM once ready
  function initModalDom() {
    if (!document.getElementById('kryon-checkout-modal')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = MODAL_HTML;
      document.body.appendChild(wrapper.firstElementChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModalDom);
  } else {
    initModalDom();
  }

  // State
  let currentOrder = null;
  let timerInterval = null;
  let timerSecondsLeft = 300; // 5 minutes
  let screenshotBase64 = null;
  let screenshotUploadedUrl = null;
  let screenshotFileName = null;

  window.KryonCheckout = {
    /**
     * Open Checkout for given plan
     */
    open: function(planConfig = {}) {
      initModalDom();
      const modal = document.getElementById('kryon-checkout-modal');
      
      const price = Number(planConfig.price) || 999;
      const name = planConfig.name || 'Cloud VPS Instance';
      const type = planConfig.type || 'vps';
      const cpu = planConfig.cpu || 2;
      const ram = planConfig.ram || 4;
      const disk = planConfig.disk || 40;
      const region = planConfig.region || 'India (Mumbai Tier-4)';

      currentOrder = {
        plan_name: name,
        service_type: type,
        amount: price,
        specs: {
          cpu,
          ram,
          disk,
          tier: planConfig.tier || 'std',
          region: region
        }
      };

      // Populate Step 1 UI
      document.getElementById('kco-sum-plan').textContent = name;
      document.getElementById('kco-sum-specs').textContent = `${cpu} vCPU · ${ram}GB RAM · ${disk}GB NVMe`;
      document.getElementById('kco-sum-region').textContent = region;
      document.getElementById('kco-sum-price').textContent = `₹${price.toLocaleString('en-IN')}`;
      
      // Reset errors & fields
      document.getElementById('kco-error-1').style.display = 'none';
      document.getElementById('kco-error-2').style.display = 'none';
      const utrInput = document.getElementById('kco-input-utr');
      if (utrInput) utrInput.value = '';
      const senderUpiInput = document.getElementById('kco-input-sender-upi');
      if (senderUpiInput) senderUpiInput.value = '';
      this.removeScreenshot();

      // Switch to Step 1
      this.showStep(1);
      modal.classList.add('active');
    },

    close: function() {
      const modal = document.getElementById('kryon-checkout-modal');
      if (modal) modal.classList.remove('active');
      if (timerInterval) clearInterval(timerInterval);
    },

    showStep: function(stepNum) {
      document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(`kco-step-${stepNum}`);
      if (target) target.classList.add('active');

      // Update Stepper Dots
      for (let i = 1; i <= 4; i++) {
        const ind = document.getElementById(`kco-step-ind-${i}`);
        if (ind) {
          ind.classList.remove('active', 'completed');
          if (i === stepNum) ind.classList.add('active');
          else if (i < stepNum) ind.classList.add('completed');
        }
      }

      const titleEl = document.getElementById('kco-header-title');
      if (stepNum === 1) titleEl.textContent = 'Configure & Deploy';
      else if (stepNum === 2) titleEl.textContent = 'Scan UPI QR Code';
      else if (stepNum === 3) titleEl.textContent = 'Verify Payment Transfer';
      else if (stepNum === 4) titleEl.textContent = 'Order Under Review';
    },

    handleScreenshotSelect: function(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      screenshotFileName = file.name;
      const reader = new FileReader();

      reader.onload = function(e) {
        const rawBase64 = e.target.result;
        
        // Resize and compress via canvas to max 1000px and JPEG quality 0.75
        const img = new Image();
        img.onload = async function() {
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          screenshotBase64 = canvas.toDataURL('image/jpeg', 0.75);

          // Show preview
          const previewImg = document.getElementById('kco-screenshot-preview');
          const previewWrap = document.getElementById('kco-screenshot-preview-wrap');
          const placeholder = document.getElementById('kco-screenshot-placeholder');
          const nameEl = document.getElementById('kco-screenshot-name');

          if (previewImg) previewImg.src = screenshotBase64;
          if (nameEl) nameEl.textContent = file.name;
          if (placeholder) placeholder.style.display = 'none';
          if (previewWrap) previewWrap.style.display = 'flex';

          // Upload lightweight image to SDX bucket in background
          try {
            const cleanBase64 = screenshotBase64.split(',')[1] || screenshotBase64;
            const uploadRes = await fetch('/api/v1/storage/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: `proof_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}.jpg`,
                base64: cleanBase64,
                contentType: 'image/jpeg'
              })
            });
            const uploadJson = await uploadRes.json();
            if (uploadJson.success && uploadJson.object?.url) {
              screenshotUploadedUrl = uploadJson.object.url;
            }
          } catch (uploadErr) {
            console.warn('[Screenshot upload warning]:', uploadErr);
          }
        };
        img.src = rawBase64;
      };

      reader.readAsDataURL(file);
    },

    removeScreenshot: function() {
      screenshotBase64 = null;
      screenshotUploadedUrl = null;
      screenshotFileName = null;
      
      const fileInput = document.getElementById('kco-input-screenshot');
      if (fileInput) fileInput.value = '';
      
      const previewImg = document.getElementById('kco-screenshot-preview');
      if (previewImg) previewImg.src = '';
      
      const previewWrap = document.getElementById('kco-screenshot-preview-wrap');
      if (previewWrap) previewWrap.style.display = 'none';
      
      const placeholder = document.getElementById('kco-screenshot-placeholder');
      if (placeholder) placeholder.style.display = 'flex';
    },

    proceedToBilling: async function() {
      const name = document.getElementById('kco-input-name').value.trim();
      const email = document.getElementById('kco-input-email').value.trim();
      const phone = document.getElementById('kco-input-phone').value.trim();
      const alias = document.getElementById('kco-input-alias').value.trim() || `${currentOrder.plan_name} (${name})`;
      const os = document.getElementById('kco-input-os').value;

      const errEl = document.getElementById('kco-error-1');
      if (!name || !email) {
        errEl.textContent = 'Please provide both your full name and email address.';
        errEl.style.display = 'block';
        return;
      }

      currentOrder.customer_name = name;
      currentOrder.customer_email = email;
      currentOrder.customer_phone = phone;
      currentOrder.specs.server_name = alias;
      currentOrder.specs.os = os;

      const btn = document.getElementById('kco-btn-step1');
      btn.disabled = true;
      btn.innerHTML = 'Generating Billing Invoice...';

      try {
        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentOrder)
        });
        const json = await res.json();

        btn.disabled = false;
        btn.innerHTML = `Proceed to UPI Payment <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;

        if (!json.success || !json.data) {
          errEl.textContent = json.error || 'Failed to initialize order. Please try again.';
          errEl.style.display = 'block';
          return;
        }

        currentOrder = json.data;

        // Populate Step 2 (QR Scanner)
        document.getElementById('kco-invoice-id').textContent = `#${currentOrder.id}`;
        document.getElementById('kco-invoice-price').textContent = `₹${currentOrder.amount.toLocaleString('en-IN')}`;
        
        // Populate Step 3 (Verification Form summary)
        document.getElementById('kco-verify-order-id').textContent = `#${currentOrder.id}`;
        document.getElementById('kco-verify-price').textContent = `₹${currentOrder.amount.toLocaleString('en-IN')}`;

        const upiId = currentOrder.upi_id || '8750287172@fam';
        document.getElementById('kco-upi-id-text').textContent = upiId;

        // Use User's exact UPI QR Code image
        document.getElementById('kco-qr-img').src = currentOrder.qr_image_url || '/images/upi-qr.png';

        // Start 5-minute timer
        this.startTimer(300);
        this.showStep(2);

      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `Proceed to UPI Payment <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
        errEl.textContent = 'Connection error: ' + err.message;
        errEl.style.display = 'block';
      }
    },

    startTimer: function(durationSeconds) {
      if (timerInterval) clearInterval(timerInterval);
      timerSecondsLeft = durationSeconds;
      
      const display = document.getElementById('kco-timer-display');
      
      const updateDisplay = () => {
        const mins = Math.floor(timerSecondsLeft / 60);
        const secs = timerSecondsLeft % 60;
        display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        if (timerSecondsLeft <= 0) {
          clearInterval(timerInterval);
          display.textContent = 'EXPIRED';
          display.style.color = '#ef4444';
        }
        timerSecondsLeft--;
      };

      updateDisplay();
      timerInterval = setInterval(updateDisplay, 1000);
    },

    copyUpiId: function() {
      const upi = document.getElementById('kco-upi-id-text').textContent;
      navigator.clipboard.writeText(upi);
      alert('UPI ID copied to clipboard: ' + upi);
    },

    submitPaymentProof: async function() {
      const utr = document.getElementById('kco-input-utr').value.trim();
      const senderUpi = document.getElementById('kco-input-sender-upi').value.trim();
      const errEl = document.getElementById('kco-error-2');

      if (!senderUpi || senderUpi.length < 3) {
        errEl.textContent = 'Please enter the UPI ID you sent the payment from.';
        errEl.style.display = 'block';
        return;
      }

      if (!utr || utr.length < 4) {
        errEl.textContent = 'Please enter a valid UPI transaction reference / UTR number.';
        errEl.style.display = 'block';
        return;
      }

      const btn = document.getElementById('kco-btn-submit-pay');
      btn.disabled = true;
      btn.innerHTML = 'Submitting Payment Proof...';

      try {
        const payload = {
          utr_number: utr,
          sender_upi_id: senderUpi,
          screenshot_url: screenshotUploadedUrl || null,
          screenshot_data: screenshotBase64 || null,
          order_backup: currentOrder
        };

        const res = await fetch(`/api/orders/${currentOrder.id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();

        btn.disabled = false;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Submit Payment Verification`;

        if (!json.success) {
          errEl.textContent = json.error || 'Submission failed. Please try again.';
          errEl.style.display = 'block';
          return;
        }

        if (timerInterval) clearInterval(timerInterval);

        // Populate Step 4 (Confirmation)
        document.getElementById('kco-done-ord-id').textContent = `#${currentOrder.id}`;
        document.getElementById('kco-done-email').textContent = currentOrder.customer_email;
        document.getElementById('kco-done-sender-upi').textContent = senderUpi;
        document.getElementById('kco-done-utr').textContent = utr;

        // Save email in localStorage for panel auto-lookup
        localStorage.setItem('kryon_customer_email', currentOrder.customer_email);

        this.showStep(4);

      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Submit Payment Verification`;
        errEl.textContent = 'Error: ' + err.message;
        errEl.style.display = 'block';
      }
    },

    goToDashboard: function() {
      window.location.href = `/panel?email=${encodeURIComponent(currentOrder.customer_email)}&order=${encodeURIComponent(currentOrder.id)}`;
    }
  };
})();
