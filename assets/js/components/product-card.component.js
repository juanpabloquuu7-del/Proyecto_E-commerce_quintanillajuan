/**
 * product-card.component.js — Web Component Tarjeta de Producto
 * ─────────────────────────────────────────────────────────────
 * Renderiza una tarjeta de producto completa con:
 * - Imagen principal / secundaria (hover swap)
 * - Badges (Sale, New, Stock)
 * - Rating con estrellas
 * - Precio actual y original
 * - Wishlist toggle
 * - Add to cart con feedback
 * - Ver detalle
 * - Shadow DOM encapsulado
 * ─────────────────────────────────────────────────────────────
 * Uso:
 * <product-card data-product='{"id":"1","name":"..."}'>
 * </product-card>
 *
 * O programáticamente:
 * const card = document.createElement('product-card');
 * card.product = productObject;
 * container.appendChild(card);
 * ─────────────────────────────────────────────────────────────
 */

import { bus, EVENTS } from "../core/events.js";
import store from "../core/store.js";

// ─── Estilos Shadow DOM ───────────────────────────────────────

const STYLES = /* css */ `
  :host {
    display: block;
    --card-radius:     0px;
    --img-ratio:       4 / 5;
    --transition:      250ms cubic-bezier(0.4, 0, 0.2, 1);
    --color-primary:   #1a1a2e;
    --color-accent:    #c9a96e;
    --color-cream:     #faf8f5;
    --color-gray-100:  #f0eeeb;
    --color-gray-200:  #e2ddd7;
    --color-gray-400:  #a09890;
    --color-gray-600:  #5c544d;
    --color-error:     #b83232;
    --color-success:   #2d7a4f;
    --font-display:    'Cormorant Garamond', Georgia, serif;
    --font-body:       'DM Sans', system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Contenedor principal ── */
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: #fff;
    cursor: pointer;
    overflow: hidden;
    transition: box-shadow var(--transition);
    height: 100%;
  }

  .card:hover {
    box-shadow: 0 12px 40px rgba(26,22,16,.12), 0 4px 10px rgba(26,22,16,.06);
  }

  /* ── Imagen ── */
  .img-wrap {
    position: relative;
    overflow: hidden;
    background: var(--color-gray-100);
    aspect-ratio: var(--img-ratio);
    flex-shrink: 0;
  }

  .img-wrap img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity var(--transition), transform 500ms cubic-bezier(0.4,0,0.2,1);
    will-change: transform, opacity;
  }

  .img-primary   { opacity: 1; transform: scale(1); z-index: 1; }
  .img-secondary { opacity: 0; transform: scale(1.04); z-index: 0; }

  .card:hover .img-primary   { opacity: 0; transform: scale(1.04); }
  .card:hover .img-secondary { opacity: 1; transform: scale(1); z-index: 2; }

  /* Skeleton imagen */
  .img-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #f0eeeb 0%, #e2ddd7 40%, #f0eeeb 80%);
    background-size: 300% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    z-index: 3;
    transition: opacity 300ms;
  }

  .img-skeleton.hidden { opacity: 0; pointer-events: none; }

  @keyframes shimmer {
    0%   { background-position: 300% 0; }
    100% { background-position: -300% 0; }
  }

  /* ── Badges ── */
  .badges {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    z-index: 4;
  }

  .badge {
    display: inline-block;
    padding: 3px 8px;
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    line-height: 1.4;
  }

  .badge-sale { background: var(--color-error);   color: #fff; }
  .badge-new  { background: var(--color-primary);  color: var(--color-accent); }
  .badge-out  { background: rgba(26,22,16,.75);    color: #fff; }

  /* ── Wishlist button ── */
  .btn-wish {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,.88);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background var(--transition), transform var(--transition);
    backdrop-filter: blur(4px);
  }

  .btn-wish:hover { background: #fff; transform: scale(1.1); }

  .btn-wish svg {
    width: 16px;
    height: 16px;
    transition: fill var(--transition), stroke var(--transition);
  }

  .btn-wish.active svg {
    fill: var(--color-error);
    stroke: var(--color-error);
  }

  .btn-wish:not(.active) svg {
    fill: none;
    stroke: var(--color-gray-600);
  }

  /* ── Quick Add (aparece en hover) ── */
  .quick-add {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 4;
    padding: 10px;
    transform: translateY(100%);
    transition: transform var(--transition);
  }

  .card:hover .quick-add { transform: translateY(0); }

  .btn-quick {
    width: 100%;
    padding: 10px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--color-primary);
    background: rgba(250,248,245,.95);
    border: none;
    cursor: pointer;
    transition: background var(--transition), color var(--transition);
    backdrop-filter: blur(6px);
  }

  .btn-quick:hover:not(:disabled) {
    background: var(--color-primary);
    color: var(--color-cream);
  }

  .btn-quick:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .btn-quick.loading {
    pointer-events: none;
    color: var(--color-accent);
  }

  .btn-quick.success {
    background: var(--color-success);
    color: #fff;
    pointer-events: none;
  }

  /* ── Body ── */
  .body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px 14px;
    flex: 1;
  }

  /* Categoría */
  .category {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  /* Nombre */
  .name {
    font-family: var(--font-display);
    font-size: clamp(15px, 2vw, 18px);
    font-weight: 400;
    color: var(--color-primary);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    cursor: pointer;
    transition: color var(--transition);
  }

  .name:hover { color: var(--color-accent); }

  /* Rating */
  .rating {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stars {
    display: flex;
    gap: 1px;
  }

  .star {
    width: 11px;
    height: 11px;
    color: var(--color-accent);
  }

  .star.empty { color: var(--color-gray-200); }

  .rating-count {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--color-gray-400);
  }

  /* Precio */
  .price-row {
    display: flex;
    align-items: baseline;
    gap: 7px;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 4px;
  }

  .price-current {
    font-family: var(--font-display);
    font-size: clamp(16px, 2.5vw, 20px);
    font-weight: 600;
    color: var(--color-primary);
  }

  .price-current.on-sale { color: var(--color-error); }

  .price-original {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-gray-400);
    text-decoration: line-through;
  }

  .price-pct {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    color: var(--color-error);
  }

  /* ── Footer ── */
  .footer {
    display: flex;
    gap: 6px;
    padding: 0 14px 14px;
  }

  .btn-detail {
    flex: 1;
    padding: 9px 10px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--color-primary);
    background: transparent;
    border: 1px solid var(--color-gray-200);
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition), color var(--transition);
  }

  .btn-detail:hover {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
  }

  .btn-cart {
    flex: 2;
    padding: 9px 14px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--color-cream);
    background: var(--color-primary);
    border: 1px solid var(--color-primary);
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition);
    position: relative;
    overflow: hidden;
  }

  .btn-cart:hover:not(:disabled) {
    background: #0f0f1a;
    border-color: #0f0f1a;
  }

  .btn-cart:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .btn-cart.loading { color: transparent; }

  .btn-cart.success {
    background: var(--color-success);
    border-color: var(--color-success);
    pointer-events: none;
  }

  /* Spinner botón */
  .btn-spinner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 150ms;
  }

  .btn-cart.loading  .btn-spinner,
  .btn-quick.loading .btn-spinner { opacity: 1; }

  .spinner-ring {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Responsive ── */
  @media (max-width: 400px) {
    .body    { padding: 10px 10px 10px; gap: 5px; }
    .footer  { padding: 0 10px 10px; }
    .btn-cart, .btn-detail { font-size: 10px; padding: 8px 8px; }
  }

  /* ── Foco accesible ── */
  .btn-cart:focus-visible,
  .btn-detail:focus-visible,
  .btn-wish:focus-visible,
  .btn-quick:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  /* ── Out of stock overlay ── */
  .out-overlay {
    position: absolute;
    inset: 0;
    background: rgba(250,248,245,.55);
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .out-label {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    background: rgba(26,22,16,.82);
    color: #fff;
    padding: 6px 14px;
    backdrop-filter: blur(4px);
  }
`;

