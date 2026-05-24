/**
 * auth.service.js
 * Autenticación frontend para LUMIÈRE Fashion & Style.
 * Login simple con usuarios mock · Sesión persistente · Guards · Eventos.
 */

import store from "../core/store.js";
import bus, { EVENTS } from "../core/events.js";
import storage from "./storage.service.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

const SESSION_KEY = "ecommerce_session"; // localStorage: sesión activa
const USERS_KEY = "ecommerce_users"; // localStorage: registro de usuarios
const REDIRECT_KEY = "ecommerce_auth_redirect"; // sessionStorage: redirect post-login

/** Duración de sesión: 7 días en ms. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Usuarios mock pre-cargados ────────────────────────────────────────────────

const DEFAULT_USERS = [
  {
    id: "user_admin_001",
    email: "admin@mail.com",
    password: "123456", // en producción siempre hash; aquí es mock frontend
    firstName: "Admin",
    lastName: "LUMIÈRE",
    role: "admin",
    avatar: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "user_guest_001",
    email: "user@mail.com",
    password: "123456",
    firstName: "Cliente",
    lastName: "Demo",
    role: "customer",
    avatar: null,
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

// ─── Helpers internos ──────────────────────────────────────────────────────────

/** Asegura que los usuarios por defecto existan en localStorage. */
function seedUsers() {
  const existing = storage.get(USERS_KEY);
  if (!existing || existing.length === 0) {
    storage.set(USERS_KEY, DEFAULT_USERS);
  } else {
    // Garantiza que el admin siempre exista aunque el storage haya mutado
    const hasAdmin = existing.some((u) => u.email === "admin@mail.com");
    if (!hasAdmin) {
      storage.set(USERS_KEY, [DEFAULT_USERS[0], ...existing]);
    }
  }
}

/** Lee todos los usuarios registrados. */
function readUsers() {
  return storage.get(USERS_KEY) ?? [];
}

/** Escribe la lista de usuarios. */
function writeUsers(users) {
  storage.set(USERS_KEY, users);
}

/** Lee la sesión activa. */
function readSession() {
  return storage.get(SESSION_KEY) ?? null;
}

/** Persiste la sesión y actualiza el store. */
function writeSession(session) {
  storage.set(SESSION_KEY, session);
  store.setState("user", {
    isAuthenticated: true,
    profile: session.user,
    role: session.user.role,
    sessionExpiresAt: session.expiresAt,
  });
}

/** Elimina la sesión y limpia el store. */
function clearSession() {
  storage.remove(SESSION_KEY);
  store.setState("user", {
    isAuthenticated: false,
    profile: null,
    role: "guest",
    sessionExpiresAt: null,
  });
}

/**
 * Retorna el perfil público (sin password) de un usuario.
 * @param {Object} user
 * @returns {Object}
 */
function publicProfile(user) {
  const { password: _pw, ...profile } = user;
  return profile;
}

/**
 * Comprueba si una sesión ha expirado.
 * @param {Object} session
 * @returns {boolean}
 */
function isExpired(session) {
  if (!session?.expiresAt) return true;
  return Date.now() > new Date(session.expiresAt).getTime();
}

// ─── Validaciones ──────────────────────────────────────────────────────────────

