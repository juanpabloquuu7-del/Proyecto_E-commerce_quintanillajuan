/**
 * cart-drawer.component.js — Drawer Lateral del Carrito
 * ─────────────────────────────────────────────────────────────
 * Web Component con Shadow DOM que gestiona:
 * - Lista de ítems del carrito (CRUD completo)
 * - Control de cantidades con validación de stock
 * - Cupón de descuento
 * - Totales dinámicos (subtotal, descuento, envío, total)
 * - Animación de apertura/cierre lateral
 * - Persistencia automática vía store + storage
 * - Accesibilidad (focus trap, aria, keyboard)
 * ─────────────────────────────────────────────────────────────
 * Uso: <cart-drawer></cart-drawer>
 * Apertura: bus.emit(EVENTS.CART_OPEN)
 * ─────────────────────────────────────────────────────────────
 */

import bus, { EVENTS } from "../core/events.js";
import store from "../core/store.js";
import storage, { STORAGE_KEYS } from "../services/storage.service.js";

// ─── Constantes ───────────────────────────────────────────────

const SHIPPING_THRESHOLD = 200_000; // Envío gratis sobre este valor (COP)
const SHIPPING_COST = 15_000; // Costo de envío fijo (COP)
const COUPON_CODES = Object.freeze({
  LUMIERE10: 10,
  LUMIERE20: 20,
  FASHION15: 15,
  WELCOME25: 25,
});

// ─── Estilos Shadow DOM ───────────────────────────────────────

