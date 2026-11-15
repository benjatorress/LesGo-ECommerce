# LesGo E-Commerce — Backend

API Node/Express (ESM) para el e-commerce de LesGo. Persistencia en PostgreSQL
(Neon) para carrito, pedidos e inventario.

```
backend/
├── app.js                 # armado de Express, locales y middlewares
├── index.js               # arranque (puerto 5000 por defecto)
├── config/db.js           # pool de pg desde DB_HOST/DB_PORT/...
├── routes/                # routers por dominio
├── services/              # inventario, pedidos, CRM, pagos
├── repositories/          # acceso a datos (mock | postgres)
├── adapters/              # mapeadores y clientes HTTP
└── test/                  # node:test
```

## Arranque

```bash
npm install
npm run dev      # node --watch index.js
npm test         # node --test
npm run check    # node --check index.js
```

Las variables de entorno se leen de `backend/.env` (cargado por
`import 'dotenv/config'` en `index.js`). Ese archivo **no** se versiona: el
`.gitignore` ignora `.env` y `.env.*`, salvo `.env.example`.

---

## Configuración de Stripe

El cobro usa **Stripe Checkout alojado**: el backend crea una sesión, el
navegador se redirige a Stripe y Stripe confirma el pago llamando al webhook.
El backend nunca recibe datos de tarjeta y el frontend no necesita ninguna clave
de Stripe.

### 1. Requisitos

- Cuenta de Stripe en **modo test** que acepte **CLP**.
- [Stripe CLI](https://docs.stripe.com/stripe-cli) instalado, para el webhook
  local (`stripe login`).
- El SDK ya está en `package.json` (`stripe@23.x`); no hay que instalar nada
  extra.

### 2. Variables de entorno

Agregar a `backend/.env`:

```dotenv
# Pagos
PAYMENT_MODE=stripe
PAYMENT_REPOSITORY=postgres
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=clp
APP_BASE_URL=http://localhost:5173

# Persistencia (necesaria para que el pago tenga pedido padre)
DB_ACCESS_ENABLED=true
ORDER_REPOSITORY=postgres
INVENTORY_MODE=postgres
```

| Variable | Obligatoria | Default | Para qué |
|---|---|---|---|
| `PAYMENT_MODE` | no | `disabled` | `disabled` \| `stripe` \| `fake`. Con `disabled` el backend arranca sin credenciales y responde `503 PAYMENTS_DISABLED` al cobrar. `fake` es para tests: sesiones y firmas simuladas, sin red. |
| `PAYMENT_REPOSITORY` | no | `mock` | Dónde se registran los intentos de pago (`ecommerce_ventas.ecom_pago`). Requiere `DB_ACCESS_ENABLED=true`. |
| `STRIPE_SECRET_KEY` | sí con `PAYMENT_MODE=stripe` | — | Clave secreta del backend (`sk_test_...`). **Nunca** va al frontend ni al repo. |
| `STRIPE_WEBHOOK_SECRET` | sí para el webhook | — | Secreto de firma (`whsec_...`). Distinto de la API key. Sin él el webhook responde `503 WEBHOOK_NOT_CONFIGURED`. |
| `STRIPE_CURRENCY` | no | `clp` | Moneda de la sesión. **CLP es de cero decimales**: el `amount` es un entero de pesos, nunca se multiplica por 100. |
| `APP_BASE_URL` | no | `http://localhost:5173` | Origen del frontend para `success_url` y `cancel_url`. En despliegue debe ser HTTPS. |

Las claves se obtienen en **Dashboard → Developers → API keys**. La
`pk_test_...` (publishable) **no** se usa con Checkout alojado.

### 3. Webhook en local

Con el backend corriendo en `:5000`, en otra terminal:

```bash
stripe listen \
  --forward-to localhost:5000/api/webhooks/stripe \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
```

Las versiones recientes del CLI ya no asumen "todos los eventos": hay que
declararlos con `--events` o usar `--all-snapshot` (equivalente al
comportamiento antiguo). `--all-thin` no sirve para estos eventos.

El comando imprime:

```
Your webhook signing secret is whsec_...
```

Cópialo a `STRIPE_WEBHOOK_SECRET` y **reinicia el backend**. Si el CLI se
reinicia y el secreto cambia, vuelve a copiarlo. Para verlo sin dejar el
listener abierto: `stripe listen --print-secret`.

Para disparar un evento de prueba sin hacer el checkout a mano:

```bash
stripe trigger checkout.session.completed
```

### 4. Tarjetas de prueba

| Número | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago aprobado |
| `4000 0000 0000 9995` | Rechazo por fondos insuficientes |
| `4000 0025 0000 3155` | Requiere autenticación 3D Secure |

Cualquier fecha futura y CVC de 3 dígitos.

### 5. Comprobaciones rápidas

```bash
curl -s localhost:5000/api/health
# { ..., "payments": "stripe", "paymentPersistence": "postgres" }
```

En la base, tras un pago aprobado:

```sql
SELECT estado, monto, pagado_en
FROM ecommerce_ventas.ecom_pago
ORDER BY id_pago DESC
LIMIT 5;

SELECT id_pedido, estado, monto_total
FROM ecommerce_ventas.ecom_pedido
ORDER BY id_pedido DESC
LIMIT 5;
```

### 6. Problemas frecuentes

| Síntoma | Causa habitual |
|---|---|
| `400 INVALID_SIGNATURE` en todos los webhooks | `STRIPE_WEBHOOK_SECRET` viejo o de otro listener; el body se parseó con `express.json()` antes del webhook. |
| `503 WEBHOOK_NOT_CONFIGURED` | Falta `STRIPE_WEBHOOK_SECRET` en el entorno. |
| `503 PAYMENTS_DISABLED` | `PAYMENT_MODE` no es `stripe`. |
| Cobro 100× mayor | Se multiplicó CLP por 100; es moneda de cero decimales. |
| El pedido queda `Pendiente` tras pagar | El webhook no llegó: revisa que `stripe listen` esté corriendo y apuntando al puerto correcto. |

### 7. Secretos en un equipo

- `backend/.env` es local y no se versiona. Cada integrante mantiene el suyo.
- El `whsec_...` de `stripe listen` es **propio de tu sesión de CLI**: no se
  comparte y puede cambiar entre arranques.
- El `whsec_...` de un endpoint del **Dashboard** (staging/producción) sí es
  compartido, pero se distribuye por gestor de contraseñas o secret store, no
  por git, chat ni capturas.
- Si una clave se filtra, se **rota** (Dashboard → endpoint → *Roll secret*, o
  API keys → roll) y se actualiza el entorno.
- El modo `fake` permite que los tests corran sin claves reales ni red.
