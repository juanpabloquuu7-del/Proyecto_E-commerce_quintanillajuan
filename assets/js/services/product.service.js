/**
 * product.service.js
 * Servicio CRUD completo de productos para LUMIÈRE Fashion & Style.
 * Seed inicial desde /data/products.json · Persistencia en localStorage.
 */

import store from "../core/store.js";
import bus, { EVENTS } from "../core/events.js";
import storage from "./storage.service.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ecommerce_products";
const SEED_URL = "/data/products.json";
const SEED_FLAG = "ecommerce_products_seeded";

// ─── Esquema de validación ──────────────────────────────────────────────────────

const REQUIRED_FIELDS = ["name", "price", "category", "images"];

const VALID_CATEGORIES = [
  "dresses",
  "tops",
  "bottoms",
  "outerwear",
  "accessories",
  "shoes",
  "bags",
  "jewelry",
];

/**
 * Valida un objeto producto.
 * @param {Object} data  - Datos a validar.
 * @param {boolean} partial - Si true, omite validación de campos requeridos (para update).
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate(data, partial = false) {
  const errors = [];

  if (!partial) {
    for (const field of REQUIRED_FIELDS) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        errors.push(`El campo "${field}" es obligatorio.`);
      }
    }
  }

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || data.name.trim().length < 2) {
      errors.push("El nombre debe tener al menos 2 caracteres.");
    }
    if (data.name.length > 120) {
      errors.push("El nombre no puede superar 120 caracteres.");
    }
  }

  if (data.price !== undefined) {
    const price = Number(data.price);
    if (isNaN(price) || price < 0) {
      errors.push("El precio debe ser un número positivo.");
    }
  }

  if (data.compareAtPrice !== undefined && data.compareAtPrice !== null) {
    const cap = Number(data.compareAtPrice);
    if (isNaN(cap) || cap < 0) {
      errors.push("El precio comparativo debe ser un número positivo.");
    }
    if (
      !isNaN(cap) &&
      !isNaN(Number(data.price)) &&
      cap <= Number(data.price)
    ) {
      errors.push(
        "El precio comparativo debe ser mayor que el precio de venta.",
      );
    }
  }

  if (data.category !== undefined) {
    if (!VALID_CATEGORIES.includes(data.category)) {
      errors.push(
        `Categoría inválida. Opciones: ${VALID_CATEGORIES.join(", ")}.`,
      );
    }
  }

  if (data.stock !== undefined) {
    const stock = Number(data.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push("El stock debe ser un entero no negativo.");
    }
  }

  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.length === 0) {
      errors.push("Se requiere al menos una imagen.");
    }
  }

  if (data.sizes !== undefined && !Array.isArray(data.sizes)) {
    errors.push("Los talles deben ser un array.");
  }

  if (data.colors !== undefined && !Array.isArray(data.colors)) {
    errors.push("Los colores deben ser un array.");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Helpers internos ──────────────────────────────────────────────────────────

/** Genera un ID único tipo ULID-lite. */
function generateId() {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Lee la colección completa desde localStorage. */
function readAll() {
  return storage.get(STORAGE_KEY) ?? [];
}

/** Persiste la colección completa en localStorage. */
function writeAll(products) {
  storage.set(STORAGE_KEY, products);
  // Sincroniza el slice del store global
  store.setState("products", { items: products, loading: false, error: null });
}

// ─── Seed inicial ───────────────────────────────────────────────────────────────

/**
 * Carga products.json una sola vez y lo persiste en localStorage.
 * Respeta el flag de seeding para no sobrescribir datos existentes.
 */
async function seedIfNeeded() {
  const alreadySeeded = storage.get(SEED_FLAG);
  if (alreadySeeded) return;

  try {
    const res = await fetch(SEED_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const products = Array.isArray(json) ? json : (json.products ?? []);

    // Normaliza cada producto del seed
    const normalized = products.map((p) => ({
      id: p.id ?? generateId(),
      name: p.name,
      description: p.description ?? "",
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      category: p.category,
      subcategory: p.subcategory ?? null,
      images: Array.isArray(p.images) ? p.images : [p.image].filter(Boolean),
      sizes: p.sizes ?? [],
      colors: p.colors ?? [],
      stock: p.stock ?? 0,
      featured: p.featured ?? false,
      tags: p.tags ?? [],
      rating: p.rating ?? null,
      reviewCount: p.reviewCount ?? 0,
      sku: p.sku ?? null,
      createdAt: p.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    writeAll(normalized);
    storage.set(SEED_FLAG, true);
    bus.emit(EVENTS.PRODUCTS_LOADED, {
      count: normalized.length,
      source: "seed",
    });
  } catch (err) {
    console.error("[ProductService] Seed fallido:", err);
    bus.emit(EVENTS.PRODUCTS_ERROR, { error: err.message, phase: "seed" });
    // Inicializa vacío para no bloquear la app
    if (!storage.get(STORAGE_KEY)) writeAll([]);
  }
}

// ─── Servicio ───────────────────────────────────────────────────────────────────

const ProductService = {
  // ── Init ────────────────────────────────────────────────────────────────────

  /**
   * Inicializa el servicio: seed + carga en store.
   * Debe llamarse una vez desde app.js durante el bootstrap.
   */
  async init() {
    store.setState("products", { items: [], loading: true, error: null });
    await seedIfNeeded();
    const items = readAll();
    store.setState("products", { items, loading: false, error: null });
    return items;
  },

  // ── READ ────────────────────────────────────────────────────────────────────

  /**
   * Retorna todos los productos.
   * @returns {Object[]}
   */
  getAll() {
    return readAll();
  },

  /**
   * Busca un producto por su ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    if (!id) return null;
    return readAll().find((p) => p.id === id) ?? null;
  },

  /**
   * Retorna productos destacados.
   * @param {number} limit
   * @returns {Object[]}
   */
  getFeatured(limit = 8) {
    return readAll()
      .filter((p) => p.featured)
      .slice(0, limit);
  },

  /**
   * Retorna productos relacionados (misma categoría, distinto ID).
   * @param {string} productId
   * @param {number} limit
   * @returns {Object[]}
   */
  getRelated(productId, limit = 4) {
    const product = this.getById(productId);
    if (!product) return [];
    return readAll()
      .filter((p) => p.id !== productId && p.category === product.category)
      .slice(0, limit);
  },

  // ── SEARCH ──────────────────────────────────────────────────────────────────

  /**
   * Búsqueda full-text en name, description y tags.
   * @param {string} query
   * @returns {Object[]}
   */
  search(query) {
    if (!query || typeof query !== "string") return readAll();

    const q = query.toLowerCase().trim();
    if (!q) return readAll();

    return readAll().filter((p) => {
      const inName = p.name.toLowerCase().includes(q);
      const inDescription = (p.description ?? "").toLowerCase().includes(q);
      const inTags = (p.tags ?? []).some((t) => t.toLowerCase().includes(q));
      const inCategory = p.category.toLowerCase().includes(q);
      return inName || inDescription || inTags || inCategory;
    });
  },

  // ── FILTER ──────────────────────────────────────────────────────────────────

  /**
   * Filtra productos por categoría.
   * @param {string} category
   * @returns {Object[]}
   */
  filterByCategory(category) {
    if (!category || category === "all") return readAll();
    return readAll().filter((p) => p.category === category);
  },

  /**
   * Filtrado avanzado con múltiples criterios.
   * @param {Object} filters
   * @param {string}   [filters.category]
   * @param {string}   [filters.subcategory]
   * @param {number}   [filters.minPrice]
   * @param {number}   [filters.maxPrice]
   * @param {string[]} [filters.sizes]
   * @param {string[]} [filters.colors]
   * @param {boolean}  [filters.inStock]
   * @param {boolean}  [filters.onSale]
   * @param {string[]} [filters.tags]
   * @param {string}   [filters.sortBy]  — 'price_asc' | 'price_desc' | 'newest' | 'rating'
   * @returns {Object[]}
   */
  filter(filters = {}) {
    let results = readAll();

    if (filters.category && filters.category !== "all") {
      results = results.filter((p) => p.category === filters.category);
    }

    if (filters.subcategory) {
      results = results.filter((p) => p.subcategory === filters.subcategory);
    }

    if (filters.minPrice !== undefined) {
      results = results.filter((p) => p.price >= Number(filters.minPrice));
    }

    if (filters.maxPrice !== undefined) {
      results = results.filter((p) => p.price <= Number(filters.maxPrice));
    }

    if (filters.sizes?.length) {
      results = results.filter((p) =>
        filters.sizes.some((s) => p.sizes.includes(s)),
      );
    }

    if (filters.colors?.length) {
      results = results.filter((p) =>
        filters.colors.some((c) => p.colors.includes(c)),
      );
    }

    if (filters.inStock) {
      results = results.filter((p) => p.stock > 0);
    }

    if (filters.onSale) {
      results = results.filter(
        (p) => p.compareAtPrice && p.compareAtPrice > p.price,
      );
    }

    if (filters.tags?.length) {
      results = results.filter((p) =>
        filters.tags.some((t) => p.tags.includes(t)),
      );
    }

    // Ordenamiento
    switch (filters.sortBy) {
      case "price_asc":
        results.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        results.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "rating":
        results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      default:
        // Sin ordenamiento adicional
        break;
    }

    return results;
  },

  // ── CREATE ──────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo producto.
   * @param {Object} data
   * @returns {{ success: boolean, product?: Object, errors?: string[] }}
   */
  create(data) {
    const { valid, errors } = validate(data);
    if (!valid) return { success: false, errors };

    const now = new Date().toISOString();
    const product = {
      id: generateId(),
      name: data.name.trim(),
      description: (data.description ?? "").trim(),
      price: Number(data.price),
      compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : null,
      category: data.category,
      subcategory: data.subcategory ?? null,
      images: data.images,
      sizes: data.sizes ?? [],
      colors: data.colors ?? [],
      stock: Number(data.stock ?? 0),
      featured: Boolean(data.featured ?? false),
      tags: data.tags ?? [],
      rating: null,
      reviewCount: 0,
      sku: data.sku ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const products = readAll();
    products.push(product);
    writeAll(products);

    bus.emit(EVENTS.PRODUCT_CREATED, { product });
    return { success: true, product };
  },

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  /**
   * Actualiza un producto existente (merge parcial).
   * @param {string} id
   * @param {Object} data  - Campos a actualizar.
   * @returns {{ success: boolean, product?: Object, errors?: string[] }}
   */
  update(id, data) {
    if (!id) return { success: false, errors: ["ID requerido."] };

    const products = readAll();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1)
      return { success: false, errors: [`Producto "${id}" no encontrado.`] };

    const { valid, errors } = validate(data, true); // validación parcial
    if (!valid) return { success: false, errors };

    // Campos protegidos que no se pueden sobreescribir externamente
    const {
      id: _id,
      createdAt: _c,
      rating: _r,
      reviewCount: _rc,
      ...safeData
    } = data;

    const updated = {
      ...products[index],
      ...safeData,
      // Forzar tipado correcto en campos numéricos si vienen en el patch
      ...(data.price !== undefined && { price: Number(data.price) }),
      ...(data.compareAtPrice !== undefined && {
        compareAtPrice: data.compareAtPrice
          ? Number(data.compareAtPrice)
          : null,
      }),
      ...(data.stock !== undefined && { stock: Number(data.stock) }),
      updatedAt: new Date().toISOString(),
    };

    products[index] = updated;
    writeAll(products);

    bus.emit(EVENTS.PRODUCT_UPDATED, { product: updated });
    return { success: true, product: updated };
  },

  // ── DELETE ──────────────────────────────────────────────────────────────────

  /**
   * Elimina un producto por ID.
   * @param {string} id
   * @returns {{ success: boolean, errors?: string[] }}
   */
  delete(id) {
    if (!id) return { success: false, errors: ["ID requerido."] };

    const products = readAll();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1)
      return { success: false, errors: [`Producto "${id}" no encontrado.`] };

    const [removed] = products.splice(index, 1);
    writeAll(products);

    bus.emit(EVENTS.PRODUCT_DELETED, { id, product: removed });
    return { success: true };
  },

  // ── STOCK ───────────────────────────────────────────────────────────────────

  /**
   * Decrementa el stock de un producto (usado en checkout).
   * @param {string} id
   * @param {number} qty
   * @returns {{ success: boolean, stock?: number, errors?: string[] }}
   */
  decrementStock(id, qty = 1) {
    const product = this.getById(id);
    if (!product)
      return { success: false, errors: ["Producto no encontrado."] };
    if (product.stock < qty)
      return { success: false, errors: ["Stock insuficiente."] };

    const result = this.update(id, { stock: product.stock - qty });
    if (!result.success) return result;

    return { success: true, stock: result.product.stock };
  },

  /**
   * Verifica si un producto tiene stock disponible.
   * @param {string} id
   * @param {number} qty
   * @returns {boolean}
   */
  hasStock(id, qty = 1) {
    const product = this.getById(id);
    return product ? product.stock >= qty : false;
  },

  // ── CATEGORÍAS ──────────────────────────────────────────────────────────────

  /**
   * Retorna el listado de categorías válidas.
   * @returns {string[]}
   */
  getCategories() {
    return [...VALID_CATEGORIES];
  },

  /**
   * Retorna las categorías que tienen al menos un producto.
   * @returns {string[]}
   */
  getActiveCategories() {
    const used = new Set(readAll().map((p) => p.category));
    return VALID_CATEGORIES.filter((c) => used.has(c));
  },

  // ── RESET (dev/test) ────────────────────────────────────────────────────────

  /**
   * Elimina datos y flag de seed. Re-ejecuta el seed desde el JSON.
   * Solo útil en desarrollo.
   */
  async reset() {
    storage.remove(STORAGE_KEY);
    storage.remove(SEED_FLAG);
    return this.init();
  },
};

export default ProductService;
