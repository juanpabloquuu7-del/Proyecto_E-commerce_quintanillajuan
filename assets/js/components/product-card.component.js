/**
 * product-card.component.js
 * Web Component <lumiere-product-card> — tarjeta de producto oficial para LUMIÈRE.
 * Shadow DOM · Imagen con overlay · Badge sale · Wishlist · Cart · Detalle.
 */

// CORREGIDO: Importación destructurada de bus y EVENTS para alinearse con core/events.js
import { bus, EVENTS } from "../core/events.js";
import store from "../core/store.js";
import CartService from "../services/cart.service.js";
import router from "../core/router.js";

const TAG_NAME = "lumiere-product-card";

// Imagen placeholder SVG inline (no depende de red)
const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f0ece6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23a09890'%3eImagen no disponible%3C/text%3E%3C/svg%3E`;

const STYLES = /* css */ `
  :host {
    display: block;
    font-family: var(--font-primary, system-ui, sans-serif);
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--color-white, #fff);
    width: 100%;
    height: 100%;
    overflow: hidden;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .img-container {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background-color: var(--color-gray-50, #f9f9f9);
    overflow: hidden;
    cursor: pointer;
  }
  .img-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .card:hover .img-container img {
    transform: scale(1.04);
  }
  .badge {
    position: absolute;
    top: 12px;
    left: 12px;
    background: var(--color-primary, #1a1a2e);
    color: var(--color-white, #fff);
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 4px 10px;
    letter-spacing: 0.05em;
    z-index: 2;
  }
  .badge.sale {
    background: var(--color-accent-dark, #a07840);
  }
  .wishlist-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    color: var(--color-primary, #1a1a2e);
    transition: all 0.25s ease;
    backdrop-filter: blur(4px);
  }
  .wishlist-btn:hover {
    background: var(--color-white, #fff);
    transform: scale(1.05);
  }
  .wishlist-btn.active {
    color: #b12727;
  }
  .wishlist-btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    transition: fill 0.2s ease;
  }
  .wishlist-btn.active svg {
    fill: currentColor;
  }
  .info {
    padding: 14px 4px 6px 4px;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
  .category {
    font-size: 0.72rem;
    text-transform: uppercase;
    color: var(--color-gray-400, #a09890);
    margin-bottom: 4px;
    letter-spacing: 0.08em;
  }
  .title {
    font-size: 0.92rem;
    font-weight: 400;
    color: var(--color-primary, #1a1a2e);
    margin: 0 0 6px 0;
    line-height: 1.4;
    cursor: pointer;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .title:hover {
    color: var(--color-accent, #c9a96e);
  }
  .price-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    margin-top: auto;
  }
  .price {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-primary, #1a1a2e);
  }
  .old-price {
    font-size: 0.82rem;
    text-decoration: line-through;
    color: var(--color-gray-400, #a09890);
  }
  .add-btn {
    width: 100%;
    background: transparent;
    color: var(--color-primary, #1a1a2e);
    border: 1px stroke var(--color-primary, #1a1a2e);
    outline: 1px solid var(--color-primary, #1a1a2e);
    padding: 10px;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .add-btn:hover {
    background: var(--color-primary, #1a1a2e);
    color: var(--color-white, #fff);
  }
  @keyframes pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .wishlist-btn.pop svg {
    animation: pop 0.3s ease;
  }
`;

