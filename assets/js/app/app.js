/**
 * app.js
 * Punto de entrada principal de la aplicación LUMIÈRE.
 */
import { Router } from "./core/router.js"; // 👈 Corregido si app.js y core/ están al mismo nivel
import ProductService from "./services/product.service.js";

// Esperamos a que todo el HTML y el DOM estén completamente listos
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando entorno de LUMIÈRE...");

  try {
    // 1. Inicializamos el seeder de productos en localStorage (Base de datos simulada)
    const seedResult = await ProductService.init();
    console.log(
      `📦 Catálogo listo (${seedResult.origin}): ${seedResult.count} productos.`,
    );
  } catch (error) {
    console.error("❌ Error al inicializar el catálogo de productos:", error);
  }

  // 2. Encendemos el enrutador una vez los datos base estén listos en el sistema
  window.appRouter = new Router();
});
