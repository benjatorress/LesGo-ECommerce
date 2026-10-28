# Sprint 1 — Inventario, detalle, checkout y pedidos

## A. Estado por incidencia

Base de implementación: `inventario-checkout-pedidos`, actualizada por fast-forward autorizado a `origin/main` (`0e43d9d`). Sin commits ni push. `frontend/pnpm-lock.yaml` pertenecía al usuario y no se modificó.

| Jira | Estado | Implementación y archivos principales | Verificación | Pendiente externo |
| --- | --- | --- | --- | --- |
| SCRUM-7 | Parcial: adaptador terminado | `backend/services/inventoryService.js`, `httpClient.js`, `adapters/inventoryMapper.js`, controladores de productos/carrito. Modos separados, timeout, errores, normalización y stock. | `backend/test/inventory.test.js`, regresión de filtros mediante HTTP local. | Contrato y credenciales reales de Inventario; verificar contra su API. |
| SCRUM-11 | Completada sobre fuente configurable | Ruta existente `/api/productos/:id`; controlador usa Inventario, devuelve descripción, ficha técnica, imágenes y stock. | Productos existentes, inexistentes, sin stock y errores externos. | Validación de extremo a extremo con Inventario real. |
| SCRUM-12 | Completada | `App.tsx`, `ProductDetailLoader.tsx`, `ProductDetailModal.tsx`, `services/api.ts`, `navigation.ts`, modelo Product. URL, carga/error, historial, imágenes y carrito existente. | Pruebas React en `frontend/src/sprint.test.tsx`, TypeScript/build y lint. | Revisión visual con Benjamín y datos reales. |
| SCRUM-18 | Completada dentro del alcance mock | `CheckoutView.tsx`, `checkout.css`, `checkoutContract.ts`, navegación desde carrito. Usa `CartContext`, sin copiar ni vaciar sus items. | Resumen, formulario, retorno al carrito y ausencia de pagos/POST prematuros. | SCRUM-20 conecta `onConfirm`, validaciones finales y manejo de resultado. |
| SCRUM-19 | Parcial: backend implementado y probado aisladamente | `orderService.js`, `crmService.js`, `sessionService.js`, repositorios, controlador/rutas de pedidos y SQL revisable. | Pruebas de pedidos, endpoints locales, rollback simulado y transacciones PostgreSQL aisladas. | DDL compartido autorizado, identidad real de clientes, autenticación productiva y contrato CRM. |
| SCRUM-46 | Completada localmente; ejecución remota pendiente | `.github/workflows/ci.yml`, scripts npm, lockfiles y Dockerfiles Node 22. Push/PR en cualquier rama, PostgreSQL efímero para tests, build/lint/tests y builds Docker; sin deploy. | Comandos equivalentes ejecutados localmente; ambos builds Docker correctos. | Primera ejecución GitHub Actions después de publicar manualmente la rama/PR. |

“Completada” no significa que se haya verificado un servicio ERP real. No se contactó ni modificó `si2_22026` ni `master`.

## B. Contratos API

### GET `/api/productos`

Público. Conserva alias `/api/products` y filtros existentes:

`categoria`/`category`, `min_precio`/`min_price`, `max_precio`/`max_price`, `min_piezas`, `max_piezas`, `edad`, `search`/`q`, `orden` (`precio_asc`, `precio_desc`, `nombre`, `piezas`).

```json
{
  "success": true,
  "source": "mock",
  "total": 1,
  "filtrosAplicados": { "categoria": "city" },
  "productos": [{
    "id": "lego-city-station",
    "name": "Producto",
    "category": "City",
    "categoria": "City",
    "price": 89990,
    "stock": 5,
    "inventorySource": "mock"
  }]
}
```

Ejemplo abreviado: cada producto también incluye los campos compatibles con Product. La categoría se normaliza en el adaptador backend; `categoria` se conserva como alias para consumidores anteriores. El frontend muestra `PRODUCTS` de `frontend/src/data/products.ts` por defecto, con filtros locales y aviso de datos simulados. Con `VITE_CATALOG_SOURCE=api`, consulta este endpoint sin sustituir sus errores por fixtures. El detalle continúa consultando el backend por ID en ambos modos.

### GET `/api/productos/:id`

