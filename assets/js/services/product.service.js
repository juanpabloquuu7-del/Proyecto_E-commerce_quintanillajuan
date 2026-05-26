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
const SEED_URL = "/assets/js/data/products.json";
const SEED_FLAG = "ecommerce_products_seeded";
const CATEGORY_STORAGE_KEY = "admin_categories";

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

function toCopValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return value;
  if (value < 1000) return Math.round(value * 1000);
  return Math.round(value);
}

function normalizeId(id) {
  if (id === undefined || id === null) return "";
  return String(id);
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) return [];

  return products
    .filter(Boolean)
    .map((product) => {
      const images = Array.isArray(product.images)
        ? product.images
        : product.image
          ? [product.image]
          : [];

      return {
        ...product,
        image: product.image || images[0] || null,
        images,
        price: toCopValue(product.price),
        compareAtPrice:
          product.compareAtPrice === null || product.compareAtPrice === undefined
            ? null
            : toCopValue(product.compareAtPrice),
        sizes: Array.isArray(product.sizes) && product.sizes.length > 0
          ? product.sizes
          : ["Única"],
        stock: Number.isFinite(product.stock) ? product.stock : 0,
      };
    })
    .filter((product) => product.name && product.price !== undefined);
}

/**
 * Valida un objeto producto.
 * @param {Object} data  - Datos a validar.
 * @param {boolean} partial - Si true, omite validación de campos requeridos (para update).
 * @returns {{ valid: boolean, errors: string[] }}
 */
