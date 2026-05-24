/**
 * product-card.component.js
 * Web Component <lumiere-product-card> — tarjeta de producto para LUMIÈRE.
 * Shadow DOM · Imagen con overlay · Badge sale · Wishlist · Cart · Detalle.
 *
 * Uso:
 *   <lumiere-product-card data-product='{"id":"...","name":"...","price":99}'></lumiere-product-card>
 *
 * O programáticamente:
 *   const card = document.createElement('lumiere-product-card');
 *   card.setProduct(productObject);
 *   container.appendChild(card);
 */

import bus, { EVENTS } from "../core/events.js";
import store from "../core/store.js";
import CartService from "../services/cart.service.js";
import router from "../core/router.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const TAG_NAME = "lumiere-product-card";

// Imagen placeholder SVG inline (no depende de red)
const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'
  viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f0ece6'/%3E
  %3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'
  font-family='Georgia' font-size='14' fill='%23c9a96e' letter-spacing='4'%3ELUMIÈRE%3C/text%3E
  %3C/svg%3E`;

// ─── Estilos Shadow DOM ────────────────────────────────────────────────────────

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  /* ── Card container ── */
  .card {
    position: relative;
    background: #fff;
    border-radius: .75rem;
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow .3s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.4,0,.2,1);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .card:hover {
    box-shadow: 0 16px 48px rgba(26,26,46,.1), 0 4px 12px rgba(26,26,46,.06);
    transform: translateY(-3px);
  }

  /* ── Imagen ── */
  .image-wrap {
    position: relative;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background: #f0ece6;
    flex-shrink: 0;
  }

  .image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transition: transform .6s cubic-bezier(.4,0,.2,1), opacity .3s;
    opacity: 0;
  }

  .image.loaded  { opacity: 1; }
  .card:hover .image { transform: scale(1.06); }

  /* Imagen alternativa al hacer hover (si existe) */
  .image-alt {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    opacity: 0;
    transition: opacity .5s cubic-bezier(.4,0,.2,1);
  }

  .card:hover .image-alt.has-alt { opacity: 1; }

  /* ── Overlay acciones ── */
  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(26,26,46,.55) 0%, transparent 50%);
    opacity: 0;
    transition: opacity .3s;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 1rem;
    gap: .5rem;
  }

  .card:hover .overlay { opacity: 1; }

  /* ── Botón Add to Cart ── */
  .btn-cart {
    width: 100%;
    padding: .7rem 1rem;
    background: #faf8f5;
    color: #1a1a2e;
    border: none;
    border-radius: .5rem;
    font-family: inherit;
    font-size: .72rem;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .5rem;
    transition: background .2s, color .2s, transform .15s;
    transform: translateY(8px);
    opacity: 0;
  }

  .card:hover .btn-cart {
    transform: translateY(0);
    opacity: 1;
    transition: background .2s, color .2s,
                transform .3s .05s cubic-bezier(.34,1.56,.64,1),
                opacity .3s .05s;
  }

  .btn-cart:hover {
    background: #1a1a2e;
    color: #faf8f5;
  }

  .btn-cart:active { transform: scale(.97); }

  .btn-cart.added {
    background: #c9a96e;
    color: #fff;
  }

  .btn-cart svg {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  /* ── Botón Detalle ── */
  .btn-detail {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,.15);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,.3);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background .2s, transform .2s;
    transform: scale(.8);
    opacity: 0;
  }

  .card:hover .btn-detail {
    transform: scale(1);
    opacity: 1;
    transition: background .2s,
                transform .3s .1s cubic-bezier(.34,1.56,.64,1),
                opacity .3s .1s;
  }

  .btn-detail:hover {
    background: rgba(255,255,255,.3);
  }

  .btn-detail svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Wishlist ── */
  .btn-wish {
    position: absolute;
    top: .75rem;
    right: .75rem;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(255,255,255,.9);
    backdrop-filter: blur(4px);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1a1a2e;
    transition: color .2s, transform .2s, background .2s;
    z-index: 2;
  }

  .btn-wish:hover    { color: #c9a96e; transform: scale(1.1); }
  .btn-wish.active   { color: #c9a96e; }
  .btn-wish.active svg { fill: #c9a96e; }

  .btn-wish svg {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: transparent;
    transition: fill .2s;
  }

  .btn-wish.pop {
    animation: heartPop .35s cubic-bezier(.34,1.56,.64,1);
  }

  @keyframes heartPop {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.35); }
    100% { transform: scale(1); }
  }

  /* ── Badges ── */
  .badges {
    position: absolute;
    top: .75rem;
    left: .75rem;
    display: flex;
    flex-direction: column;
    gap: .35rem;
    z-index: 2;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: .2rem .55rem;
    border-radius: 99px;
    font-size: .6rem;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    line-height: 1;
  }

  .badge-sale    { background: #1a1a2e; color: #c9a96e; }
  .badge-new     { background: #c9a96e; color: #fff; }
  .badge-out     { background: rgba(255,255,255,.85); color: #888; }

  /* ── Info ── */
  .info {
    padding: .85rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: .3rem;
    flex: 1;
  }

  .category {
    font-size: .65rem;
    font-weight: 500;
    letter-spacing: .15em;
    text-transform: uppercase;
    color: #c9a96e;
  }

  .name {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 1rem;
    font-weight: 500;
    color: #1a1a2e;
    line-height: 1.35;
    /* clamp a 2 líneas */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Precios ── */
  .prices {
    display: flex;
    align-items: baseline;
    gap: .5rem;
    margin-top: auto;
    padding-top: .4rem;
  }

  .price {
    font-size: .95rem;
    font-weight: 600;
    color: #1a1a2e;
    letter-spacing: .01em;
  }

  .price-compare {
    font-size: .8rem;
    font-weight: 400;
    color: #b0aba5;
    text-decoration: line-through;
  }

  .price-discount {
    font-size: .65rem;
    font-weight: 700;
    color: #fff;
    background: #c9a96e;
    padding: .15rem .4rem;
    border-radius: 99px;
    letter-spacing: .04em;
  }

  /* ── Estrellas rating ── */
  .rating {
    display: flex;
    align-items: center;
    gap: .3rem;
    margin-top: .15rem;
  }

  .stars {
    display: flex;
    gap: 1px;
  }

  .star {
    width: 11px;
    height: 11px;
    color: #c9a96e;
  }

  .star.empty { color: #e0dbd5; }

  .rating-count {
    font-size: .65rem;
    color: #aaa;
    line-height: 1;
  }

  /* ── Colores disponibles ── */
  .colors {
    display: flex;
    gap: .3rem;
    margin-top: .2rem;
    flex-wrap: wrap;
  }

  .color-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid rgba(0,0,0,.1);
    cursor: default;
    title: attr(data-color);
  }

  /* ── Skeleton loader ── */
  :host([loading]) .card {
    pointer-events: none;
  }

  .skeleton {
    background: linear-gradient(90deg, #f0ece6 25%, #e8e3dd 50%, #f0ece6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: .375rem;
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .overlay { opacity: 1; background: linear-gradient(to top, rgba(26,26,46,.48) 0%, transparent 45%); }
    .btn-cart, .btn-detail { transform: none; opacity: 1; }
    .name { font-size: .92rem; }
    .info { padding: .7rem .85rem .85rem; }
  }
`;

