# LUMIÈRE — Documentación del funcionamiento

## Descripción general

Esta aplicación es una tienda e-commerce de moda premium construida con JavaScript moderno y arquitectura basada en componentes y servicios.

https://juanpabloquuu7-del.github.io/Proyecto_E-commerce_quintanillajuan/#/

La página usa enrutamiento hash (`window.location.hash`) para cargar vistas HTML desde `assets/js/pages/*.page.html` y controla:
- Catálogo de productos
- Página de detalle de producto
- Carrito de compras y modal de carrito
- Checkout y creación de pedidos
- Historial de órdenes
- Panel de administración
- Autenticación cliente y administrador

## Estructura principal

- `index.html`: plantilla base que incluye el navbar global, `#app` para la app SPA y el modal del carrito.
- `assets/css/main.css`: estilos globales de la tienda.
- `assets/js/app/app.js`: punto de entrada que inicializa servicios, el carrito y el router.
- `assets/js/core/router.js`: enrutador hash que carga páginas, ejecuta la lógica de cada vista y protege rutas de administrador.
- `assets/js/core/store.js`: store global con persistencia en `localStorage` y subscripciones reactivas.
- `assets/js/core/events.js`: bus de eventos para comunicación desacoplada entre componentes y servicios.
- `assets/js/services/*.js`: servicios de negocio para productos, carrito, órdenes, autenticación y administración.
- `assets/js/components/*.js`: componentes Web Components reutilizables como navbar y toast.
- `assets/js/pages/*.page.html`: vistas HTML que se inyectan en `#app` según la ruta.
- `assets/js/data/products.json`: catálogo inicial de productos.

## Flujo general de la aplicación

1. `app.js` carga la página y ejecuta `ProductService.init()`.
2. `ProductService` intenta cargar productos desde `products.json`. Si falla, usa un fallback local.
3. `CartService.init()` restaura el carrito desde `localStorage`.
4. El `Router` monta la vista correspondiente en `#app` según la ruta actual.
5. El `Router` escucha cambios de hash y clicks en elementos con `data-route` para navegación interna.

## Gestión de productos

- `ProductService` mantiene el catálogo en `localStorage` bajo la clave `ecommerce_products`.
- Normaliza datos, valida campos y convierte precios a formato COP.
- Proporciona filtros que el catálogo usa para:
  - ordenar productos
  - buscar por texto
  - ver sólo ofertas
  - filtrar por categoría
- Lleva control de stock y permite descontar inventario al crear un pedido.

## Carrito de compras

- `CartService` persiste el carrito en `localStorage` con la clave `ecommerce_cart`.
- El carrito mantiene líneas de producto únicas por combinación de producto, talla y color.
- Funciones soportadas:
  - agregar producto al carrito
  - incrementar cantidad
  - disminuir cantidad
  - eliminar línea de carrito
  - calcular subtotal, total, ahorro y cantidad total
- El modal del carrito se abre con eventos `lumiere:open-cart` y muestra:
  - listado de artículos
  - totales
  - botón de checkout

## Checkout y órdenes

- `OrderService` construye pedidos válidos con todos los datos de facturación y envío.
- Valida que el carrito no esté vacío y que los campos de dirección estén completos.
- Al generar una orden, descuenta stock del producto y guarda la orden en el store global.
- El historial de órdenes se muestra en la ruta `/orders`.

## Autenticación y sesiones

- `AuthService` usa un login mock de frontend.
- Usuarios predefinidos:
  - admin@mail.com / 123456
  - user@mail.com / 123456
- La sesión se guarda en `localStorage` con la clave `ecommerce_session`.
- El store global registra el estado de autenticación y el perfil del usuario.
- Soporta expiración de sesión y manejo de guardias en rutas.

## Panel de administración

- `AdminService` controla:
  - login administrativo
  - estado de sesión admin en `localStorage` bajo `admin_session`
  - gestión de categorías de producto
- Rutas protegidas:
  - `/admin/dashboard`
  - `/admin/categories`
  - `/admin/products`
  - `/admin/orders`
- Si el admin no está autenticado, el router redirige a `/admin/login`.

## Componentes reutilizables

- `navbar.component.js`: muestra navegación superior y accesos rápidos.
- `toast.component.js`: notificaciones emergentes para acciones exitosas o errores.
- Los componentes se comunican con la app mediante eventos personalizados.

## Rutas del frontend

- `/` → Home
- `/catalog` → Catálogo completo
- `/product` → Detalle de producto
- `/cart` → Página del carrito
- `/checkout` → Checkout
- `/orders` → Historial de pedidos
- `/admin/login` → Login admin
- `/admin/dashboard` → Panel admin
- `/admin/categories` → Gestión de categorías
- `/admin/products` → Gestión de productos
- `/admin/orders` → Gestión de órdenes

## Persistencia

La app guarda datos locales para mantener estado entre recargas:
- `ecommerce_products` → productos cargados
- `ecommerce_cart` → carrito de compras
- `ecommerce_session` → sesión de usuario
- `admin_session` → sesión de administrador
- `admin_categories` → categorías configuradas por admin
- `lumiere_store_state` → store global con estado reactivo

## Uso principal

1. Abrir `index.html` en el navegador.
2. Explorar el catálogo desde `Catálogo` o `Novedades`.
3. Ver detalle de producto y agregar al carrito.
4. Abrir el carrito, revisar totales y avanzar a checkout.
5. Completar datos de envío y crear un pedido.
6. Consultar el historial de pedidos en `/orders`.
7. Iniciar sesión admin en `/admin/login` para acceder al panel de administración.

## Credenciales de administrador

- Email: `admin@mail.com`
- Contraseña: `123456`

## Resumen de la arquitectura

- SPA basada en rutas hash y carga dinámica de plantillas.
- Store global centralizado con persistencia `localStorage`.
- Servicios separados por responsabilidad: producto, carrito, órdenes, auth y admin.
- Eventos personalizados para comunicación entre componentes y lógica de la app.
- HTML/CSS/JS puros sin frameworks externos.