Público. Devuelve `{ "success": true, "source": "http", "producto": { ... } }`.

- Campos requeridos del origen: `id` string, `name` string, `price` número finito no negativo, `stock` entero no negativo.
- Campos opcionales: `category`/`categoria`, `theme`, `code`, `pieces`, `age`, `description`, `image`, `images`, `minifigures`, `highlights`, `featured`, `specifications` (objeto de valores string/número). Solo se conservan datos admitidos, sin renderizar HTML externo.
- Imágenes: HTTP(S) o rutas locales; fallback `/product-placeholder.svg`.
- Stock cero no equivale a producto inexistente: responde 200 y deshabilita compra en el detalle. `active: false` normaliza stock a cero.
- Mock admite slug o código de los fixtures; HTTP usa el ID opaco del proveedor. No hay conversión ficticia slug → UUID ni resolución por SKU no documentada.
- Enlaces frontend: `/?view=catalog&producto=<id-codificado>`. Se soportan recarga y atrás/adelante sin React Router.

Errores JSON seguros: 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND`, 502 `INVENTORY_CONTRACT`, 503 `UPSTREAM_UNAVAILABLE`. No incluyen cuerpos, tokens ni errores internos de Inventario.

### POST `/api/pedidos`

Cabeceras:

```http
Authorization: Bearer <token emitido por login del backend>
Idempotency-Key: <clave estable de 8 a 128 caracteres: letras, números, _ o ->
Content-Type: application/json
```

Payload:

```json
{
  "items": [{ "id_producto": "lego-city-station", "cantidad": 2 }],
  "envio": {
    "direccion_entrega": "Calle de ejemplo 123",
    "comuna_entrega": "Antofagasta",
    "ciudad_entrega": "Antofagasta",
    "telefono_contacto": "+56912345678"
  },
  "metodo_pago": "tarjeta",
  "observaciones": "Referencia de entrega opcional"
}
```

En PostgreSQL, `id_producto` debe ser un UUID real entregado por Inventario. El slug del ejemplo es válido **solo con repositorio e Inventario mock**.

Respuesta de creación (201; 200 si se repite la misma clave y solicitud):

```json
{
  "success": true,
  "persistence": "mock",
  "replay": false,
  "pedido": {
    "id_pedido": 8,
    "id_cliente": 1,
    "fecha_pedido": "2026-10-27",
    "estado": "recibida",
    "estado_dominio": "Pendiente",
    "monto_total": 179980,
    "total_items": 2,
    "courier": null,
    "numero_seguimiento": null,
    "detalle": [{
      "id_producto": "lego-city-station",
      "cantidad": 2,
      "precio_unitario": 89990
    }]
  },
  "crm": { "mode": "disabled", "status": "pending" },
  "message": "Pedido creado en estado Pendiente. Sincronización CRM pendiente; no se ha procesado ningún pago."
}
```

La respuesta real también contiene los datos de envío guardados. `id_pedido` se genera en servidor (identity en PostgreSQL). No se recibe ni confía en un total/precio del navegador. `id_cliente` se deriva de la sesión; si se envía uno distinto se rechaza. Se admiten 1–100 líneas, cantidades enteras de 1–10000 por línea; las repetidas se agregan antes de comprobar stock. Métodos admitidos: `tarjeta`, `transferencia`.

Errores relevantes:

| HTTP | Código/situación |
| --- | --- |
| 400 | `INVALID_ORDER`: estructura, envío, cantidades, pago, clave o UUID incompatible. |
| 401 | `UNAUTHENTICATED`: token inexistente, inventado o vencido. |
| 403 | `CUSTOMER_REQUIRED` / `CUSTOMER_MISMATCH`, o consulta de otro cliente. |
| 404 | `PRODUCT_NOT_FOUND`; pedido no encontrado dentro del cliente autorizado. |
| 409 | `INSUFFICIENT_STOCK` / `IDEMPOTENCY_CONFLICT`. |
| 502/503 | Inventario inválido/no disponible; `SCHEMA_NOT_READY`, `PERSISTENCE_UNAVAILABLE`. |
| 500 | Fallo inesperado, sin detalles internos. |

No se insertan cabeceras parciales ante error de líneas/outbox. No se paga, reserva/descuenta inventario ni crea despacho.

### Consultas existentes

El historial PostgreSQL usa dos consultas agrupadas por cliente, sin cargar líneas completas ni payloads de CRM por cada pedido. La revisión eliminó el patrón N+1 introducido en el primer borrador. La paginación del historial queda como mejora posterior coordinada con su responsable: se conserva la lista completa anterior para no ocultar órdenes antiguas sin controles frontend correspondientes. No se midió rendimiento con volúmenes productivos.

- GET `/api/pedidos/cliente/:id`
- GET `/api/pedidos/cliente/:idCliente/:idPedido`

Conservan las formas de respuesta y ahora requieren Bearer del mismo cliente. Comparten repositorio con POST, incluido PostgreSQL. `pedidosApi.ts` envía el token guardado. `Pendiente` se almacena en el dominio y se presenta como `recibida`; solo el primer paso de tracking está completado. Los fixtures históricos de Logística/reclamos se usan únicamente para pedidos mock anteriores, nunca como datos de pedidos reales nuevos.

## C. Configuración y dependencias externas

Plantillas sin secretos: `backend/.env.example`, `frontend/.env.example`. El backend no carga `.env` automáticamente: usar exportación del entorno o `node --env-file=.env index.js` (Node 22).

### Inventario

| Variable | Uso |
| --- | --- |
| `INVENTORY_MODE` | `mock` (desarrollo por defecto) o `http`; no hay fallback entre modos. Mock se rechaza con `NODE_ENV=production`. |
| `INVENTORY_API_URL` | Base HTTP(S), obligatoria en HTTP. |
| `INVENTORY_LIST_PATH` | Ruta confirmada por el proveedor, sin valor inventado por defecto. |
| `INVENTORY_DETAIL_PATH` | Ruta confirmada que contenga `{id}`; se codifica el identificador. |
| `INVENTORY_LIST_ROOT` / `INVENTORY_DETAIL_ROOT` | Ruta JSON con puntos hacia array/producto; vacío significa raíz. |
| `INVENTORY_FIELD_MAP` | JSON `campoCanónico: "ruta.externa"`; los números deben venir como números JSON, no strings. |
| `INVENTORY_API_TOKEN` | Bearer opcional, solo en servidor. |
| `INVENTORY_TIMEOUT_MS` | Timeout positivo, 5000 por defecto; sin reintentos implícitos ni redirecciones HTTP. |

Contrato **requerido/propuesto**, no contrato confirmado del ERP: el listado debe entregar un array y el detalle un producto con los campos indicados. El proveedor debe responder 404 cuando no exista y suministrar precio confiable y stock vendible/activo. Si usa paginación, precios strings, otra semántica de stock o imágenes relativas al ERP, hay que adaptar el mapper conforme a su documentación antes de activar HTTP. No se interpreta una primera página como catálogo completo de forma automática.

Ejemplo de mapeo de campos, condicionado a que el proveedor lo confirme:

```text
INVENTORY_FIELD_MAP={"id":"id_producto","name":"nombre","price":"precio","stock":"existencias.activas","category":"categoria.nombre"}
```

### PostgreSQL

| Variable | Uso |
| --- | --- |
| `ORDER_REPOSITORY` | `mock` o `postgres`; mock es memoria de un proceso y se pierde al reiniciar. Mock prohibido en producción. |
| `DATABASE_URL` | Conexión autorizada; no incluida ni leída de archivos reales durante este trabajo. |
| `DB_ACCESS_ENABLED` | Debe ser exactamente `true` para habilitar el repositorio PostgreSQL tras autorización. |
| `PG_TEST_URL` | Exclusiva para tests: solo localhost/127.0.0.1 y base `lesgo_isolated_test`. Nunca la compartida. |

No se conecta al importar/arrancar en modo mock. En modo PostgreSQL se comprueba `information_schema` antes de operar; faltantes o tipos básicos incompatibles fallan explícitamente. No se ejecuta DDL desde la app. El pool usa consultas parametrizadas; transacción con una conexión para cabecera, líneas y outbox, rollback y release en fallo. Un bloqueo transaccional por cliente/clave evita duplicación concurrente; la outbox tiene unicidad cliente/clave.

`backend/sql/001_pedidos_review.sql` es una propuesta para comparar con el DDL real: tablas del pedido si faltan, columnas checkout e `ecom_pedido_outbox`. **No ejecutar automáticamente en la BD compartida**. `CREATE TABLE IF NOT EXISTS` no corrige restricciones o tipos de tablas ya existentes: deben revisarse identity, nulabilidad, restricciones, unicidad de la outbox y permisos antes de autorizar su uso. No agrega FK ni accede a `master`. Si sus FK externas se habilitan luego, los IDs de sesión deben corresponder a clientes reales.

### CRM y política de fallos

| Variable | Uso |
| --- | --- |
| `CRM_MODE` | `disabled` por defecto, `mock` o `http`. |
| `CRM_API_URL` / `CRM_ORDER_PATH` | URL/ruta confirmadas por CRM; no hay endpoint inventado por defecto. |
| `CRM_API_TOKEN` | Bearer opcional del servidor. |
| `CRM_TIMEOUT_MS` | Timeout positivo, 5000 por defecto. |
| `CRM_IDEMPOTENCY_SUPPORTED` | `true` solo después de confirmar deduplicación durable por `Idempotency-Key`; HTTP se bloquea sin esa confirmación. |

Contrato de salida **propuesto y pendiente de acuerdo**: POST JSON con `version: 1`, `id_pedido`, `cliente: { id_cliente, nombre, email, rut }`, `envio`, `metodo_pago`, `monto_total`, `estado: "Pendiente"`, `items` (cantidades/precios del servidor), `productos` (snapshot nombre/código/imagen). Solo se envían campos seleccionados, nunca contraseñas ni tokens. Cabecera idempotente estable: `lesgo-order-<cliente>-<clave>`.

1. La creación guarda pedido + líneas + evento outbox `pending` atómicamente.
2. **Después del commit**, se intenta CRM con timeout. Un 2xx confirma la recepción HTTP según el contrato propuesto; CRM debe acordar esta semántica antes de activarlo.
3. `synced` solo corresponde al adaptador HTTP exitoso; mock devuelve `mock`, disabled devuelve `pending`.
4. Fallo/timeout CRM conserva el pedido y responde éxito de creación **con sincronización pendiente**, sin afirmar éxito del CRM. Un timeout puede significar recepción desconocida.
5. Repetir el mismo POST y clave recupera el mismo pedido y permite reintentar un evento no sincronizado. Cambiar la solicitud con la misma clave da 409. Si se pierde la actualización local tras una entrega CRM, el mismo header permite deduplicación externa.
6. **No se incluye un worker automático de outbox**: entrega eventual sin interacción requiere un worker/conciliación acordado con CRM, con backoff, reclamación concurrente y monitorización. La outbox queda durable en PostgreSQL, no en modo mock. No se promete entrega garantizada sin ese trabajo y contrato externo.

### Sesión y frontend

- Se conserva el login mock del equipo. El puente mínimo reemplaza tokens predecibles por tokens aleatorios registrados en servidor y vencimiento de 8 horas; los pedidos no aceptan tokens offline ni valores de `localStorage` como autorización.
- Reiniciar backend invalida las sesiones de desarrollo; iniciar sesión nuevamente. No es autenticación productiva/multirréplica. Con `NODE_ENV=production`, login mock y pedidos quedan bloqueados hasta integrar la autenticación del responsable.
- `VITE_API_URL=/api` por defecto: proxy de Vite a `localhost:5000` en desarrollo, proxy Nginx a backend en Docker.
- `VITE_CATALOG_SOURCE=local` por defecto, por decisión del usuario: catálogo y destacados usan `PRODUCTS` del frontend sin necesitar backend para listar. Se mantienen filtros de categoría, precio, piezas, edad y búsqueda. `api` selecciona el catálogo del backend explícitamente, sin fallback silencioso. Para usar Inventario real y pedidos PostgreSQL, seleccionar `api` y recompilar para mantener IDs reales coherentes; los slugs locales no se convierten a UUID. El detalle y la creación de pedidos siguen usando el backend, sin cambios.
- `VITE_AUTH_OFFLINE_DEMO=false` por defecto; el fallback de login heredado es opt-in para demo y no autoriza pedidos del backend. Recuperación de contraseña, registro, carrito y reclamos siguen conservando los alcances mock anteriores; no son integración productiva.
- Vite recibe sus variables al compilar. No exponer secretos en variables `VITE_*`.
- Node usado localmente: 22.23.3. Usar Node 22.22.2 o superior de la línea 22 por las dependencias de pruebas; CI y Docker seleccionan Node 22.

## D. Verificación

Ejecuciones reales locales:

- Frontend `npm test`: **17/17** correctas tras habilitar catálogo local; se verifican `PRODUCTS` sin red, filtros locales, modo API sin fallback, detalle desde catálogo, carga, 404, 503, enlace directo, atrás/adelante, agregar al carrito, checkout/resumen/formulario y conservación del carrito, sin POST/pago falso; callback de confirmación rechazada y payload sin precios ni identidad.
- Frontend `npm run build`: TypeScript y bundle Vite correctos.
- Frontend `npm run lint`: correcto. Línea base tenía errores por estado en effect, argumento sin usar, `any` y export hook/provider; se hicieron ajustes locales y una excepción nominal `useCart` al chequeo Fast Refresh, sin desactivar reglas generales.
- Backend con `PG_TEST_URL` aislada: **16/16** correctas; fixtures y HTTP de Inventario, catálogo/detalle, fallos HTTP/conexión/timeout/contrato, mapping de campos, pedidos/validación/stock, precios adulterados, idempotencia y CRM, fallos de almacenamiento, rollback/release simulado, tokens inventados/vencidos/empleado y endpoints de autenticación/consulta/creación. Sin `PG_TEST_URL`, se ejecutan 15 y se omite únicamente la integración PostgreSQL.
- `PG_TEST_URL=... npm test`: además ejecutó PostgreSQL 17 en un contenedor local aislado, con DDL aplicado **solo allí**: commit cabecera/líneas/outbox, lectura, aislamiento cliente, actualización CRM, rollback real ante constraint y creación concurrente sin duplicados.
- Backend `npm run check`: sintaxis del punto de entrada y app correctas; importar la app en tests también resuelve controladores/servicios.
- `docker compose config --quiet`: correcto.
- `docker build -t lesgo-backend:sprint1 ./backend` y frontend equivalente: correctos, instalación `npm ci` dentro de Docker.
- Smoke de ambas imágenes en una red Docker efímera: frontend 200, Nginx → backend health/catálogo/detalle 200, inexistente 404 y pedidos sin sesión 401. Contenedores/red de smoke y PostgreSQL aislado detenidos/eliminados al terminar; no se tocaron otros recursos.
- `git diff --check`: sin errores de espacios.
- `npm ci` ejecutado correctamente en ambos subproyectos antes de la última corrida de pruebas, build y lint.
- Las 5 pruebas frontend iniciales y ESLint también se ejecutaron correctamente dentro del build stage Linux de Docker (Node 22 Alpine). La ampliación posterior a 17 pruebas para el catálogo local se ejecutó en el entorno local.
- `graphify update .`: grafo actualizado por AST; advertencia por parser SQL opcional ausente. Artefactos generados en `graphify-out/`, sin añadir dependencias Python.

Pendiente: ejecución remota del workflow, navegador real/Playwright y revisión visual responsive con Benjamín, pruebas contra Inventario/CRM reales y revisión del esquema universitario. Las pruebas frontend son React + jsdom, no E2E de navegador real.

El audit de dependencias detectó avisos heredados: backend `body-parser` (alto) y `qs` (moderado); frontend `zod` (alto, dependencia de herramientas). No se ejecutó `npm audit fix` ni se ocultaron avisos/fallos; el alcance de este sprint no incluye una actualización global de dependencias.

## E. Integración del equipo

- **Sofía / SCRUM-20:** `CheckoutView.onConfirm(payload): Promise<void>` y `crearPedidoApi(payload, idempotencyKey)` listos, sin conexión automática en `App`. Usar `crypto.randomUUID()` por intención de confirmación y conservar esa clave en reintentos. No vaciar carrito ante error ni reintentar con otra clave ante timeout; confirmar primero si el pedido existe. Tras respuesta de creación, tratar `crm.status=pending` como pedido existente con sincronización pendiente, no como rechazo. Validaciones finales y UX de resultado son su integración.
- **Benjamín:** presentación del modal conservada; loader separado, galería/ficha técnica/fallback y checkout reutilizan clases existentes. No se agregó un router ni se reemplazó el diseño.
- **Autenticación:** reemplazar puente de desarrollo por verificación real de sesión y clientes reales. No habilitar producción con fixtures.
- **Carrito:** sigue siendo único `CartContext` con localStorage. Solo el punto backend de consulta de stock se redirige al servicio común; no se reimplementa el carrito.
- **Pagos:** seleccionar un método no confirma pago. Pedido inicial Pendiente; no existe captura ni tarjeta almacenada, venta ERP o cambio a `pagada` en este endpoint.
- **Inventario:** confirmar endpoints, DTO, paginación, UUID, precio y semántica de stock; no hay decremento/reserva. Disponibilidad puede cambiar después de la consulta: confirmar/reservar corresponde a tareas posteriores.
- **Pedidos/seguimiento:** GET y POST usan el mismo almacenamiento. Tracking viejo conservado solo para fixtures; no se fabrican pagos/envíos para pedidos nuevos. Las consultas del historial requieren sesión renovada.
- **CRM:** acordar payload y deduplicación antes de activar HTTP; worker/reconciliación de eventos pendientes queda identificado, no prometido como ya implementado.

## F. Ejecución e inventario de archivos

Desarrollo, desde dos terminales, Node 22.22.2+:

```sh
cd backend
npm ci
npm start
```

```sh
cd frontend
npm ci
npm run dev
```

Abrir la URL que Vite informa (normalmente `http://localhost:5173`). Modo por defecto: catálogo `PRODUCTS` del frontend, Inventario/pedidos backend mock, CRM disabled. Alternativa Docker: `docker compose up --build`, frontend `http://localhost:8080`. No habilitar la BD compartida para una demo.