// ─── Clase Web Component ──────────────────────────────────────

class ProductCard extends HTMLElement {
  // ── Observed attributes ──────────────────────────────────────
  static get observedAttributes() {
    return ["data-product"];
  }

  constructor() {
    super();

    /** Shadow root encapsulado */
    this._shadow = this.attachShadow({ mode: "open" });

    /**
     * Datos del producto activo.
     * @type {Object|null}
     * @private
     */
    this._product = null;

    /**
     * Si el producto está en wishlist.
     * @private
     */
    this._inWishlist = false;

    /**
     * Contexto del EventBus para cleanup automático.
     * @private
     */
    this._bus = null;

    /**
     * Abort controller para operaciones async.
     * @private
     */
    this._abortCtrl = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  connectedCallback() {
    // Registrar contexto del bus
    this._bus = bus.context("ProductCard");

    // Escuchar cambios de wishlist del store
    this._unsubWishlist = store.subscribe("wishlist", () => {
      this._syncWishlist();
    });

    // Leer producto desde atributo si existe
    const attr = this.getAttribute("data-product");
    if (attr && !this._product) {
      try {
        this._product = JSON.parse(attr);
      } catch {
        console.warn("[ProductCard] data-product JSON inválido.");
      }
    }

    this._render();
  }

  disconnectedCallback() {
    this._bus?.destroy();
    this._unsubWishlist?.();
    this._abortCtrl?.abort();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "data-product" && newVal && newVal !== oldVal) {
      try {
        this._product = JSON.parse(newVal);
        if (this.isConnected) this._render();
      } catch {
        console.warn(
          "[ProductCard] data-product JSON inválido en attributeChangedCallback.",
        );
      }
    }
  }

