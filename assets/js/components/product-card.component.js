/**
 * product-card.component.js
 * Web Component <lumiere-product-card> — tarjeta de producto oficial para LUMIÈRE.
 * Shadow DOM · Imagen con overlay · Badge sale · Wishlist · Cart · Detalle.
 */

import { bus, EVENTS } from "../core/events.js";
import store from "../core/store.js";
import CartService from "../services/cart.service.js";

const TAG_NAME = "lumiere-product-card";

// Imagen placeholder SVG inline para evitar dependencias de red durante cargas lentas
const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f0ece6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23a09890'%3EImagen no disponible%3C/text%3E%3C/svg%3E`;

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    display: block;
    font-family: 'DM Sans', system-ui, sans-serif;
    background-color: var(--color-white, #ffffff);
    transition: transform 0.3s ease;
  }

  :host(:hover) {
    transform: translateY(-4px);
  }

  .card-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    cursor: pointer;
  }

  /* Contenedor de la Imagen y Overlays */
  .image-container {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background-color: var(--color-gray-100, #f0eeeb);
    overflow: hidden;
  }

  .image-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .card-wrapper:hover .image-container img {
    transform: scale(1.05);
  }

  /* Capa de acciones superiores (Badges y Favoritos) */
  .top-actions {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    z-index: 2;
  }

  .badge {
    background-color: var(--color-primary, #1a1a2e);
    color: var(--color-white, #ffffff);
    padding: 4px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .badge.sale {
    background-color: var(--color-accent, #c9a96e);
    color: var(--color-primary-dark, #0f0f1a);
  }

  .wishlist-btn {
    background: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    transition: background-color 0.2s, color 0.2s;
    color: var(--color-gray-400, #a09890);
  }

  .wishlist-btn:hover, .wishlist-btn.active {
    color: #e63946;
  }

  .wishlist-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* Menú de herramientas flotante inferior (Quick view / Add to Cart) */
  .action-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%);
    display: flex;
    gap: 8px;
    transform: translateY(100%);
    transition: transform 0.3s ease;
    z-index: 3;
  }

  .card-wrapper:hover .action-overlay {
    transform: translateY(0);
  }

  .btn-action {
    flex: 1;
    background-color: var(--color-white, #ffffff);
    color: var(--color-primary, #1a1a2e);
    border: none;
    padding: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.2s, color 0.2s;
  }

  .btn-action:hover {
    background-color: var(--color-primary, #1a1a2e);
    color: var(--color-white, #ffffff);
  }

  /* Bloque de Información del Producto */
  .info {
    padding: 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .category {
    font-size: 0.75rem;
    color: var(--color-gray-400, #a09890);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .title {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--color-primary, #1a1a2e);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .price-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }

  .price {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-primary, #1a1a2e);
  }

  .old-price {
    font-size: 0.85rem;
    color: var(--color-gray-400, #a09890);
    text-decoration: line-through;
  }
`;

export class LumiereProductCard extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: "open" });
    this._product = null;
    this._wished = false;
  }

  /**
   * Método público usado por el Router para setear los datos dinámicos del catálogo
   * @param {Object} productData
   */
  setProduct(productData) {
    this._product = productData;

    // Validamos si este producto se encuentra en la lista de deseos guardada en el store
    const wishlistItems = store.getState("wishlist")?.items || [];
    this._wished = wishlistItems.some((id) => id === this._product.id);

    this.render();
    this._setupListeners();
  }

  _setupListeners() {
    if (!this._product) return;

    // 1. Clic en el cuerpo de la tarjeta (Redirige al detalle extendido)
    const card = this._shadow.querySelector(".card-wrapper");
    card?.addEventListener("click", (e) => {
      // Evitamos la navegación si el clic se originó en los botones interactivos superiores o del overlay
      if (
        e.target.closest(".wishlist-btn") ||
        e.target.closest(".action-overlay")
      ) {
        return;
      }
      window.location.hash = `/product?id=${this._product.id}`;
    });

    // 2. Clic en el botón de favoritos (Wishlist)
    const wishBtn = this._shadow.querySelector(".wishlist-btn");
    wishBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._wished = !this._wished;

      let currentWishlist = store.getState("wishlist")?.items || [];
      if (this._wished) {
        currentWishlist.push(this._product.id);
      } else {
        currentWishlist = currentWishlist.filter(
          (id) => id !== this._product.id,
        );
      }

      store.setState("wishlist", { items: currentWishlist });
      this.render();
      this._setupListeners(); // Re-vinculamos eventos tras el re-renderizado
    });

    // 3. Botón "Vista Rápida" dentro del overlay (Abre el modal)
    const quickViewBtn = this._shadow.querySelector(".btn-quickview");
    quickViewBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      bus.emit(EVENTS.PRODUCT_OPEN_MODAL, { product: this._product });
    });

    // 4. Botón "Añadir a la Bolsa" inmediato dentro del overlay
    const addCartBtn = this._shadow.querySelector(".btn-addcart");
    addCartBtn?.addEventListener("click", (e) => {
      e.stopPropagation();

      const defaultSize = this._product.sizes?.[0] || null;
      const result = CartService.addItem(this._product.id, 1, defaultSize);
      if (!result.success) return;

      // Notificamos opcionalmente mediante el bus para lanzar una alerta visual (toast)
      bus.emit(EVENTS.CART_UPDATED, {
        action: "add_item",
        productId: this._product.id,
      });
    });
  }

  render() {
    if (!this._product) {
      this._shadow.innerHTML = "";
      return;
    }

    const p = this._product;
    const mainImage = p.image || (p.images && p.images[0]) || PLACEHOLDER_SVG;
    const hasDiscount = p.compareAtPrice && p.compareAtPrice > p.price;

    const formattedPrice = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(p.price);

    const formattedOldPrice = hasDiscount
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(p.compareAtPrice)
      : "";

    this._shadow.innerHTML = `
      <style>${STYLES}</style>
      
      <div class="card-wrapper" role="article" aria-label="${p.name}">
        <div class="image-container">
          
          <div class="top-actions">
            <div>
              ${p.onSale || hasDiscount ? `<span class="badge sale">Oferta</span>` : p.isNew ? `<span class="badge">Nuevo</span>` : ""}
            </div>
            <button class="wishlist-btn ${this._wished ? "active" : ""}" aria-label="${this._wished ? "Quitar de favoritos" : "Añadir a favoritos"}">
              <svg viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
          </div>

          <img src="${mainImage}" alt="${p.name}" loading="lazy" onerror="this.src='${PLACEHOLDER_SVG}'">

          <div class="action-overlay">
            <button class="btn-action btn-quickview">Vista Rápida</button>
            <button class="btn-action btn-addcart">Añadir</button>
          </div>
        </div>

        <div class="info">
          <span class="category">${p.category || "Colección"}</span>
          <h3 class="title">${p.name}</h3>
          <div class="price-wrapper">
            <span class="price">${formattedPrice}</span>
            ${hasDiscount ? `<span class="old-price">${formattedOldPrice}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define(TAG_NAME, LumiereProductCard);
export default LumiereProductCard;