class LumiereProductCard extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._product = null;
    this._wished = false;

    this._unsubscribeStore = null;
  }

  static get observedAttributes() {
    return ["data-product"];
  }

  connectedCallback() {
    this._render();
    this._setupListeners();

    // Escuchar cambios en la wishlist del store global
    this._unsubscribeStore = store.subscribe("wishlist", (wishlistState) => {
      if (this._product) {
        const ids = wishlistState?.ids ?? [];
        const isNowWished = ids.includes(this._product.id);
        if (isNowWished !== this._wished) {
          this._wished = isNowWished;
          const btn = this._shadow.getElementById("btn-wish");
          if (btn) {
            btn.classList.toggle("active", this._wished);
            btn.setAttribute(
              "aria-label",
              this._wished ? "Quitar de favoritos" : "Añadir a favoritos",
            );
          }
        }
      }
    });
  }

  disconnectedCallback() {
    if (this._unsubscribeStore) this._unsubscribeStore();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "data-product" && newVal !== oldVal) {
      try {
        this.setProduct(JSON.parse(newVal));
      } catch (e) {
        console.error(
          "Error parseando data-product en lumiere-product-card",
          e,
        );
      }
    }
  }

  /**
   * API Pública para inyectar un objeto producto directamente
   * @param {Object} productData
   */
  setProduct(productData) {
    this._product = productData;
    if (this._product) {
      const state = store.getState();
      const wishIds = state.wishlist?.ids ?? [];
      this._wished = wishIds.includes(this._product.id);
    }
    this._render();
    this._setupListeners();
  }

  _setupListeners() {
    const btnCart = this._shadow.getElementById("btn-cart");
    if (btnCart) {
      btnCart.onclick = (e) => {
        e.stopPropagation();
        this._addToCart();
      };
    }

    const btnWish = this._shadow.getElementById("btn-wish");
    if (btnWish) {
      btnWish.onclick = (e) => {
        e.stopPropagation();
        this._toggleWish();
      };
    }

    // Clic en la imagen o en el título abre el modal detallado o navega
    const triggers = this._shadow.querySelectorAll(".js-trigger");
    triggers.forEach((el) => {
      el.onclick = () => {
        if (this._product) {
          bus.emit(EVENTS.PRODUCT_OPEN_MODAL, {
            productId: this._product.id,
            product: this._product,
          });
        }
      };
    });
  }

  _addToCart() {
    if (!this._product) return;

    const result = CartService.addItem(this._product.id, 1);
    if (result.success) {
      bus.emit(EVENTS.TOAST_SHOW ?? "lumiere:toast", {
        message: `¡${this._product.name} añadido al carrito!`,
        type: "success",
      });
      // Opcional: abrir el cajón del carrito automáticamente
      bus.emit(EVENTS.CART_OPEN);
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

    // Actualizar store global de favoritos
    const state = store.getState();
    const ids = new Set(state.wishlist?.ids ?? []);
    this._wished ? ids.add(p.id) : ids.delete(p.id);
    store.setState("wishlist", { ids: [...ids] });

    // Animación y UI local instantánea
    btn.classList.toggle("active", this._wished);
    btn.setAttribute(
      "aria-label",
      this._wished ? "Quitar de favoritos" : "Añadir a favoritos",
    );
    btn.classList.add("pop");
    btn.addEventListener("animationend", () => btn.classList.remove("pop"), {
      once: true,
    });

    // Notificar al sistema
    bus.emit(
      this._wished
        ? (EVENTS.WISHLIST_ADDED ?? "lumiere:wish_add")
        : (EVENTS.WISHLIST_REMOVED ?? "lumiere:wish_remove"),
      { product: p },
    );
  }

  _fmt(val) {
    if (val == null) return "$0";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  }

  _render() {
    if (!this._product) {
      this._shadow.innerHTML = `<style>${STYLES}</style><div class="card" style="padding:20px; text-align:center; color:#999;">Cargando...</div>`;
      return;
    }

    const p = this._product;
    const hasDiscount = p.compareAtPrice && p.compareAtPrice > p.price;
    const isNew = p.tags?.includes("new") || p.isNew;
    const outOfStock = p.stock <= 0;

    const mainImage = p.images?.[0] || PLACEHOLDER_SVG;

    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="card" aria-label="Producto ${p.name}">
        <div class="img-container js-trigger">
          ${outOfStock ? '<span class="badge" style="background:#a09890">Agotado</span>' : hasDiscount ? '<span class="badge sale">Oferta</span>' : isNew ? '<span class="badge">Nuevo</span>' : ""}
          
          <button id="btn-wish" class="wishlist-btn ${this._wished ? "active" : ""}" 
                  aria-label="${this._wished ? "Quitar de favoritos" : "Añadir a favoritos"}">
            <svg viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
          
          <img src="${mainImage}" alt="${p.name}" loading="lazy" onerror="this.src='${PLACEHOLDER_SVG}'">
        </div>

        <div class="info">
          <span class="category">${p.category || "General"}</span>
          <h3 class="title js-trigger">${p.name}</h3>
          
          <div class="price-row">
            <span class="price">${this._fmt(p.price)}</span>
            ${hasDiscount ? `<span class="old-price">${this._fmt(p.compareAtPrice)}</span>` : ""}
          </div>

          <button id="btn-cart" class="add-btn" ${outOfStock ? "disabled style='opacity:0.5; cursor:not-allowed;'" : ""}>
            ${outOfStock ? "Agotado" : "Agregar al Carrito"}
          </button>
        </div>
      </div>
    `;
  }
}

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, LumiereProductCard);
}

export default LumiereProductCard;