  // ── Setter programático ──────────────────────────────────────

  /**
   * Asigna el producto directamente como objeto.
   * @param {Object} productData
   */
  set product(productData) {
    if (!productData || typeof productData !== "object") return;
    this._product = productData;
    if (this.isConnected) this._render();
  }

  get product() {
    return this._product;
  }

  // ── Render ───────────────────────────────────────────────────

  /**
   * Renderiza el Shadow DOM completo.
   * @private
   */
  _render() {
    const p = this._product;
    if (!p) {
      this._shadow.innerHTML = this._skeletonHTML();
      return;
    }

    // Datos derivados
    this._inWishlist = store.isInWishlist(p.id);
    const inCart = store.isInCart(p.id);
    const onSale = p.originalPrice && p.originalPrice > p.price;
    const pct = onSale ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    const outOfStock = (p.stock ?? 1) <= 0;
    const imgSec = p.images?.[1] || p.image;

    this._shadow.innerHTML = /* html */ `
      <style>${STYLES}</style>

      <article
        class="card"
        role="article"
        aria-label="${this._esc(p.name)}"
        itemscope
        itemtype="https://schema.org/Product">

        <!-- ── Imagen ── -->
        <div class="img-wrap" aria-hidden="true">

          <!-- Skeleton -->
          <div class="img-skeleton" id="skeleton"></div>

          <!-- Imagen principal -->
          <img
            class="img-primary"
            src="${this._esc(p.image)}"
            alt="${this._esc(p.name)}"
            loading="lazy"
            decoding="async"
            id="img-primary"
            itemprop="image" />

          <!-- Imagen secundaria (hover) -->
          <img
            class="img-secondary"
            src="${this._esc(imgSec)}"
            alt="${this._esc(p.name)} — vista alternativa"
            loading="lazy"
            decoding="async"
            id="img-secondary" />

          <!-- Badges -->
          <div class="badges" aria-label="Etiquetas del producto">
            ${onSale ? `<span class="badge badge-sale" role="img" aria-label="Oferta">-${pct}%</span>` : ""}
            ${p.isNew ? `<span class="badge badge-new"  role="img" aria-label="Nuevo">New</span>` : ""}
            ${outOfStock ? `<span class="badge badge-out"  role="img" aria-label="Sin stock">Agotado</span>` : ""}
          </div>

          <!-- Wishlist -->
          <button
            class="btn-wish ${this._inWishlist ? "active" : ""}"
            id="btn-wish"
            aria-label="${this._inWishlist ? "Quitar de favoritos" : "Añadir a favoritos"}"
            aria-pressed="${this._inWishlist}"
            type="button">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"
                 fill="${this._inWishlist ? "currentColor" : "none"}"
                 aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935
                   0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733
                   -4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9
                   12.75 9 12.75s9-5.53 9-12.75z"/>
            </svg>
          </button>

          <!-- Quick add (hover) -->
          ${
            !outOfStock
              ? /* html */ `
            <div class="quick-add">
              <button
                class="btn-quick"
                id="btn-quick"
                type="button"
                aria-label="Agregar rápidamente al carrito">
                <span class="btn-text">Agregar al carrito</span>
                <span class="btn-spinner" aria-hidden="true">
                  <span class="spinner-ring"></span>
                </span>
              </button>
            </div>
          `
              : ""
          }

          <!-- Out of stock overlay -->
          ${
            outOfStock
              ? /* html */ `
            <div class="out-overlay" aria-hidden="true">
              <span class="out-label">Sin stock</span>
            </div>
          `
              : ""
          }

        </div>

        <!-- ── Body ── -->
        <div class="body">
          <!-- Categoría -->
          <span class="category" itemprop="category">
            ${this._esc(p.category || "")}
          </span>

          <!-- Nombre -->
          <h3
            class="name"
            id="product-name"
            itemprop="name"
            title="${this._esc(p.name)}">
            ${this._esc(p.name)}
          </h3>

          <!-- Rating -->
          ${this._ratingHTML(p.rating, p.reviewCount)}

          <!-- Precio -->
          <div class="price-row" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
            <meta itemprop="priceCurrency" content="COP" />
            <span
              class="price-current ${onSale ? "on-sale" : ""}"
              itemprop="price"
              content="${p.price}">
              ${this._formatPrice(p.price)}
            </span>
            ${onSale ? `<span class="price-original">${this._formatPrice(p.originalPrice)}</span>` : ""}
            ${onSale ? `<span class="price-pct" aria-label="Descuento del ${pct}%">-${pct}%</span>` : ""}
          </div>
        </div>

        <!-- ── Footer ── -->
        <div class="footer">
          <button
            class="btn-detail"
            id="btn-detail"
            type="button"
            aria-label="Ver detalle de ${this._esc(p.name)}">
            Detalle
          </button>

          <button
            class="btn-cart ${inCart ? "success" : ""}"
            id="btn-cart"
            type="button"
            ?disabled="${outOfStock}"
            ${outOfStock ? "disabled" : ""}
            aria-label="${outOfStock ? "Sin stock" : `Agregar ${this._esc(p.name)} al carrito`}">
            <span class="btn-text">
              ${outOfStock ? "Sin stock" : inCart ? "✓ En carrito" : "Agregar"}
            </span>
            <span class="btn-spinner" aria-hidden="true">
              <span class="spinner-ring"></span>
            </span>
          </button>
        </div>

      </article>
    `;

    this._bindEvents();
    this._setupImageLoading();
  }