function validateEmail(email) {
  return (
    typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6;
}

// ─── Servicio ───────────────────────────────────────────────────────────────────

const AuthService = {
  // ── Init ────────────────────────────────────────────────────────────────────

  /**
   * Bootstrap: seed de usuarios, restaura sesión activa en el store.
   * Llamar desde app.js antes de montar el router.
   * @returns {{ isAuthenticated: boolean, user: Object|null }}
   */
  init() {
    seedUsers();

    const session = readSession();

    if (session && !isExpired(session)) {
      // Sesión válida: restaura en store
      store.setState("user", {
        isAuthenticated: true,
        profile: session.user,
        role: session.user.role,
        sessionExpiresAt: session.expiresAt,
      });
      return { isAuthenticated: true, user: session.user };
    }

    if (session && isExpired(session)) {
      // Sesión caducada: limpia silenciosamente
      clearSession();
      bus.emit(EVENTS.SESSION_EXPIRED, {});
    }

    store.setState("user", {
      isAuthenticated: false,
      profile: null,
      role: "guest",
      sessionExpiresAt: null,
    });

    return { isAuthenticated: false, user: null };
  },

  // ── LOGIN ────────────────────────────────────────────────────────────────────

  /**
   * Autentica al usuario con email y password.
   * @param {string}  email
   * @param {string}  password
   * @param {boolean} [remember=false] - Si false, sesión de 24h; si true, 7 días.
   * @returns {{ success: boolean, user?: Object, errors?: string[] }}
   */
  login(email, password, remember = false) {
    // 1. Validaciones de formato
    const errors = [];
    if (!validateEmail(email))
      errors.push("El email no tiene un formato válido.");
    if (!validatePassword(password))
      errors.push("La contraseña debe tener al menos 6 caracteres.");
    if (errors.length) return { success: false, errors };

    // 2. Buscar usuario
    const users = readUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );

    if (!user) {
      return {
        success: false,
        errors: ["No existe una cuenta con ese email."],
      };
    }

    // 3. Verificar password (mock: comparación directa; en prod → bcrypt/hash)
    if (user.password !== password) {
      return { success: false, errors: ["La contraseña es incorrecta."] };
    }

    // 4. Construir sesión
    const ttl = remember ? SESSION_TTL_MS : 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    const profile = publicProfile(user);

    const session = {
      user: profile,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    writeSession(session);

    bus.emit(EVENTS.USER_LOGGED_IN, { user: profile });
    return { success: true, user: profile };
  },

  // ── LOGOUT ───────────────────────────────────────────────────────────────────

  /**
   * Cierra la sesión activa.
   * @returns {{ success: boolean }}
   */
  logout() {
    const session = readSession();
    if (!session) return { success: true }; // ya no había sesión

    const user = session.user;
    clearSession();

    bus.emit(EVENTS.USER_LOGGED_OUT, { user });
    return { success: true };
  },

  // ── SESSION ──────────────────────────────────────────────────────────────────

  /**
   * Indica si hay una sesión activa y no expirada.
   * @returns {boolean}
   */
  isAuthenticated() {
    const session = readSession();
    return Boolean(session && !isExpired(session));
  },

  /**
   * Retorna el perfil del usuario autenticado, o null.
   * @returns {Object|null}
   */
  getUser() {
    const session = readSession();
    if (!session || isExpired(session)) return null;
    return session.user;
  },

  /**
   * Retorna el rol del usuario activo ('admin' | 'customer' | 'guest').
   * @returns {string}
   */
  getRole() {
    return this.getUser()?.role ?? "guest";
  },

  /**
   * Comprueba si el usuario activo tiene un rol específico.
   * @param {string|string[]} roles
   * @returns {boolean}
   */
  hasRole(roles) {
    const current = this.getRole();
    const list = Array.isArray(roles) ? roles : [roles];
    return list.includes(current);
  },

  /**
   * Refresca la fecha de expiración de la sesión activa (renovación sliding).
   * @returns {boolean} true si la sesión fue renovada.
   */
  refreshSession() {
    const session = readSession();
    if (!session || isExpired(session)) return false;

    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    // Solo refresca si queda menos de la mitad del TTL original
    if (remaining > SESSION_TTL_MS / 2) return false;

    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    writeSession(session);
    return true;
  },

  // ── REGISTRO ─────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo usuario y lo autentica automáticamente.
   * @param {Object} data
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.firstName
   * @param {string} data.lastName
   * @returns {{ success: boolean, user?: Object, errors?: string[] }}
   */
  register(data) {
    const errors = [];
    const { email, password, firstName, lastName } = data ?? {};

    if (!validateEmail(email))
      errors.push("El email no tiene un formato válido.");
    if (!validatePassword(password))
      errors.push("La contraseña debe tener al menos 6 caracteres.");
    if (!firstName?.trim()) errors.push("El nombre es obligatorio.");
    if (!lastName?.trim()) errors.push("El apellido es obligatorio.");

    if (errors.length) return { success: false, errors };

    const users = readUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );

    if (exists) {
      return {
        success: false,
        errors: ["Ya existe una cuenta con ese email."],
      };
    }

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: email.trim().toLowerCase(),
      password, // mock frontend; no almacenar en prod
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: "customer",
      avatar: null,
      createdAt: new Date().toISOString(),
    };

    writeUsers([...users, newUser]);
    bus.emit(EVENTS.USER_REGISTERED, { user: publicProfile(newUser) });

    // Auto-login tras registro
    return this.login(email, password, false);
  },

  // ── GUARDS ───────────────────────────────────────────────────────────────────

  /**
   * Guard para rutas protegidas (requieren autenticación).
   * Guarda la URL de destino en sessionStorage para redirect post-login.
   * @param {string} [redirectTo='/login'] - Ruta a la que redirigir si no autenticado.
   * @param {string} [intendedPath]        - Ruta que el usuario intentaba visitar.
   * @returns {{ allowed: boolean, redirect?: string }}
   */
  guardAuth(redirectTo = "/login", intendedPath = null) {
    if (this.isAuthenticated()) return { allowed: true };

    // Guarda el destino original para hacer redirect post-login
    if (intendedPath) {
      sessionStorage.setItem(REDIRECT_KEY, intendedPath);
    }

    return { allowed: false, redirect: redirectTo };
  },

  /**
   * Guard para rutas de invitados (login / register).
   * Redirige al home si el usuario ya está autenticado.
   * @param {string} [redirectTo='/'] - Ruta a la que redirigir si ya autenticado.
   * @returns {{ allowed: boolean, redirect?: string }}
   */
  guardGuest(redirectTo = "/") {
    if (!this.isAuthenticated()) return { allowed: true };
    return { allowed: false, redirect: redirectTo };
  },

  /**
   * Guard para rutas de administrador.
   * @param {string} [redirectTo='/']
   * @returns {{ allowed: boolean, redirect?: string }}
   */
  guardAdmin(redirectTo = "/") {
    if (this.isAuthenticated() && this.hasRole("admin"))
      return { allowed: true };
    return { allowed: false, redirect: redirectTo };
  },

  // ── REDIRECT HELPERS ─────────────────────────────────────────────────────────

  /**
   * Retorna y limpia la ruta de destino guardada antes de que el guard redirigiera.
   * Usar en la página de login después de autenticar con éxito.
   * @returns {string|null}
   */
  consumeIntendedPath() {
    const path = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    return path ?? null;
  },

  // ── UPDATE PROFILE ───────────────────────────────────────────────────────────

  /**
   * Actualiza datos del perfil del usuario autenticado.
   * @param {Object} data - Campos permitidos: firstName, lastName, avatar.
   * @returns {{ success: boolean, user?: Object, errors?: string[] }}
   */
  updateProfile(data) {
    if (!this.isAuthenticated()) {
      return {
        success: false,
        errors: ["Debes iniciar sesión para actualizar tu perfil."],
      };
    }

    const session = readSession();
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === session.user.id);

    if (idx === -1) {
      return { success: false, errors: ["Usuario no encontrado."] };
    }

    const allowed = ["firstName", "lastName", "avatar"];
    const safePatch = Object.fromEntries(
      Object.entries(data ?? {}).filter(([k]) => allowed.includes(k)),
    );

    if (Object.keys(safePatch).length === 0) {
      return {
        success: false,
        errors: ["No hay campos válidos para actualizar."],
      };
    }

    users[idx] = { ...users[idx], ...safePatch };
    writeUsers(users);

    // Actualiza snapshot en la sesión activa
    const updatedProfile = publicProfile(users[idx]);
    session.user = updatedProfile;
    writeSession(session);

    bus.emit(EVENTS.USER_UPDATED, { user: updatedProfile });
    return { success: true, user: updatedProfile };
  },
};

export default AuthService;