const STYLES = /* css */ `
  :host {
    --drawer-w:       380px;
    --primary:        #1a1a2e;
    --primary-dark:   #0f0f1a;
    --accent:         #c9a96e;
    --accent-light:   #dbbf8a;
    --cream:          #faf8f5;
    --gray-50:        #f9f9f9;
    --gray-100:       #f0eeeb;
    --gray-200:       #e2ddd7;
    --gray-300:       #c8c2ba;
    --gray-400:       #a09890;
    --gray-500:       #7a7168;
    --gray-600:       #5c544d;
    --error:          #b83232;
    --error-light:    #fdeaea;
    --success:        #2d7a4f;
    --success-light:  #e8f5ee;
    --font-display:   'Cormorant Garamond', Georgia, serif;
    --font-body:      'DM Sans', system-ui, sans-serif;
    --ease:           cubic-bezier(0.4, 0, 0.2, 1);
    --ease-out:       cubic-bezier(0, 0, 0.2, 1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Backdrop ── */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26,26,46,.6);
    backdrop-filter: blur(2px);
    z-index: 400;
    opacity: 0;
    visibility: hidden;
    transition: opacity 350ms var(--ease), visibility 350ms var(--ease);
  }

  .backdrop.open {
    opacity: 1;
    visibility: visible;
  }

  /* ── Drawer panel ── */
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--drawer-w);
    max-width: 96vw;
    background: #fff;
    z-index: 401;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 380ms var(--ease);
    will-change: transform;
    box-shadow: -8px 0 40px rgba(26,22,16,.14);
  }

  .drawer.open {
    transform: translateX(0);
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--gray-200);
    flex-shrink: 0;
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 400;
    letter-spacing: -.01em;
    color: var(--primary);
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    background: var(--accent);
    color: var(--primary);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 700;
    border-radius: 99px;
    line-height: 1;
    transition: transform 300ms cubic-bezier(0.34,1.56,0.64,1),
                background 200ms;
  }

  .count-badge.bump {
    animation: bump 400ms cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes bump {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.5); }
    100% { transform: scale(1); }
  }

  .btn-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: none;
    border: 1px solid var(--gray-200);
    border-radius: 50%;
    cursor: pointer;
    color: var(--gray-500);
    transition: color 200ms, border-color 200ms, background 200ms;
  }

  .btn-close:hover {
    color: var(--primary);
    border-color: var(--primary);
    background: var(--gray-100);
  }

  .btn-close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ── Barra envío gratis ── */
  .shipping-bar {
    padding: 12px 24px;
    background: var(--cream);
    border-bottom: 1px solid var(--gray-200);
    flex-shrink: 0;
  }

  .shipping-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--gray-600);
    margin-bottom: 7px;
    text-align: center;
  }

  .shipping-text strong {
    color: var(--success);
    font-weight: 600;
  }

  .shipping-track {
    height: 3px;
    background: var(--gray-200);
    border-radius: 99px;
    overflow: hidden;
  }

  .shipping-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-light));
    border-radius: 99px;
    transition: width 500ms var(--ease-out);
    min-width: 0%;
    max-width: 100%;
  }

  /* ── Lista de ítems ── */
  .items-wrap {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px 0;
  }

  .items-wrap::-webkit-scrollbar { width: 4px; }
  .items-wrap::-webkit-scrollbar-track { background: transparent; }
  .items-wrap::-webkit-scrollbar-thumb {
    background: var(--gray-200);
    border-radius: 99px;
  }

  /* Estado vacío */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 60px 24px;
    text-align: center;
    height: 100%;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    color: var(--gray-300);
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 400;
    color: var(--primary);
  }

  .empty-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--gray-400);
    line-height: 1.6;
    max-width: 240px;
  }

  .btn-shop {
    padding: 11px 28px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .09em;
    text-transform: uppercase;
    color: var(--cream);
    background: var(--primary);
    border: none;
    cursor: pointer;
    transition: background 200ms;
    margin-top: 4px;
  }

  .btn-shop:hover { background: var(--primary-dark); }

  /* ── Ítem individual ── */
  .item {
    display: flex;
    gap: 14px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--gray-100);
    position: relative;
    animation: itemIn 280ms var(--ease-out) both;
  }

  .item.removing {
    animation: itemOut 260ms var(--ease) forwards;
    pointer-events: none;
    overflow: hidden;
  }

  @keyframes itemIn {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes itemOut {
    from { opacity: 1; max-height: 140px; padding-block: 16px; }
    to   { opacity: 0; max-height: 0;     padding-block: 0; }
  }

  /* Imagen del ítem */
  .item-img {
    flex-shrink: 0;
    width: 76px;
    height: 96px;
    object-fit: cover;
    background: var(--gray-100);
    cursor: pointer;
    transition: opacity 200ms;
  }

  .item-img:hover { opacity: .85; }

  /* Info del ítem */
  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .item-category {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .item-name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 400;
    color: var(--primary);
    line-height: 1.3;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 200ms;
  }

  .item-name:hover { color: var(--accent); }

  .item-attrs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .item-attr {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--gray-500);
    background: var(--gray-100);
    padding: 2px 7px;
    border-radius: 3px;
  }

  /* Precio del ítem */
  .item-price-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .item-price {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 600;
    color: var(--primary);
  }

  .item-price-original {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--gray-400);
    text-decoration: line-through;
  }

  /* Control de cantidad */
  .qty-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 8px;
  }

  .qty-ctrl {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--gray-200);
  }

  .qty-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--gray-500);
    font-size: 16px;
    line-height: 1;
    transition: color 150ms, background 150ms;
    user-select: none;
  }

  .qty-btn:hover:not(:disabled) {
    color: var(--primary);
    background: var(--gray-100);
  }

  .qty-btn:disabled { opacity: .35; cursor: not-allowed; }

  .qty-val {
    min-width: 32px;
    text-align: center;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--primary);
    border-left: 1px solid var(--gray-200);
    border-right: 1px solid var(--gray-200);
    padding: 0 4px;
    line-height: 30px;
  }

  /* Botón eliminar */
  .btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--gray-400);
    border-radius: 50%;
    transition: color 150ms, background 150ms;
  }

  .btn-remove:hover {
    color: var(--error);
    background: var(--error-light);
  }

  .btn-remove:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ── Cupón ── */
  .coupon-wrap {
    padding: 14px 24px;
    border-top: 1px solid var(--gray-100);
    flex-shrink: 0;
  }

  .coupon-form {
    display: flex;
    gap: 8px;
  }

  .coupon-input {
    flex: 1;
    height: 38px;
    padding: 0 12px;
    font-family: var(--font-body);
    font-size: 13px;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--primary);
    background: var(--gray-50);
    border: 1px solid var(--gray-200);
    outline: none;
    transition: border-color 200ms, box-shadow 200ms;
  }

  .coupon-input::placeholder {
    text-transform: none;
    letter-spacing: 0;
    color: var(--gray-400);
  }

  .coupon-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(201,169,110,.15);
  }

  .coupon-input.error { border-color: var(--error); }
  .coupon-input.success { border-color: var(--success); }

  .btn-coupon {
    height: 38px;
    padding: 0 16px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--primary);
    background: none;
    border: 1px solid var(--primary);
    cursor: pointer;
    white-space: nowrap;
    transition: background 200ms, color 200ms;
  }

  .btn-coupon:hover {
    background: var(--primary);
    color: var(--cream);
  }

  .btn-coupon:disabled { opacity: .5; cursor: not-allowed; }

  .coupon-msg {
    font-family: var(--font-body);
    font-size: 11px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 16px;
  }

  .coupon-msg.success { color: var(--success); }
  .coupon-msg.error   { color: var(--error); }

  .coupon-applied {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--success-light);
    border: 1px solid #a3d4b5;
    padding: 8px 12px;
    border-radius: 3px;
  }

  .coupon-applied-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--success);
    font-weight: 500;
  }

  .btn-remove-coupon {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--success);
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    opacity: .7;
    transition: opacity 150ms;
  }

  .btn-remove-coupon:hover { opacity: 1; }

  /* ── Resumen totales ── */
  .summary {
    padding: 16px 24px;
    border-top: 1px solid var(--gray-200);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .summary-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--gray-500);
  }

  .summary-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--gray-600);
    font-weight: 500;
  }

  .summary-value.discount { color: var(--success); }
  .summary-value.free     { color: var(--success); font-weight: 600; }

  .summary-divider {
    height: 1px;
    background: var(--gray-200);
    margin: 2px 0;
  }

  .summary-total .summary-label {
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--primary);
    font-weight: 400;
  }

  .summary-total .summary-value {
    font-family: var(--font-display);
    font-size: 22px;
    color: var(--primary);
    font-weight: 600;
  }

  /* ── Footer acciones ── */
  .footer {
    padding: 16px 24px 24px;
    border-top: 1px solid var(--gray-200);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-checkout {
    width: 100%;
    padding: 15px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--cream);
    background: var(--primary);
    border: none;
    cursor: pointer;
    transition: background 200ms, box-shadow 200ms;
    position: relative;
    overflow: hidden;
  }

  .btn-checkout:hover:not(:disabled) {
    background: var(--primary-dark);
    box-shadow: 0 6px 20px rgba(26,26,46,.3);
  }

  .btn-checkout:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .btn-continue {
    width: 100%;
    padding: 13px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--gray-500);
    background: none;
    border: 1px solid var(--gray-200);
    cursor: pointer;
    transition: border-color 200ms, color 200ms;
  }

  .btn-continue:hover {
    border-color: var(--gray-400);
    color: var(--primary);
  }

  /* ── Botón vaciar ── */
  .btn-clear {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--gray-400);
    padding: 0;
    margin-left: auto;
    transition: color 200ms;
  }

  .btn-clear:hover { color: var(--error); }

  /* ── Trust badges ── */
  .trust {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 24px;
    border-top: 1px solid var(--gray-100);
    flex-shrink: 0;
  }

  .trust-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--gray-400);
    letter-spacing: .03em;
  }

  .trust-item svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--accent);
  }

  /* ── Mobile ── */
  @media (max-width: 420px) {
    :host { --drawer-w: 100vw; }
    .header { padding: 16px 18px; }
    .item   { padding: 14px 18px; gap: 12px; }
    .coupon-wrap, .summary, .footer { padding-inline: 18px; }
    .trust  { padding-inline: 18px; gap: 12px; }
    .item-img { width: 64px; height: 82px; }
  }

  /* ── Focus trap helper ── */
  .focus-sentinel {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
`;