function getConfiguredCategories() {
  const customCategories = storage.get(CATEGORY_STORAGE_KEY) ?? [];

  if (!Array.isArray(customCategories) || customCategories.length === 0) {
    return [...VALID_CATEGORIES];
  }

  const ids = customCategories
    .map((category) => String(category?.id || "").trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : [...VALID_CATEGORIES];
}

function validate(data, partial = false) {
  const errors = [];
  const allowedCategories = getConfiguredCategories();

  if (!partial) {
    for (const field of REQUIRED_FIELDS) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        errors.push(`El campo '${field}' es requerido.`);
      }
    }
  }

  if (
    data.price !== undefined &&
    (typeof data.price !== "number" || data.price < 0)
  ) {
    errors.push("El precio debe ser un número positivo.");
  }

  if (data.compareAtPrice !== undefined && data.compareAtPrice !== null) {
    if (typeof data.compareAtPrice !== "number" || data.compareAtPrice < 0) {
      errors.push("El precio de comparación debe ser un número positivo.");
    }
    if (data.price !== undefined && data.compareAtPrice <= data.price) {
      errors.push(
        "El precio de comparación (antes) debe ser mayor al precio actual.",
      );
    }
  }

  if (data.category !== undefined && !allowedCategories.includes(data.category)) {
    errors.push(
      `Categoría inválida. Valores permitidos: ${allowedCategories.join(", ")}`,
    );
  }

  if (
    data.images !== undefined &&
    (!Array.isArray(data.images) || data.images.length === 0)
  ) {
    errors.push("El campo 'images' debe ser un array no vacío de URLs.");
  }

  if (
    data.stock !== undefined &&
    (!Number.isInteger(data.stock) || data.stock < 0)
  ) {
    errors.push("El stock debe ser un número entero no negativo.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Lee de localStorage de forma segura garantizando un array. */
function readAll() {
  return normalizeProducts(storage.get(STORAGE_KEY) ?? []);
}

/** Escribe en localStorage y sincroniza el store central de manera reactiva. */
function writeAll(products) {
  const normalized = normalizeProducts(products);
  storage.set(STORAGE_KEY, normalized);
  store.setState("products", {
    items: normalized,
    loaded: true,
    updatedAt: new Date().toISOString(),
  });
}

// ─── API del Servicio ───────────────────────────────────────────────────────────

const ProductService = {
  // ── INICIALIZACIÓN (SEEDER) ─────────────────────────────────────────────────

  /**
   * Inicializa el catálogo de productos si no existen datos en el sistema.
   * Descarga el seed inicial vía fetch; si falla, usa un fallback integrado.
   * @returns {Promise<{ origin: 'storage'|'network'|'fallback', count: number }>}
   */
  async init() {
    const localData = readAll();

    try {
      const response = await fetch(SEED_URL);
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);

      const remoteProducts = await response.json();
      const normalizedRemoteProducts = normalizeProducts(remoteProducts);
      if (Array.isArray(normalizedRemoteProducts) && normalizedRemoteProducts.length > 0) {
        writeAll(normalizedRemoteProducts);
        storage.set(SEED_FLAG, true);
        bus.emit(EVENTS.PRODUCTS_LOADED, {
          origin: "network",
          count: normalizedRemoteProducts.length,
        });
        return { origin: "network", count: normalizedRemoteProducts.length };
      }
    } catch (err) {
      console.warn(
        "⚠️ No se pudo descargar seed/products.json, usando respaldo local o fallback:",
        err.message,
      );
    }

    if (Array.isArray(localData) && localData.length > 0 && storage.get(SEED_FLAG)) {
      writeAll(localData);
      return { origin: "storage", count: localData.length };
    }

    // 3. Fallback estático de emergencia por si el servidor local no responde la ruta data/
    const fallbackProducts = [
      {
        id: "prod_dress_001",
        name: "Vestido de Gala Silueta Ébano",
        description:
          "Un diseño icónico de alta costura confeccionado en satén italiano premium. Corte minimalista de caída fluida, escote asimétrico y acabados invisibles hechos a mano. Una pieza atemporal que abraza la silueta contemporánea con sofisticación suprema.",
        price: 345000,
        compareAtPrice: 420000,
        category: "dresses",
        images: ["./assets/js/pages/imgs/outfit_2_ombre_lumiere.png"],
        sizes: ["S", "M", "L"],
        stock: 0,
        sku: "LM-DR-EB01",
        isNew: true,
        onSale: true,
        createdAt: "2024-02-15T18:30:00.000Z",
      },
      {
        id: "prod_outer_002",
        name: "Abrigo Gabardina Aurora Nocturne",
        description:
          "Estructura arquitectónica de doble botonadura en mezcla de lana reciclada y cachemira. Forro interior de seda jacquard satinada. Solapas sobredimensionadas y cinturón ajustable que redefine el urban chic bajo los climas de transición.",
        price: 520000,
        compareAtPrice: null,
        category: "outerwear",
        images: ["./assets/js/pages/imgs/outfit_4_aurora_nocturne.png"],
        sizes: ["M", "L", "XL"],
        stock: 5,
        sku: "LM-OU-AN02",
        isNew: true,
        onSale: false,
        createdAt: "2024-03-01T10:15:00.000Z",
      },
      {
        id: "prod_top_003",
        name: "Blusa Minimalista Lumière Blanche",
        description:
          "Fluidez y pureza en seda crepé de alta densidad. Cuello mao sutil, puños estructurados con gemelos dorados de aleación ligera. Una prenda esencial versátil concebida para transicionar sin esfuerzo del entorno profesional al cóctel nocturno.",
        price: 185000,
        compareAtPrice: null,
        category: "tops",
        images: ["./assets/js/pages/imgs/outfit_5_lumiere_blanche.png"],
        sizes: ["S", "M", "L"],
        stock: 25,
        sku: "LM-TP-LB03",
        isNew: false,
        onSale: false,
        createdAt: "2024-01-20T14:00:00.000Z",
      },
      {
        id: "prod_acc_004",
        name: "Bolso Estructurado Clarté Dorée",
        description:
          "Bolso de mano rígido esculpido en piel bovina texturizada con curtido vegetal sostenible. Herrajes con baño de oro cepillado de 14k y cierre magnético de alta precisión. Interior compartimentado forrado en gamuza suave con bolsillo secreto para tarjetas.",
        price: 290000,
        compareAtPrice: 340000,
        category: "bags",
        images: ["./assets/js/pages/imgs/outfit_3_clarte_doree.png"],
        sizes: ["Única"],
        stock: 7,
        sku: "LM-BG-CD04",
        isNew: false,
        onSale: true,
        createdAt: "2024-02-10T09:45:00.000Z",
      },
      {
        id: "prod_shoes_005",
        name: "Botín de Tacón Rayonnée Noir",
        description:
          "Calzado de autor manufacturado artesanalmente en España. Cuero napa ultra suave de adaptabilidad inmediata. Tacón geométrico facetado de 7cm que brinda un soporte ergonómico inigualable sin comprometer la verticalidad vanguardista.",
        price: 410000,
        compareAtPrice: null,
        category: "shoes",
        images: ["./assets/js/pages/imgs/outfit_6_rayonnee.png"],
        sizes: ["36", "37", "38", "39"],
        stock: 9,
        sku: "LM-SH-RN05",
        isNew: true,
        onSale: false,
        createdAt: "2024-03-10T11:20:00.000Z",
      },
    ];

    writeAll(fallbackProducts);
    storage.set(SEED_FLAG, true);
    bus.emit(EVENTS.PRODUCTS_LOADED, {
      origin: "fallback",
      count: fallbackProducts.length,
    });
    return { origin: "fallback", count: fallbackProducts.length };
  },

  // ── READ OPERATORS ──────────────────────────────────────────────────────────

  /**
   * Obtiene todos los productos del sistema.
   * @returns {Object[]} Array de productos.
   */
  getAll() {
    return readAll();
  },

  /**
   * Busca un producto específico por su ID único.
   * @param {string} id
   * @returns {Object|null} El producto encontrado o null.
   */
  getById(id) {
    if (!id && id !== 0) return null;
    const items = readAll();
    const normalizedId = normalizeId(id);
    return items.find((p) => normalizeId(p.id) === normalizedId) ?? null;
  },

  /**
   * Busca un producto por su código SKU.
   * @param {string} sku
   * @returns {Object|null}
   */
  getBySku(sku) {
    if (!sku) return null;
    const items = readAll();
    return (
      items.find((p) => p.sku?.toLowerCase() === sku.toLowerCase()) ?? null
    );
  },

  /**
   * Filtra y ordena el catálogo de productos con base en múltiples criterios.
   * Usado fuertemente por la pantalla de catálogo / buscador general.
   * * @param {Object} filters
   * @param {string} [filters.category] - Categoría exacta.
   * @param {boolean} [filters.onSale] - Filtrar solo productos en oferta.
   * @param {boolean} [filters.isNew] - Filtrar solo novedades.
   * @param {number} [filters.priceMin] - Rango de precio inferior.
   * @param {number} [filters.priceMax] - Rango de precio superior.
   * @param {string} [filters.search] - Texto libre para buscar en name o description.
   * @param {string} [filters.size] - Filtrar si contiene una talla específica.
   * @param {boolean} [filters.inStock] - Ocultar los que no tienen stock (stock > 0).
   * @param {'price_asc'|'price_desc'|'newest'|'name_asc'|'relevance'} [sort='relevance'] - Criterio de ordenación.
   * @returns {Object[]} Listado de productos filtrados y ordenados.
   */
  getFiltered(filters = {}, sort = "relevance") {
    let products = readAll();

    // Aplicar filtros cumulativos
    if (filters.category && filters.category !== "all") {
      products = products.filter((p) => p.category === filters.category);
    }

    if (filters.onSale === true || filters.onSale === "true") {
      products = products.filter((p) => p.onSale === true);
    }

    if (filters.isNew === true || filters.isNew === "true") {
      products = products.filter((p) => p.isNew === true);
    }

    if (filters.priceMin !== undefined && filters.priceMin !== "") {
      const min = parseFloat(filters.priceMin);
      if (!isNaN(min)) products = products.filter((p) => p.price >= min);
    }

    if (filters.priceMax !== undefined && filters.priceMax !== "") {
      const max = parseFloat(filters.priceMax);
      if (!isNaN(max)) products = products.filter((p) => p.price <= max);
    }

    if (filters.size) {
      products = products.filter((p) => p.sizes?.includes(filters.size));
    }

    if (filters.inStock === true || filters.inStock === "true") {
      products = products.filter((p) => p.stock > 0);
    }

    if (filters.search && filters.search.trim() !== "") {
      const query = filters.search.toLowerCase().trim();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query),
      );
    }

    // Aplicar ordenación (Sort)
    switch (sort) {
      case "price_asc":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "name_asc":
        products.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "relevance":
      default:
        // Mantener orden predeterminado o priorizar stock
        products.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
        break;
    }

    return products;
  },

  // ── WRITE OPERATORS (CRUD MUTATIONS) ────────────────────────────────────────

  /**
   * Registra un nuevo producto en el catálogo.
   * Genera IDs autonuméricos/hashes y estampa fecha de creación.
   * @param {Object} rawData - Atributos del nuevo producto.
   * @returns {{ success: boolean, product?: Object, errors?: string[] }}
   */
  create(rawData) {
    const validation = validate(rawData, false);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const products = readAll();

    // Validar unicidad de SKU si se provee
    if (
      rawData.sku &&
      products.some((p) => p.sku?.toLowerCase() === rawData.sku.toLowerCase())
    ) {
      return {
        success: false,
        errors: [
          `El código SKU '${rawData.sku}' ya está asignado a otro ítem.`,
        ],
      };
    }

    const newProduct = {
      id: `prod_${rawData.category}_${Date.now()}`,
      name: rawData.name,
      description: rawData.description || "",
      price: rawData.price,
      compareAtPrice: rawData.compareAtPrice ?? null,
      category: rawData.category,
      images: rawData.images,
      sizes: rawData.sizes ?? ["Única"],
      stock: rawData.stock ?? 0,
      sku: rawData.sku || `LM-XX-${Math.floor(Math.random() * 90000 + 10000)}`,
      isNew: rawData.isNew ?? true,
      onSale: rawData.compareAtPrice > rawData.price,
      createdAt: new Date().toISOString(),
    };

    products.push(newProduct);
    writeAll(products);

    bus.emit(EVENTS.PRODUCT_CREATED, { product: newProduct });
    return { success: true, product: newProduct };
  },

  /**
   * Modifica los atributos de un producto existente de forma parcial (Patch).
   * @param {string} id - Identificador del ítem a modificar.
   * @param {Object} patchData - Campos modificados.
   * @returns {{ success: boolean, product?: Object, errors?: string[] }}
   */
  update(id, patchData) {
    if (!id) return { success: false, errors: ["ID de producto inválido."] };

    const validation = validate(patchData, true);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const products = readAll();
    const normalizedId = normalizeId(id);
    const idx = products.findIndex((p) => normalizeId(p.id) === normalizedId);
    if (idx === -1)
      return {
        success: false,
        errors: ["Producto no encontrado en el sistema."],
      };

    // Validar SKU si cambió
    if (patchData.sku && patchData.sku !== products[idx].sku) {
      if (
        products.some(
          (p) =>
            p.sku?.toLowerCase() === patchData.sku.toLowerCase() && normalizeId(p.id) !== normalizedId,
        )
      ) {
        return {
          success: false,
          errors: [`El SKU '${patchData.sku}' ya se encuentra registrado.`],
        };
      }
    }

    // Recalcular bandera onSale automáticamente si se modifican precios
    let autoOnSale = products[idx].onSale;
    const finalPrice =
      patchData.price !== undefined ? patchData.price : products[idx].price;
    const finalCompare =
      patchData.compareAtPrice !== undefined
        ? patchData.compareAtPrice
        : products[idx].compareAtPrice;

    if (
      patchData.price !== undefined ||
      patchData.compareAtPrice !== undefined
    ) {
      autoOnSale = finalCompare !== null && finalCompare > finalPrice;
    }

    const updatedProduct = {
      ...products[idx],
      ...patchData,
      onSale: autoOnSale,
      updatedAt: new Date().toISOString(),
    };

    products[idx] = updatedProduct;
    writeAll(products);

    bus.emit(EVENTS.PRODUCT_UPDATED, { product: updatedProduct });
    return { success: true, product: updatedProduct };
  },

  /**
   * Remueve físicamente un producto del inventario mediante su ID.
   * @param {string} id
   * @returns {boolean} True si fue eliminado con éxito.
   */
  delete(id) {
    if (!id) return false;
    const products = readAll();
    const initialLength = products.length;

    const normalizedId = normalizeId(id);
    const filtered = products.filter((p) => normalizeId(p.id) !== normalizedId);
    if (filtered.length === initialLength) return false;

    writeAll(filtered);
    bus.emit(EVENTS.PRODUCT_DELETED, { productId: id });
    return true;
  },

  // ── STOCK STOCK MANAGEMENT ──────────────────────────────────────────────────

  /**
   * Reduce el stock físico tras la consolidación de un pedido de compra.
   * @param {string} id - ID del producto.
   * @param {number} qty - Cantidad comprada a deducir.
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
    return [...getConfiguredCategories()];
  },

  /**
   * Retorna las categorías que tienen al menos un producto.
   * @returns {string[]}
   */
  getActiveCategories() {
    const used = new Set(readAll().map((p) => p.category));
    return getConfiguredCategories().filter((c) => used.has(c));
  },

  // ── RESET (dev/test environment) ───────────────────────────────────────────

  /** Limpia por completo el inventario y borra banderas de inicialización. */
  purge() {
    storage.remove(STORAGE_KEY);
    storage.remove(SEED_FLAG);
    store.setState("products", { items: [], loaded: false });
  },
};

export default ProductService;
