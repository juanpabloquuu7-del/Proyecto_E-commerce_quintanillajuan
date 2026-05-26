/**
 * router.js
 * Enrutador definitivo para LUMIÈRE.
 */

import { bus, EVENTS } from "./events.js";
import ProductService from "../services/product.service.js";
import CartService from "../services/cart.service.js";
import ToastComponent from "../components/toast.component.js";

const ROUTES = {
  "/": "./assets/js/pages/home.page.html",
  "/catalog": "./assets/js/pages/catalog.page.html",
  "/product": "./assets/js/pages/product-detail.page.html",
  "/cart": "./assets/js/pages/cart.page.html",
  "/checkout": "./assets/js/pages/checkout.page.html",
  "/orders": "./assets/js/pages/orders.page.html",
};

function formatCop(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getProductBadges(product) {
  const badges = [];
  if (product.onSale) badges.push("Oferta");
  if (product.isNew) badges.push("Novedad");
  return badges;
}

function buildCatalogCard(product) {
  const badges = getProductBadges(product);
  const initialSize = product.sizes?.[0] || "Única";

  return `
    <article class="product-card">
      <div class="product-card-media">
        <img src="${product.image || product.images?.[0] || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${product.name}" />
        <div class="product-badges">
          ${badges
            .map((badge) => `<span class="badge ${badge === "Oferta" ? "badge-sale" : "badge-new"}">${badge}</span>`)
            .join("")}
        </div>
      </div>
      <div>
        <p class="product-meta">
          <span>${product.category || "Colección"}</span>
          <span>${initialSize}</span>
        </p>
        <h3>${product.name}</h3>
      </div>
      <div class="product-prices">
        <span class="price-current">${formatCop(product.price)}</span>
        ${product.compareAtPrice ? `<span class="price-compare">${formatCop(product.compareAtPrice)}</span>` : ""}
      </div>
      <p class="product-description">${product.description || "Pieza exclusiva de la colección LUMIÈRE."}</p>
      <div class="product-card-actions">
        <button type="button" class="btn-small btn-add" data-add-to-cart data-id="${product.id}" data-size="${initialSize}">Añadir al carrito</button>
        <a href="#/product?id=${product.id}" class="btn-small btn-detail" data-route="/product">Ver detalle</a>
      </div>
    </article>`;
}

export class Router {
  constructor(appContainer) {
    this.appContainer = appContainer;
    window.addEventListener("hashchange", () => this.handleRoute());

    document.body.addEventListener("click", (e) => {
      const routeBtn = e.target.closest("[data-route]");
      if (routeBtn) {
        e.preventDefault();
        window.location.hash = routeBtn.getAttribute("data-route");
      }
    });
  }

  async init() {
    if (!window.location.hash) {
      window.location.hash = "/";
    } else {
      await this.handleRoute();
    }
  }

  async handleRoute() {
    const fullPath = window.location.hash.slice(1) || "/";
    const pathOnly = fullPath.split("?")[0];
    const templateUrl = ROUTES[pathOnly] || ROUTES["/"];

    try {
      const response = await fetch(templateUrl);
      if (!response.ok) throw new Error("No se pudo cargar la vista");

      const htmlContent = await response.text();
      this.appContainer.innerHTML = htmlContent;
      this._runPageLogic(pathOnly, fullPath);

      bus.emit(EVENTS.ROUTE_CHANGED, { route: pathOnly });
      console.log(`✅ Vista cargada: ${pathOnly}`);
    } catch (error) {
      console.error("❌ [Router Error]:", error);
      this.appContainer.innerHTML = `<h1>404</h1><p>Página no encontrada</p>`;
    }
  }

  _runPageLogic(path, fullPath) {
    switch (path) {
      case "/":
        this._initHomeLogic();
        break;
      case "/catalog":
        this._initCatalogLogic(fullPath);
        break;
      case "/product":
        this._initProductDetailLogic(fullPath);
        break;
      case "/cart":
        this._initCartPageLogic();
        break;
      case "/checkout":
        this._initCheckoutLogic(fullPath);
        break;
      case "/orders":
        this._initOrdersLogic();
        break;
    }
  }

  _initHomeLogic() {
    const app = this.appContainer;
    app.innerHTML = `
      <section class="page-shell">
        <div class="hero-panel">
          <div>
            <p class="hero-tag">Editora de looks premium</p>
            <h1 class="hero-title">Lumière piensa en cada detalle para que tu estilo se vea impecable.</h1>
            <p class="hero-copy">Explora una selección curada de prendas, accesorios y calzado con una estética urbana y sofisticada, diseñada para que te sientas lista para cualquier escenario.</p>
            <div class="hero-actions">
              <button type="button" class="btn-primary" data-route="/catalog">Explorar colección</button>
              <button type="button" class="btn-secondary" data-route="/catalog?onSale=true">Ver ofertas</button>
            </div>
          </div>
          <div class="hero-stat-grid">
            <div class="stat-card">
              <strong>+120</strong>
              <span>looks editoriales</span>
            </div>
            <div class="stat-card">
              <strong>3 días</strong>
              <span>para entrega express</span>
            </div>
            <div class="stat-card">
              <strong>24/7</strong>
              <span>soporte personalizado</span>
            </div>
            <div class="stat-card">
              <strong>Ofertas</strong>
              <span>exclusivas en edición limitada</span>
            </div>
          </div>
        </div>

        <div class="featured-grid">
          <article class="promo-card">
            <h2>Prendas con sello premium</h2>
            <p>Explora estilos que combinan sobriedad, movimiento y piezas que hacen diferencia en cada look.</p>
            <button type="button" class="btn-ghost" data-route="/catalog">Ir al catálogo</button>
          </article>
          <article class="promo-card">
            <h2>Novedades que llegan primero</h2>
            <p>Descubre lo último en colección con lanzamientos recientes y edición limitada.</p>
            <button type="button" class="btn-ghost" data-route="/catalog?sort=newest">Ver novedades</button>
          </article>
        </div>
      </section>`;
  }

  _initCatalogLogic(fullPath) {
    const url = new URL(`http://localhost${fullPath}`);
    const params = url.searchParams;
    const sort = params.get("sort") || "relevance";
    const onSale = params.get("onSale") === "true";
    const searchQuery = params.get("search") || "";

    const filters = {
      ...(onSale ? { onSale: true } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
    };

    const products = ProductService.getFiltered(filters, sort);
    const container = this.appContainer;

    container.innerHTML = `
      <section class="page-shell">
        <div class="catalog-header">
          <div>
            <p class="hero-tag">${onSale ? "Edición limitada" : sort === "newest" ? "Lanzamientos recientes" : "Curaduría completa"}</p>
            <h1>${onSale ? "Ofertas" : sort === "newest" ? "Novedades" : "Catálogo"}</h1>
            <p>${onSale ? "Descuentos exclusivos seleccionados para ti" : sort === "newest" ? "Lo último en LUMIÈRE para refrescar tu guardarropa" : "Explora nuestra colección y encuentra tu próxima pieza favorita"}</p>
          </div>
        </div>

        <div class="catalog-controls">
          <label class="search-box">
            <span>Buscar en la colección</span>
            <input id="catalog-search" type="search" placeholder="Prendas, accesorios o estilo" value="${searchQuery}" />
          </label>

          <label class="control-group">
            <span>Ordenar</span>
            <select id="catalog-sort">
              <option value="relevance" ${sort === "relevance" ? "selected" : ""}>Relevancia</option>
              <option value="newest" ${sort === "newest" ? "selected" : ""}>Lo más nuevo</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name_asc">Nombre A-Z</option>
            </select>
          </label>

          <label class="control-group">
            <span>Filtrar</span>
            <select id="catalog-filter">
              <option value="all" ${!onSale ? "selected" : ""}>Todas las piezas</option>
              <option value="sale" ${onSale ? "selected" : ""}>Solo ofertas</option>
            </select>
          </label>
        </div>

        <div class="filter-chips">
          <button type="button" class="filter-chip ${!onSale ? "active" : ""}" data-route="/catalog">Todo</button>
          <button type="button" class="filter-chip ${sort === "newest" ? "active" : ""}" data-route="/catalog?sort=newest">Novedades</button>
          <button type="button" class="filter-chip ${onSale ? "active" : ""}" data-route="/catalog?onSale=true">Ofertas</button>
        </div>

        <div id="catalog-results"></div>
      </section>`;

    const results = container.querySelector("#catalog-results");

    if (!products.length) {
      results.innerHTML = `<div class="empty-state"><h2>No hay productos para esta vista</h2><p>Prueba con otra búsqueda o revisa las ofertas y novedades.</p></div>`;
      return;
    }

    results.innerHTML = `<div class="product-grid">${products.map(buildCatalogCard).join("")}</div>`;

    container.querySelector("#catalog-search")?.addEventListener("input", (event) => {
      const value = event.target.value.trim();
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      if (onSale) params.set("onSale", "true");
      if (sort === "newest") params.set("sort", "newest");
      window.location.hash = `/catalog?${params.toString()}`;
    });

    container.querySelector("#catalog-sort")?.addEventListener("change", (event) => {
      const nextSort = event.target.value;
      const params = new URLSearchParams();
      if (nextSort !== "relevance") params.set("sort", nextSort);
      if (onSale) params.set("onSale", "true");
      if (searchQuery) params.set("search", searchQuery);
      window.location.hash = `/catalog?${params.toString()}`;
    });

    container.querySelector("#catalog-filter")?.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value === "sale") {
        window.location.hash = "/catalog?onSale=true";
        return;
      }
      window.location.hash = "/catalog";
    });

    container.querySelectorAll("[data-add-to-cart]").forEach((button) => {
      button.addEventListener("click", () => {
        const productId = String(button.dataset.id);
        const size = button.dataset.size || null;
        const result = CartService.add(productId, 1, size);

        if (!result.success) {
          ToastComponent.error(result.errors?.[0] || "No se pudo agregar al carrito.");
          return;
        }

        ToastComponent.success("Artículo añadido a la bolsa.");
        if (window.openCartModal) window.openCartModal();
      });
    });
  }

  _initProductDetailLogic(fullPath) {
    const params = new URLSearchParams(fullPath.split("?")[1] || "");
    const productId = params.get("id");
    const product = ProductService.getById(productId);

    if (!product) {
      this.appContainer.innerHTML = `<section class="page-shell"><div class="empty-state"><h1>Producto no disponible</h1><p>La referencia solicitada no existe o ya no está en el inventario.</p><button class="btn-primary" data-route="/catalog">Volver al catálogo</button></div></section>`;
      return;
    }

    const selectedSize = product.sizes?.[0] || "Única";
    const badges = getProductBadges(product);

    this.appContainer.innerHTML = `
      <section class="page-shell">
        <div class="detail-layout">
          <div class="detail-media">
            <div class="detail-main-image">
              <img src="${product.image || product.images?.[0] || "./assets/js/pages/imgs/outfit_1_eclat_noir.png"}" alt="${product.name}" />
            </div>
          </div>

          <div class="detail-info">
            <div class="detail-eyebrow">
              ${badges.map((badge) => `<span class="badge ${badge === "Oferta" ? "badge-sale" : "badge-new"}">${badge}</span>`).join("")}
            </div>
            <p class="hero-tag">${product.category}</p>
            <h1 class="detail-title">${product.name}</h1>
            <p class="detail-description">${product.description}</p>

            <div class="detail-price-row">
              <span class="price-current">${formatCop(product.price)}</span>
              ${product.compareAtPrice ? `<span class="price-compare">${formatCop(product.compareAtPrice)}</span>` : ""}
            </div>

            <div class="detail-meta-grid">
              <div class="meta-pill"><strong>SKU</strong><p>${product.sku || "—"}</p></div>
              <div class="meta-pill"><strong>Stock</strong><p>${product.stock} unidades</p></div>
            </div>

            <div>
              <p><strong>Talla</strong></p>
              <div class="size-selector">
                ${product.sizes.map((size) => `<button type="button" class="size-btn ${size === selectedSize ? "active" : ""}" data-size-btn="${size}">${size}</button>`).join("")}
              </div>
            </div>

            <div class="detail-actions">
              <button type="button" class="btn-primary" id="buy-now-btn">Agregar a la bolsa</button>
              <button type="button" class="btn-secondary" data-route="/catalog">Volver al catálogo</button>
            </div>
          </div>
        </div>
      </section>`;

    let currentSize = selectedSize;

    this.appContainer.querySelectorAll("[data-size-btn]").forEach((button) => {
      button.addEventListener("click", () => {
        currentSize = button.dataset.sizeBtn;
        this.appContainer.querySelectorAll("[data-size-btn]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
      });
    });

    this.appContainer.querySelector("#buy-now-btn")?.addEventListener("click", () => {
      const result = CartService.add(String(product.id), 1, currentSize);
      if (!result.success) {
        ToastComponent.error(result.errors?.[0] || "No se pudo agregar al carrito.");
        return;
      }
      ToastComponent.success(`${product.name} quedó añadido a tu bolsa.`);
      if (window.openCartModal) window.openCartModal();
    });
  }

  _initCartPageLogic() {
    console.log("Lógica Carrito iniciada");
  }

  _initCheckoutLogic() {
    console.log("Lógica Checkout iniciada");
  }

  _initOrdersLogic() {
    console.log("Lógica Órdenes iniciada");
  }
}

export default Router;
