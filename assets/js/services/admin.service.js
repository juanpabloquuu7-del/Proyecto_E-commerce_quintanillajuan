import storage from "./storage.service.js";

const AUTH_KEY = "admin_session";
const CATEGORY_KEY = "admin_categories";

const DEFAULT_CATEGORIES = [
  {
    id: "dresses",
    name: "Vestidos",
    description: "Piezas clave para looks editoriales y eventos especiales.",
  },
  {
    id: "tops",
    name: "Tops y blusas",
    description: "Líneas básicas y premium para outfits urbanos.",
  },
  {
    id: "bottoms",
    name: "Pantalones y faldas",
    description: "Siluetas fluidas, ajustadas y casuales.",
  },
  {
    id: "outerwear",
    name: "Abrigos y capas",
    description: "Prendas de transición, exterior y estilo estructurado.",
  },
  {
    id: "accessories",
    name: "Accesorios",
    description: "Complementos que elevan la identidad del look.",
  },
  {
    id: "shoes",
    name: "Calzado",
    description: "Estilo, confort y acabado premium para cada colección.",
  },
  {
    id: "bags",
    name: "Bolsos",
    description: "Líneas funcionales con diseño editorial.",
  },
  {
    id: "jewelry",
    name: "Joyas",
    description: "Detalles finales para un acabado sofisticado.",
  },
];

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [...DEFAULT_CATEGORIES];

  const normalized = categories
    .filter(Boolean)
    .map((category) => ({
      id: String(category.id || "").trim().toLowerCase().replace(/\s+/g, "-") || null,
      name: String(category.name || "").trim(),
      description: String(category.description || "").trim(),
    }))
    .filter((category) => category.id && category.name);

  if (normalized.length === 0) {
    return [...DEFAULT_CATEGORIES];
  }

  return normalized;
}

function ensureCategorySeed() {
  const saved = storage.get(CATEGORY_KEY);

  if (!Array.isArray(saved) || saved.length === 0) {
    storage.set(CATEGORY_KEY, normalizeCategories(DEFAULT_CATEGORIES));
    return normalizeCategories(DEFAULT_CATEGORIES);
  }

  const normalized = normalizeCategories(saved);
  storage.set(CATEGORY_KEY, normalized);
  return normalized;
}

const AdminService = {
  getDefaultCredentials() {
    return {
      email: "admin@mail.com",
      password: "123456",
    };
  },

  login(email, password) {
    const { email: expectedEmail, password: expectedPassword } = this.getDefaultCredentials();

    if (email !== expectedEmail || password !== expectedPassword) {
      return { success: false, errors: ["Credenciales inválidas. Verifica el correo y la contraseña."] };
    }

    const session = {
      email,
      role: "admin",
      loggedAt: new Date().toISOString(),
    };

    storage.set(AUTH_KEY, session);
    return { success: true, session };
  },

  logout() {
    storage.remove(AUTH_KEY);
    return true;
  },

  isAuthenticated() {
    return Boolean(storage.get(AUTH_KEY));
  },

  getSession() {
    return storage.get(AUTH_KEY) ?? null;
  },

  getCategories() {
    return ensureCategorySeed();
  },

  getCategoryOptions() {
    return this.getCategories();
  },

  saveCategories(categories) {
    const normalized = normalizeCategories(categories);
    storage.set(CATEGORY_KEY, normalized);
    return normalized;
  },

  createCategory(name, description = "") {
    const trimmedName = String(name || "").trim();
    const trimmedDescription = String(description || "").trim();

    if (!trimmedName) {
      return { success: false, errors: ["El nombre de la categoría es obligatorio."] };
    }

    const categories = this.getCategories();
    const id = trimmedName
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!id) {
      return { success: false, errors: ["La categoría debe tener un nombre válido."] };
    }

    if (categories.some((category) => category.id === id)) {
      return { success: false, errors: ["Ya existe una categoría con ese identificador."] };
    }

    const updated = [...categories, { id, name: trimmedName, description: trimmedDescription }];
    this.saveCategories(updated);

    return { success: true, category: updated[updated.length - 1] };
  },

  updateCategory(id, patch) {
    const categories = this.getCategories();
    const idx = categories.findIndex((category) => category.id === id);

    if (idx === -1) {
      return { success: false, errors: ["Categoría no encontrada."] };
    }

    const next = [...categories];
    next[idx] = {
      ...next[idx],
      ...patch,
      name: String(patch.name ?? next[idx].name).trim(),
      description: String(patch.description ?? next[idx].description).trim(),
    };

    if (!next[idx].name) {
      return { success: false, errors: ["El nombre de la categoría es obligatorio."] };
    }

    this.saveCategories(next);
    return { success: true, category: next[idx] };
  },

  deleteCategory(id) {
    const categories = this.getCategories();
    const next = categories.filter((category) => category.id !== id);

    if (next.length === categories.length) {
      return { success: false, errors: ["Categoría no encontrada."] };
    }

    this.saveCategories(next);
    return { success: true };
  },
};

export default AdminService;