Verificaciones reproducibles:

```sh
cd backend
npm run check
npm test
```

```sh
cd frontend
npm test
npm run build
npm run lint
```

La prueba PostgreSQL se omite sin `PG_TEST_URL`; CI la ejecuta con su servicio efímero. Para reproducirla localmente, crear un contenedor dedicado con base `lesgo_isolated_test`, credenciales exclusivamente de prueba, puerto enlazado a `127.0.0.1`, pasar su URL por `PG_TEST_URL` y eliminar **solo ese contenedor** al terminar. No usar `DATABASE_URL` de la universidad en tests.

Archivos nuevos:

- `.github/workflows/ci.yml`, `docs/SPRINT-1.md`.
- `graphify-out/`: artefactos generados por la actualización obligatoria del grafo, separados del código funcional.
- `backend/.env.example`, `app.js`, `lib/errors.js`.
- `backend/adapters/inventoryMapper.js`.
- `backend/services/{httpClient,inventoryService,sessionService,orderService,crmService}.js`.
- `backend/repositories/{orderRepository,postgresOrderRepository}.js`.
- `backend/sql/001_pedidos_review.sql`.
- `backend/test/{inventory,orders,postgres,session}.test.js`.
- `frontend/.env.example`, `public/product-placeholder.svg`.
- `frontend/src/components/{CheckoutView,ProductDetailLoader}.tsx`, `components/checkout.css`.
- `frontend/src/services/{checkoutContract,navigation}.ts`, `services/api.test.ts`, `src/sprint.test.tsx`.

Archivos existentes modificados:

- `backend/{index.js,package.json,package-lock.json,Dockerfile}`.
- `backend/controllers/{auth,carrito,pedidos,productos}Controller.js`, `routes/pedidosRoutes.js`, `data/productosData.js`.
- `docker-compose.yml`.
- `frontend/{package.json,package-lock.json,Dockerfile,eslint.config.js,vite.config.ts}`.
- `frontend/src/App.tsx`, `data/products.ts`, `services/{api,pedidosApi}.ts`.
- `frontend/src/components/{CartView,CatalogView,HomeView,Navbar,ProductDetailModal}.tsx`.

Listas para revisión del código: las seis incidencias, manteniendo SCRUM-7/SCRUM-19 **parciales respecto a sus integraciones reales**, y SCRUM-46 pendiente de la primera ejecución remota. No se debe cerrar como integrada la comunicación con ERP ni como persistido en la BD compartida un pedido mock.