// ─── Clase Web Component ──────────────────────────────────────

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._isOpen = false;
    this._bus = null;
    this._unsubCart = null;

    // Focus trap
    this._focusableEls = [];
    this._lastFocused = null;

    // Coupon state local
    this._couponInput = "";
    this._couponMsg = { text: "", type: "" };
  }

  // ── Lifecycle ────────────────────────────────────────────────

  connectedCallback() {
    this._bus = bus.context("CartDrawer");

    // Escuchar eventos del bus
    this._bus
      .on(EVENTS.CART_OPEN, () => this.open())
      .on(EVENTS.CART_CLOSE, () => this.close())
      .on(EVENTS.CART_ITEM_ADDED, (d) => this._onItemAdded(d))
      .on(EVENTS.CART_UPDATED, () => this._updateUI())
      .on(EVENTS.OVERLAY_CLOSE, () => this.close());

    // Suscribirse al store para re-render reactivo
    this._unsubCart = store.subscribe("cart", () => this._updateUI());

    // Render inicial
    this._renderShell();
  }

  disconnectedCallback() {
    this._bus?.destroy();
    this._unsubCart?.();
    this._removeFocusTrap();
    document.removeEventListener("keydown", this._onKeyDown);
  }

  // ── API pública ───────────────────────────────────────────────

  open() {
    if (this._isOpen) return;
    this._isOpen = true;

    const backdrop = this._shadow.querySelector(".backdrop");
    const drawer = this._shadow.querySelector(".drawer");
    if (!backdrop || !drawer) return;

    // Actualizar DOM
    backdrop.classList.add("open");
    drawer.classList.add("open");
    drawer.removeAttribute("aria-hidden");
    drawer.setAttribute("aria-modal", "true");

    // Bloquear scroll del body
    document.body.style.overflow = "hidden";

    // Actualizar store
    store.setState("cart", { isOpen: true }, { silent: true });

    // Overlay
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.add("is-open");

    // Focus trap
    this._lastFocused = document.activeElement;
    this._setupFocusTrap();

    // Keyboard listener
    this._onKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener("keydown", this._onKeyDown);

    // Render contenido actualizado
    this._updateUI();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    const backdrop = this._shadow.querySelector(".backdrop");
    const drawer = this._shadow.querySelector(".drawer");
    if (!backdrop || !drawer) return;

    backdrop.classList.remove("open");
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";
    store.setState("cart", { isOpen: false }, { silent: true });

    const overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.remove("is-open");

    // Restaurar foco
    this._removeFocusTrap();
    document.removeEventListener("keydown", this._onKeyDown);
    this._lastFocused?.focus();
  }

  // ── Shell (estructura fija) ───────────────────────────────────

  /**
   * Renderiza la estructura estática del drawer.
   * El contenido dinámico se inyecta en #cart-content.
   * @private
   */
  _renderShell() {
    this._shadow.innerHTML = /* html */ `
      <style>${STYLES}</style>

      <!-- Backdrop -->
      <div class="backdrop" id="backdrop" aria-hidden="true"></div>

      <!-- Drawer panel -->
      <div
        class="drawer"
        id="drawer"
        role="dialog"
        aria-modal="false"
        aria-hidden="true"
        aria-label="Carrito de compras">

        <!-- Sentinel inicio (focus trap) -->
        <span class="focus-sentinel" id="sentinel-start" tabindex="0"></span>

        <!-- Header -->
        <header class="header">
          <div class="header-left">
            <h2 class="title">Tu Carrito</h2>
            <span class="count-badge" id="count-badge" aria-live="polite" aria-atomic="true">0</span>
          </div>
          <button
            class="btn-close"
            id="btn-close"
            type="button"
            aria-label="Cerrar carrito">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </header>

        <!-- Barra envío gratis -->
        <div class="shipping-bar" id="shipping-bar" aria-live="polite"></div>

        <!-- Contenido dinámico -->
        <div id="cart-content" style="display:contents"></div>

        <!-- Trust badges (siempre visible) -->
        <div class="trust" aria-label="Garantías de compra">
          <div class="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0
                   013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824
                   10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0
                   -1.31-.21-2.571-.598-3.751h-.152c-3.196
                   0-6.1-1.248-8.25-3.285z"/>
            </svg>
            Compra segura
          </div>
          <div class="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0
                   00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0
                   01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0
                   01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621
                   0 1.129-.504 1.09-1.124a17.902 17.902 0
                   00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25
                   M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422
                   -1.048-.987-1.106a48.554 48.554 0 00-10.026 0
                   1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677
                   m0 4.5v-4.5m0 0h-12"/>
            </svg>
            Envíos a todo CO
          </div>
          <div class="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992
                   m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0
                   0013.803-3.7M4.031 9.865a8.25 8.25 0
                   0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
            </svg>
            Devoluciones
          </div>
        </div>

        <!-- Sentinel fin (focus trap) -->
        <span class="focus-sentinel" id="sentinel-end" tabindex="0"></span>

      </div>
    `;

    // Enlazar cierre
    this._shadow
      .getElementById("backdrop")
      ?.addEventListener("click", () => this.close());

    this._shadow
      .getElementById("btn-close")
      ?.addEventListener("click", () => this.close());

    // Render inicial del contenido
    this._updateUI();
  }

  // ── Render dinámico ───────────────────────────────────────────

  /**
   * Actualiza todo el contenido dinámico del drawer.
   * @private
   */
  _updateUI() {
    const cart = store.getState("cart");
    const items = cart?.items ?? [];
    const count = store.cartCount;

    // Badge de conteo
    this._updateBadge(count);

    // Barra de envío gratis
    this._updateShippingBar(store.cartSubtotal);

    // Contenido principal
    const content = this._shadow.getElementById("cart-content");
    if (!content) return;

    if (items.length === 0) {
      content.innerHTML = this._emptyStateHTML();
      this._bindEmptyActions();
    } else {
      content.innerHTML =
        this._itemsHTML(items) +
        this._couponHTML(cart) +
        this._summaryHTML(cart) +
        this._footerHTML();
      this._bindItemActions(items);
      this._bindCouponActions(cart);
      this._bindFooterActions();
    }
  }

  /**
   * Actualiza solo el badge de cantidad (sin re-render completo).
   * @param {number} count
   * @private
   */
  _updateBadge(count) {
    const badge = this._shadow.getElementById("count-badge");
    if (!badge) return;
    const prev = parseInt(badge.textContent) || 0;
    badge.textContent = count;
    if (count > prev) {
      badge.classList.remove("bump");
      void badge.offsetWidth; // reflow
      badge.classList.add("bump");
    }
  }

  /**
   * Actualiza la barra de progreso de envío gratis.
   * @param {number} subtotal
   * @private
   */
  _updateShippingBar(subtotal) {
    const bar = this._shadow.getElementById("shipping-bar");
    if (!bar) return;

    const pct = Math.min((subtotal / SHIPPING_THRESHOLD) * 100, 100);
    const remaining = Math.max(SHIPPING_THRESHOLD - subtotal, 0);
    const isFree = subtotal >= SHIPPING_THRESHOLD;

    bar.innerHTML = /* html */ `
      <p class="shipping-text">
        ${
          isFree
            ? "<strong>🎉 ¡Tienes envío gratis!</strong>"
            : `Te faltan <strong>${this._fmt(remaining)}</strong> para envío gratis`
        }
      </p>
      <div class="shipping-track" role="progressbar"
           aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"
           aria-label="Progreso hacia envío gratis">
        <div class="shipping-fill" style="width:${pct}%"></div>
      </div>
    `;
  }

  // ── HTMLs parciales ───────────────────────────────────────────

  /** @private */
  _emptyStateHTML() {
    return /* html */ `
      <div class="items-wrap">
        <div class="empty-state" role="status" aria-live="polite">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437
                 M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218
                 c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0
                 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75
                 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0
                 11-1.5 0 .75.75 0 011.5 0z"/>
          </svg>
          <h3 class="empty-title">Tu carrito está vacío</h3>
          <p class="empty-desc">
            Descubre nuestra colección y agrega las prendas que te enamoran.
          </p>
          <button class="btn-shop" id="btn-shop" type="button">
            Explorar colección
          </button>
        </div>
      </div>
    `;
  }

  /** @private */
  _itemsHTML(items) {
    return /* html */ `
      <div class="items-wrap" role="list" aria-label="Productos en tu carrito">
        <div style="display:flex;align-items:center;justify-content:flex-end;
             padding:6px 24px 2px">
          <button class="btn-clear" id="btn-clear" type="button"
                  aria-label="Vaciar carrito">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21
                   c.342.052.682.107 1.022.166m-1.022-.165L18.16
                   19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25
                   2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108
                   48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114
                   1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5
                   0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964
                   0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916
                   m7.5 0a48.667 48.667 0 00-7.5 0"/>
            </svg>
            Vaciar
          </button>
        </div>
        ${items.map((item, i) => this._itemHTML(item, i)).join("")}
      </div>
    `;
  }

  /** @private */
  _itemHTML(item, index) {
    const onSale = item.originalPrice && item.originalPrice > item.price;
    return /* html */ `
      <div
        class="item"
        role="listitem"
        data-item-id="${this._esc(item.id)}"
        aria-label="${this._esc(item.name)}"
        style="animation-delay:${index * 40}ms">

        <!-- Imagen -->
        <img
          class="item-img"
          src="${this._esc(item.image)}"
          alt="${this._esc(item.name)}"
          loading="lazy"
          data-nav="${this._esc(item.productId)}"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 100%22%3E%3Crect width=%2280%22 height=%22100%22 fill=%22%23f0eeeb%22/%3E%3C/svg%3E'" />

        <!-- Info -->
        <div class="item-info">
          ${
            item.category
              ? `<span class="item-category">${this._esc(item.category)}</span>`
              : ""
          }

          <h4 class="item-name" data-nav="${this._esc(item.productId)}">
            ${this._esc(item.name)}
          </h4>

          <div class="item-attrs">
            ${item.size ? `<span class="item-attr">Talla: ${this._esc(item.size)}</span>` : ""}
            ${item.color ? `<span class="item-attr">Color: ${this._esc(item.color)}</span>` : ""}
          </div>

          <div class="item-price-row">
            <span class="item-price">${this._fmt(item.price * item.quantity)}</span>
            ${
              onSale
                ? `<span class="item-price-original">${this._fmt(item.originalPrice * item.quantity)}</span>`
                : ""
            }
          </div>

          <!-- Qty + remove -->
          <div class="qty-row">
            <div class="qty-ctrl" role="group" aria-label="Cantidad de ${this._esc(item.name)}">
              <button
                class="qty-btn"
                data-action="dec"
                data-id="${this._esc(item.id)}"
                type="button"
                aria-label="Reducir cantidad"
                ${item.quantity <= 1 ? "disabled" : ""}>
                −
              </button>
              <span class="qty-val" aria-live="polite" aria-atomic="true">
                ${item.quantity}
              </span>
              <button
                class="qty-btn"
                data-action="inc"
                data-id="${this._esc(item.id)}"
                type="button"
                aria-label="Aumentar cantidad"
                ${item.stock != null && item.quantity >= item.stock ? "disabled" : ""}>
                +
              </button>
            </div>

            <button
              class="btn-remove"
              data-action="remove"
              data-id="${this._esc(item.id)}"
              type="button"
              aria-label="Eliminar ${this._esc(item.name)} del carrito">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    `;
  }

  /** @private */
  _couponHTML(cart) {
    const applied = cart?.coupon;
    return /* html */ `
      <div class="coupon-wrap">
        ${
          applied
            ? /* html */ `
          <div class="coupon-applied" role="status">
            <span class="coupon-applied-text">
              🏷 Cupón <strong>${this._esc(applied)}</strong>
              — ${cart.discount}% de descuento aplicado
            </span>
            <button class="btn-remove-coupon" id="btn-remove-coupon"
                    type="button" aria-label="Quitar cupón">×</button>
          </div>
        `
            : /* html */ `
          <div class="coupon-form" role="group" aria-label="Código de descuento">
            <label for="coupon-input" class="focus-sentinel">Cupón</label>
            <input
              class="coupon-input"
              id="coupon-input"
              type="text"
              placeholder="Código de descuento"
              autocomplete="off"
              autocapitalize="characters"
              maxlength="20"
              aria-label="Código de cupón"
              value="${this._esc(this._couponInput)}" />
            <button class="btn-coupon" id="btn-apply-coupon" type="button">
              Aplicar
            </button>
          </div>
          <p class="coupon-msg ${this._couponMsg.type}" id="coupon-msg"
             aria-live="polite" role="status">
            ${this._couponMsg.text}
          </p>
        `
        }
      </div>
    `;
  }

  /** @private */
  _summaryHTML(cart) {
    const subtotal = store.cartSubtotal;
    const discount = cart?.discount ?? 0;
    const discAmt = discount > 0 ? subtotal * (discount / 100) : 0;
    const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = subtotal - discAmt + shipping;

    return /* html */ `
      <div class="summary" aria-label="Resumen del pedido">
        <div class="summary-row">
          <span class="summary-label">Subtotal</span>
          <span class="summary-value">${this._fmt(subtotal)}</span>
        </div>
        ${
          discount > 0
            ? /* html */ `
          <div class="summary-row">
            <span class="summary-label">Descuento (${discount}%)</span>
            <span class="summary-value discount">− ${this._fmt(discAmt)}</span>
          </div>
        `
            : ""
        }
        <div class="summary-row">
          <span class="summary-label">Envío</span>
          <span class="summary-value ${shipping === 0 ? "free" : ""}">
            ${shipping === 0 ? "¡Gratis!" : this._fmt(shipping)}
          </span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-row summary-total">
          <span class="summary-label">Total</span>
          <span class="summary-value">${this._fmt(total)}</span>
        </div>
      </div>
    `;
  }

  /** @private */
  _footerHTML() {
    const isEmpty = store.cartCount === 0;
    return /* html */ `
      <div class="footer">
        <button
          class="btn-checkout"
          id="btn-checkout"
          type="button"
          ${isEmpty ? "disabled" : ""}
          aria-label="Ir al checkout">
          Finalizar compra
        </button>
        <button
          class="btn-continue"
          id="btn-continue"
          type="button">
          Continuar comprando
        </button>
      </div>
    `;
  }

  // ── Bind de eventos ───────────────────────────────────────────

  /** @private */
  _bindEmptyActions() {
    this._shadow.getElementById("btn-shop")?.addEventListener("click", () => {
      this.close();
      bus.emit(EVENTS.NAVIGATE, { route: "/catalog" });
    });
  }

  /** @private */
  _bindItemActions(items) {
    const wrap = this._shadow.querySelector(".items-wrap");
    if (!wrap) return;

    // Delegación de eventos en la lista
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) {
        // Click en imagen o nombre → navegar al producto
        const nav = e.target.closest("[data-nav]");
        if (nav) {
          const pid = nav.dataset.nav;
          this.close();
          bus.emit(EVENTS.NAVIGATE, { route: `/product/${pid}` });
        }
        return;
      }

      const { action, id } = btn.dataset;

      if (action === "inc") this._updateQty(id, 1);
      if (action === "dec") this._updateQty(id, -1);
      if (action === "remove") this._removeItem(id);
    });

    // Vaciar carrito
    this._shadow
      .getElementById("btn-clear")
      ?.addEventListener("click", () => this._clearCart());
  }

  /** @private */
  _bindCouponActions(cart) {
    // Quitar cupón aplicado
    this._shadow
      .getElementById("btn-remove-coupon")
      ?.addEventListener("click", () => this._removeCoupon());

    // Aplicar cupón
    const input = this._shadow.getElementById("coupon-input");
    const btnAp = this._shadow.getElementById("btn-apply-coupon");

    input?.addEventListener("input", (e) => {
      this._couponInput = e.target.value.toUpperCase();
      this._couponMsg = { text: "", type: "" };
      input.classList.remove("error", "success");
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnAp?.click();
    });

    btnAp?.addEventListener("click", () => this._applyCoupon());
  }

  /** @private */
  _bindFooterActions() {
    this._shadow
      .getElementById("btn-checkout")
      ?.addEventListener("click", () => {
        this.close();
        bus.emit(EVENTS.CHECKOUT_STARTED);
        bus.emit(EVENTS.NAVIGATE, { route: "/checkout" });
      });

    this._shadow
      .getElementById("btn-continue")
      ?.addEventListener("click", () => {
        this.close();
        bus.emit(EVENTS.NAVIGATE, { route: "/catalog" });
      });
  }

  // ── Acciones del carrito ──────────────────────────────────────

  /**
   * Actualiza la cantidad de un ítem.
   * @param {string} itemId
   * @param {number} delta — +1 o -1
   * @private
   */
  _updateQty(itemId, delta) {
    const cart = store.getState("cart");
    const items = cart.items.map((item) => {
      if (item.id !== itemId) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      if (item.stock != null && newQty > item.stock) {
        bus.emit(EVENTS.TOAST_SHOW, {
          type: "warning",
          title: "Stock limitado",
          message: `Solo quedan ${item.stock} unidades disponibles.`,
        });
        return item;
      }
      return { ...item, quantity: newQty };
    });

    store.setState("cart", { items });
    storage.saveCart(store.getState("cart"));
    bus.emit(EVENTS.CART_ITEM_UPDATED, { itemId, delta });
    bus.emit(EVENTS.CART_UPDATED);
  }

  /**
   * Elimina un ítem del carrito con animación.
   * @param {string} itemId
   * @private
   */
  _removeItem(itemId) {
    const el = this._shadow.querySelector(`[data-item-id="${itemId}"]`);
    if (el) {
      el.classList.add("removing");
      el.addEventListener(
        "animationend",
        () => {
          this._doRemove(itemId);
        },
        { once: true },
      );
    } else {
      this._doRemove(itemId);
    }
  }

  /** @private */
  _doRemove(itemId) {
    const cart = store.getState("cart");
    const item = cart.items.find((i) => i.id === itemId);
    const items = cart.items.filter((i) => i.id !== itemId);

    store.setState("cart", { items });
    storage.saveCart(store.getState("cart"));

    bus.emit(EVENTS.CART_ITEM_REMOVED, { itemId });
    bus.emit(EVENTS.CART_UPDATED);

    if (item) {
      bus.emit(EVENTS.TOAST_SHOW, {
        type: "info",
        title: "Producto eliminado",
        message: `${item.name} fue removido del carrito.`,
      });
    }
  }

  /**
   * Vacía el carrito completo.
   * @private
   */
  _clearCart() {
    const count = store.cartCount;
    if (count === 0) return;

    store.setState("cart", { items: [], coupon: null, discount: 0 });
    storage.saveCart(store.getState("cart"));

    bus.emit(EVENTS.CART_CLEARED);
    bus.emit(EVENTS.CART_UPDATED);
    bus.emit(EVENTS.TOAST_SHOW, {
      type: "info",
      title: "Carrito vaciado",
      message: "Todos los productos fueron eliminados.",
    });
  }

  /**
   * Aplica un código de cupón.
   * @private
   */
  _applyCoupon() {
    const code = this._couponInput.trim().toUpperCase();
    const input = this._shadow.getElementById("coupon-input");
    const msg = this._shadow.getElementById("coupon-msg");

    if (!code) {
      this._setCouponMsg("Ingresa un código de cupón.", "error", input, msg);
      return;
    }

    const discount = COUPON_CODES[code];
    if (!discount) {
      this._couponInput = code;
      this._setCouponMsg("Código inválido o expirado.", "error", input, msg);
      return;
    }

    // Aplicar cupón en el store
    store.setState("cart", { coupon: code, discount });
    storage.saveCart(store.getState("cart"));
    this._couponInput = "";

    bus.emit(EVENTS.CART_COUPON_APPLIED, { code, discount });
    bus.emit(EVENTS.CART_UPDATED);
    bus.emit(EVENTS.TOAST_SHOW, {
      type: "success",
      title: "¡Cupón aplicado!",
      message: `Tienes un ${discount}% de descuento en tu pedido.`,
    });
  }

  /**
   * Quita el cupón aplicado.
   * @private
   */
  _removeCoupon() {
    store.setState("cart", { coupon: null, discount: 0 });
    storage.saveCart(store.getState("cart"));
    this._couponInput = "";
    this._couponMsg = { text: "", type: "" };

    bus.emit(EVENTS.CART_COUPON_REMOVED);
    bus.emit(EVENTS.CART_UPDATED);
  }

  /** @private */
  _setCouponMsg(text, type, input, msgEl) {
    this._couponMsg = { text, type };
    if (input) {
      input.classList.remove("error", "success");
      input.classList.add(type);
    }
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.className = `coupon-msg ${type}`;
    }
  }

  /**
   * Reacciona cuando se añade un ítem al carrito desde afuera.
   * @param {{ item: Object }} detail
   * @private
   */
  _onItemAdded({ item } = {}) {
    if (!item) return;

    const cart = store.getState("cart");
    const items = [...(cart?.items ?? [])];

    // Buscar si ya existe (mismo producto + talla + color)
    const idx = items.findIndex(
      (i) =>
        i.productId === item.productId &&
        i.size === item.size &&
        i.color === item.color,
    );

    if (idx >= 0) {
      // Incrementar cantidad
      items[idx] = {
        ...items[idx],
        quantity: items[idx].quantity + (item.quantity ?? 1),
      };
    } else {
      // Nuevo ítem con ID único
      items.push({
        ...item,
        id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        addedAt: new Date().toISOString(),
      });
    }

    store.setState("cart", { items });
    storage.saveCart(store.getState("cart"));
    bus.emit(EVENTS.CART_UPDATED);

    // Abrir drawer automáticamente
    if (!this._isOpen) this.open();
  }

  // ── Focus trap ────────────────────────────────────────────────

  /**
   * Configura el trap de foco dentro del drawer.
   * @private
   */
  _setupFocusTrap() {
    const drawer = this._shadow.getElementById("drawer");
    if (!drawer) return;

    // Foco inicial en el botón de cierre
    requestAnimationFrame(() => {
      this._shadow.getElementById("btn-close")?.focus();
    });

    const sentinelStart = this._shadow.getElementById("sentinel-start");
    const sentinelEnd = this._shadow.getElementById("sentinel-end");

    sentinelStart?.addEventListener("focus", () => {
      // Al llegar al sentinel de inicio (tab atrás), ir al último focusable
      this._getLastFocusable()?.focus();
    });

    sentinelEnd?.addEventListener("focus", () => {
      // Al llegar al sentinel de fin (tab adelante), ir al primero focusable
      this._shadow.getElementById("btn-close")?.focus();
    });
  }

  /** @private */
  _removeFocusTrap() {
    // No hay listeners externos que limpiar; los sentinels están en Shadow DOM
  }

  /** @private */
  _getLastFocusable() {
    const drawer = this._shadow.getElementById("drawer");
    if (!drawer) return null;
    const els = [
      ...drawer.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]:not(.focus-sentinel)',
      ),
    ];
    return els[els.length - 1] ?? null;
  }

  /**
   * Maneja teclas globales cuando el drawer está abierto.
   * @param {KeyboardEvent} e
   * @private
   */
  _handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Formatea número como precio COP.
   * @param {number} value
   * @returns {string}
   * @private
   */
  _fmt(value) {
    if (value == null || isNaN(value)) return "$0";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Escapa caracteres HTML para prevenir XSS.
   * @param {*} str
   * @returns {string}
   * @private
   */
  _esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

// ─── Registro ─────────────────────────────────────────────────

if (!customElements.get("cart-drawer")) {
  customElements.define("cart-drawer", CartDrawer);
}

// ─── Exports ──────────────────────────────────────────────────

export default CartDrawer;
export { CartDrawer, COUPON_CODES, SHIPPING_THRESHOLD, SHIPPING_COST };