// ─── Iconos SVG ────────────────────────────────────────────────────────────────

const ICONS = {
  cart: `<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
  eye: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  heart: `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Formatea precio a moneda. */
function fmtPrice(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/** Calcula % de descuento. */
function discount(price, compare) {
  if (!compare || compare <= price) return 0;
  return Math.round((1 - price / compare) * 100);
}

/** Genera HTML de estrellas (0–5). */
function starsHTML(rating) {
  if (!rating) return "";
  const full = Math.floor(rating);
  const empty = 5 - full;
  const star = (
    cls,
  ) => `<svg class="star ${cls}" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
  </svg>`;
  return (
    Array(full).fill(star("")).join("") +
    Array(empty).fill(star("empty")).join("")
  );
}

/** Escapa HTML. */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Web Component ─────────────────────────────────────────────────────────────

class LumiereProductCard extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._product = null;
    this._wished = false;
    this._busCtx = null;
    this._addedTimer = null;
  }

  // ── Observed attributes ────────────────────────────────────────────────────

  static get observedAttributes() {
    return ["data-product"];
  }

  attributeChangedCallback(name) {
    if (name === "data-product") this._parseAndRender();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    this._busCtx = bus.context?.("ProductCard") ?? null;
    this._parseAndRender();
  }

  disconnectedCallback() {
    this._busCtx?.destroy?.();
    clearTimeout(this._addedTimer);
  }

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Establece el producto directamente (alternativa al atributo data-product).
   * @param {Object} product
   */
  setProduct(product) {
    this._product = product;
    this._syncWishState();
    this._render();
    this._hydrate();
  }

  // ── Parse desde atributo ───────────────────────────────────────────────────

  _parseAndRender() {
    const raw = this.getAttribute("data-product");
    if (!raw) return;
    try {
      this._product = JSON.parse(raw);
      this._syncWishState();
      this._render();
      this._hydrate();
    } catch (e) {
      console.warn("[ProductCard] data-product JSON inválido:", e);
    }
  }

  // ── Wishlist state ─────────────────────────────────────────────────────────

  _syncWishState() {
    if (!this._product) return;
    const wishlist = store.getState().wishlist?.ids ?? [];
    this._wished = wishlist.includes(this._product.id);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    const p = this._product;
    if (!p) {
      this._renderSkeleton();
      return;
    }

    const img1 = p.images?.[0] ?? PLACEHOLDER_SVG;
    const img2 = p.images?.[1] ?? null;
    const pct = discount(p.price, p.compareAtPrice);
    const outOfStock = (p.stock ?? 0) <= 0;
    const isNew = !outOfStock && p.tags?.includes("new");
    const onSale = pct > 0 && !outOfStock;
    const hasRating = p.rating && p.reviewCount > 0;

    // Categoría legible
    const catLabel = p.category
      ? p.category.charAt(0).toUpperCase() + p.category.slice(1)
      : "";

    // Colores (máx 5 puntos)
    const colors = (p.colors ?? []).slice(0, 5);

    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <article class="card" part="card" aria-label="${esc(p.name)}">

        <!-- ── Imagen ── -->
        <div class="image-wrap">
          <img
            class="image"
            id="img-main"
            src="${esc(img1)}"
            alt="${esc(p.name)}"
            loading="lazy"
            decoding="async"
          />
          ${img2 ? `<img class="image-alt has-alt" src="${esc(img2)}" alt="${esc(p.name)} — vista alternativa" loading="lazy" decoding="async" />` : '<div class="image-alt"></div>'}

          <!-- Badges -->
          <div class="badges">
            ${onSale ? `<span class="badge badge-sale">−${pct}%</span>` : ""}
            ${isNew ? `<span class="badge badge-new">Nuevo</span>` : ""}
            ${outOfStock ? `<span class="badge badge-out">Sin stock</span>` : ""}
          </div>

          <!-- Wishlist -->
          <button class="btn-wish ${this._wished ? "active" : ""}"
            id="btn-wish"
            aria-label="${this._wished ? "Quitar de favoritos" : "Añadir a favoritos"}"
            title="Favoritos">
            ${ICONS.heart}
          </button>

          <!-- Overlay -->
          <div class="overlay">
            <button
              class="btn-cart"
              id="btn-cart"
              ${outOfStock ? 'disabled aria-disabled="true"' : ""}
              aria-label="Añadir al carrito">
              ${ICONS.cart}
              ${outOfStock ? "Sin stock" : "Añadir al carrito"}
            </button>
          </div>

          <!-- Ver detalle -->
          <button class="btn-detail" id="btn-detail" aria-label="Ver detalle del producto">
            ${ICONS.eye}
          </button>
        </div>

        <!-- ── Info ── -->
        <div class="info" part="info">
          ${catLabel ? `<span class="category">${esc(catLabel)}</span>` : ""}

          <h3 class="name">${esc(p.name)}</h3>

          ${
            hasRating
              ? `
          <div class="rating" aria-label="Valoración: ${p.rating} de 5">
            <div class="stars" aria-hidden="true">${starsHTML(p.rating)}</div>
            <span class="rating-count">(${p.reviewCount})</span>
          </div>`
              : ""
          }

          ${
            colors.length
              ? `
          <div class="colors" aria-label="Colores disponibles">
            ${colors.map((c) => `<span class="color-dot" style="background:${esc(c)};" title="${esc(c)}"></span>`).join("")}
          </div>`
              : ""
          }

          <div class="prices">
            <span class="price">${fmtPrice(p.price)}</span>
            ${p.compareAtPrice ? `<span class="price-compare">${fmtPrice(p.compareAtPrice)}</span>` : ""}
            ${pct > 0 ? `<span class="price-discount">−${pct}%</span>` : ""}
          </div>
        </div>
      </article>
    `;

    // Lazy-load imagen → fade in
    const imgEl = this._shadow.getElementById("img-main");
    if (imgEl) {
      imgEl.addEventListener("load", () => imgEl.classList.add("loaded"), {
        once: true,
      });
      imgEl.addEventListener(
        "error",
        () => {
          imgEl.src = PLACEHOLDER_SVG;
          imgEl.classList.add("loaded");
        },
        { once: true },
      );
      if (imgEl.complete) imgEl.classList.add("loaded");
    }
  }

  _renderSkeleton() {
    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <article class="card" aria-hidden="true">
        <div class="image-wrap skeleton"></div>
        <div class="info" style="gap:.5rem;">
          <div class="skeleton" style="height:10px;width:40%;border-radius:4px;"></div>
          <div class="skeleton" style="height:14px;width:85%;border-radius:4px;"></div>
          <div class="skeleton" style="height:14px;width:60%;border-radius:4px;"></div>
          <div class="skeleton" style="height:16px;width:35%;border-radius:4px;margin-top:.25rem;"></div>
        </div>
      </article>
    `;
  }

  // ── Hydrate ────────────────────────────────────────────────────────────────

  _hydrate() {
    const p = this._product;
    if (!p) return;

    const card = this._shadow.querySelector(".card");
    const btnCart = this._shadow.getElementById("btn-cart");
    const btnDetail = this._shadow.getElementById("btn-detail");
    const btnWish = this._shadow.getElementById("btn-wish");

    // Navegar al detalle al click en la card (excepto botones)
    card?.addEventListener("click", (e) => {
      if (e.target.closest("#btn-cart, #btn-detail, #btn-wish")) return;
      this._goToDetail();
    });

    // Botón detalle
    btnDetail?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._goToDetail();
    });

    // Botón carrito
    btnCart?.addEventListener("click", (e) => {
      e.stopPropagation();
      if ((p.stock ?? 0) <= 0) return;
      this._addToCart();
    });

    // Botón wishlist
    btnWish?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleWish();
    });
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  _goToDetail() {
    const id = this._product?.id;
    if (!id) return;
    router.navigate(`/product/${id}`);
  }

  _addToCart() {
    const p = this._product;
    const btn = this._shadow.getElementById("btn-cart");
    if (!p || !btn) return;

    // Si el producto requiere talla, ir al detalle primero
    if (p.sizes?.length > 0) {
      this._goToDetail();
      return;
    }

    const result = CartService.add(p.id, 1);

    if (result.success) {
      // Feedback visual temporal
      btn.classList.add("added");
      btn.innerHTML = `${ICONS.check} Añadido`;
      clearTimeout(this._addedTimer);
      this._addedTimer = setTimeout(() => {
        btn.classList.remove("added");
        btn.innerHTML = `${ICONS.cart} Añadir al carrito`;
      }, 2000);

      // Emit toast
      bus.emit(EVENTS.TOAST_SHOW ?? "lumiere:toast", {
        message: `"${p.name}" añadido al carrito.`,
        type: "success",
      });
    } else {
      bus.emit(EVENTS.TOAST_SHOW ?? "lumiere:toast", {
        message: result.errors?.[0] ?? "No se pudo añadir al carrito.",
        type: "error",
      });
    }
  }

  _toggleWish() {
    const p = this._product;
    const btn = this._shadow.getElementById("btn-wish");
    if (!p || !btn) return;

    this._wished = !this._wished;

    // Actualiza store wishlist
    const state = store.getState();
    const ids = new Set(state.wishlist?.ids ?? []);
    this._wished ? ids.add(p.id) : ids.delete(p.id);
    store.setState("wishlist", { ids: [...ids] });

    // UI
    btn.classList.toggle("active", this._wished);
    btn.setAttribute(
      "aria-label",
      this._wished ? "Quitar de favoritos" : "Añadir a favoritos",
    );
    btn.classList.add("pop");
    btn.addEventListener("animationend", () => btn.classList.remove("pop"), {
      once: true,
    });

    // Evento
    bus.emit(
      this._wished
        ? (EVENTS.WISHLIST_ADDED ?? "lumiere:wish_add")
        : (EVENTS.WISHLIST_REMOVED ?? "lumiere:wish_remove"),
      { product: p },
    );

    // Toast
    bus.emit(EVENTS.TOAST_SHOW ?? "lumiere:toast", {
      message: this._wished
        ? `"${p.name}" añadido a favoritos.`
        : `"${p.name}" eliminado de favoritos.`,
      type: "info",
    });
  }
}

// ─── Registro ──────────────────────────────────────────────────────────────────

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, LumiereProductCard);
}

export default LumiereProductCard;