  // ── Eventos ───────────────────────────────────────────────────

  /**
   * Enlaza todos los listeners del Shadow DOM.
   * @private
   */
  _bindEvents() {
    const shadow = this._shadow;

    // Wishlist
    shadow.getElementById("btn-wish")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleWishlist();
    });

    // Quick add (hover)
    shadow.getElementById("btn-quick")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._addToCart("btn-quick");
    });

    // Botón cart (footer)
    shadow.getElementById("btn-cart")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._addToCart("btn-cart");
    });

    // Botón detalle
    shadow.getElementById("btn-detail")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._openDetail();
    });

    // Click en nombre → detalle
    shadow
      .getElementById("product-name")
      ?.addEventListener("click", () => this._openDetail());

    // Click en imagen → detalle
    shadow
      .querySelector(".img-wrap")
      ?.addEventListener("click", () => this._openDetail());
  }

  /**
   * Gestiona la carga de imágenes y oculta el skeleton.
   * @private
   */
  _setupImageLoading() {
    const skeleton = this._shadow.getElementById("skeleton");
    const imgPrimary = this._shadow.getElementById("img-primary");
    if (!imgPrimary || !skeleton) return;

    const hide = () => skeleton.classList.add("hidden");

    if (imgPrimary.complete) {
      hide();
    } else {
      imgPrimary.addEventListener("load", hide, { once: true });
      imgPrimary.addEventListener(
        "error",
        () => {
          imgPrimary.src = this._placeholder();
          hide();
        },
        { once: true },
      );
    }
  }

  // ── Acciones ─────────────────────────────────────────────────

  /**
   * Navega al detalle del producto.
   * @private
   */
  _openDetail() {
    if (!this._product?.id) return;
    bus.emit(EVENTS.NAVIGATE, { route: `/product/${this._product.id}` });
  }

  /**
   * Agrega el producto al carrito con feedback visual.
   * @param {'btn-cart'|'btn-quick'} btnId
   * @private
   */
  async _addToCart(btnId) {
    const p = this._product;
    if (!p || (p.stock ?? 1) <= 0) return;

    const btn = this._shadow.getElementById(btnId);
    if (
      !btn ||
      btn.classList.contains("loading") ||
      btn.classList.contains("success")
    )
      return;

    // Estado loading
    btn.classList.add("loading");
    btn.disabled = true;

    try {
      // Simular latencia mínima para feedback visual
      await new Promise((r) => setTimeout(r, 420));

      // Emitir evento para que CartService lo procese
      bus.emit(EVENTS.CART_ITEM_ADDED, {
        item: {
          productId: p.id,
          name: p.name,
          price: p.price,
          originalPrice: p.originalPrice ?? null,
          image: p.image,
          category: p.category,
          size: p.sizes?.[0] ?? null,
          color: p.colors?.[0] ?? null,
          quantity: 1,
        },
      });

      // Estado success
      btn.classList.remove("loading");
      btn.classList.add("success");
      btn.querySelector(".btn-text").textContent = "✓ Agregado";

      // Toast de confirmación
      bus.emit(EVENTS.TOAST_SHOW, {
        type: "success",
        title: "Producto agregado",
        message: `${p.name} está en tu carrito.`,
      });

      // Restaurar botón tras 2.5s
      setTimeout(() => {
        if (!this.isConnected) return;
        btn.classList.remove("success");
        btn.disabled = false;
        btn.querySelector(".btn-text").textContent =
          btnId === "btn-cart" ? "Agregar" : "Agregar al carrito";
      }, 2500);
    } catch (err) {
      btn.classList.remove("loading");
      btn.disabled = false;
      bus.emit(EVENTS.TOAST_SHOW, {
        type: "error",
        title: "Error",
        message: "No se pudo agregar el producto.",
      });
    }
  }

  /**
   * Alterna el estado de wishlist del producto.
   * @private
   */
  _toggleWishlist() {
    const p = this._product;
    if (!p?.id) return;

    const isIn = store.isInWishlist(p.id);

    if (isIn) {
      // Quitar de wishlist
      const current = store.getState("wishlist").items;
      store.setState("wishlist", {
        items: current.filter((id) => id !== p.id),
      });
      bus.emit(EVENTS.WISHLIST_REMOVED, { productId: p.id });
      bus.emit(EVENTS.TOAST_SHOW, {
        type: "info",
        title: "Eliminado de favoritos",
        message: `${p.name} fue removido de tu wishlist.`,
      });
    } else {
      // Añadir a wishlist
      const current = store.getState("wishlist").items;
      store.setState("wishlist", {
        items: [...current, p.id],
      });
      bus.emit(EVENTS.WISHLIST_ADDED, { productId: p.id });
      bus.emit(EVENTS.TOAST_SHOW, {
        type: "success",
        title: "Añadido a favoritos",
        message: `${p.name} está en tu wishlist.`,
      });
    }

    this._syncWishlist();
  }

  /**
   * Sincroniza el estado visual del botón wishlist con el store.
   * @private
   */
  _syncWishlist() {
    if (!this._product?.id) return;
    this._inWishlist = store.isInWishlist(this._product.id);

    const btn = this._shadow.getElementById("btn-wish");
    if (!btn) return;

    const svg = btn.querySelector("svg");

    if (this._inWishlist) {
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", "Quitar de favoritos");
      if (svg) svg.setAttribute("fill", "currentColor");
    } else {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Añadir a favoritos");
      if (svg) svg.setAttribute("fill", "none");
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Genera el HTML de las estrellas de rating.
   * @param {number} [rating=0]
   * @param {number} [count=0]
   * @returns {string}
   * @private
   */
  _ratingHTML(rating = 0, count = 0) {
    if (!rating) return "";
    const full = Math.floor(rating);
    const empty = 5 - full;
    const stars = [
      ...Array(full).fill(/* html */ `
        <svg class="star" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902
            0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371
            1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07
            3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1
            1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197
            -1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98
            8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
            00.951-.69l1.07-3.292z"/>
        </svg>`),
      ...Array(empty).fill(/* html */ `
        <svg class="star empty" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902
            0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371
            1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07
            3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1
            1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197
            -1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98
            8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
            00.951-.69l1.07-3.292z"/>
        </svg>`),
    ].join("");

    return /* html */ `
      <div class="rating" role="img" aria-label="Calificación: ${rating} de 5 estrellas">
        <div class="stars">${stars}</div>
        ${count ? `<span class="rating-count">(${count})</span>` : ""}
      </div>
    `;
  }

  /**
   * Formatea un número como precio colombiano (COP).
   * @param {number} value
   * @returns {string}
   * @private
   */
  _formatPrice(value) {
    if (value == null) return "";
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

  /**
   * SVG placeholder cuando la imagen falla.
   * @returns {string} Data URI
   * @private
   */
  _placeholder() {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 400 500'%3E%3Crect width='400' height='500'
      fill='%23f0eeeb'/%3E%3Ctext x='50%25' y='50%25'
      font-family='Georgia' font-size='14' fill='%23a09890'
      text-anchor='middle' dy='.3em'%3ESin imagen%3C/text%3E%3C/svg%3E`;
  }

  /**
   * HTML del skeleton mientras no hay datos de producto.
   * @returns {string}
   * @private
   */
  _skeletonHTML() {
    return /* html */ `
      <style>${STYLES}</style>
      <div class="card" aria-busy="true" aria-label="Cargando producto...">
        <div class="img-wrap">
          <div class="img-skeleton"></div>
        </div>
        <div class="body" style="gap:8px">
          <div style="height:10px;width:50%;background:var(--color-gray-100);
               border-radius:2px;animation:shimmer 1.5s ease-in-out infinite;
               background-size:300% 100%;background-image:linear-gradient(90deg,
               #f0eeeb 0%,#e2ddd7 40%,#f0eeeb 80%)"></div>
          <div style="height:18px;width:80%;background:var(--color-gray-100);
               border-radius:2px;animation:shimmer 1.5s ease-in-out infinite;
               background-size:300% 100%;background-image:linear-gradient(90deg,
               #f0eeeb 0%,#e2ddd7 40%,#f0eeeb 80%)"></div>
          <div style="height:16px;width:40%;background:var(--color-gray-100);
               border-radius:2px;animation:shimmer 1.5s ease-in-out infinite;
               background-size:300% 100%;background-image:linear-gradient(90deg,
               #f0eeeb 0%,#e2ddd7 40%,#f0eeeb 80%)"></div>
        </div>
      </div>
    `;
  }
}

// ─── Registro ─────────────────────────────────────────────────

if (!customElements.get("product-card")) {
  customElements.define("product-card", ProductCard);
}

// ─── Exports ──────────────────────────────────────────────────

export default ProductCard;
export { ProductCard };
