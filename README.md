# FastRoute

SaaS logístico multi-tenant de última milla. Réplica mejorada de Rutaflow.

**Stack:** NestJS · Angular 19 · PostgreSQL/PostGIS · Redis · Expo (React Native) · Mapbox · Pusher · GCP/Terraform.

## Seguridad

- **No se guardan contraseñas de GCP ni cuentas en el repo.** Autenticación por OAuth (`gcloud auth login`).
- Si compartiste una contraseña por chat, **cámbiala** en tu Google Account.
- `.env`, `terraform.tfvars`, service-accounts y `*.tfstate` están en `.gitignore`.

## Arquitectura

```
apps/
  api      NestJS — auth JWT + roles, multi-tenant, rutas, flota, clientes,
           lógica de negocio (lifecycle, sync driver/vehículo, checklist), tracking (Pusher)
  web      Angular — Super Admin + panel operativo (dashboard, rutas, mapa, flota, clientes)
  mobile   Expo — app de conductores (rutas del día, checklist, paradas, entrega, GPS)
infra/
  terraform  GCP: APIs, Artifact Registry, Secret Manager, Service Account
  scripts    gcp-auth.sh (login OAuth)
```

Multi-tenant: `SUPER` da de alta empresas y usuarios; cada empresa opera aislada por `enterpriseId`; conductores usan la app móvil contra el mismo backend.

## Demo local

```bash
cp .env.example .env       # edita JWT_SECRET (y opcional MAPBOX_ACCESS_TOKEN, PUSHER_*)
npm install

# Infra (Postgres + Redis en Docker)
npm run dev:infra

# Base de datos
cd apps/api
export DATABASE_URL="postgresql://fastroute:fastroute@localhost:5432/fastroute?schema=public"
npx prisma migrate dev
npm run prisma:seed
cd ../..

# Servicios
npm run dev:api    # http://localhost:3000/api/v1
npm run dev:web    # http://localhost:4200

# App móvil (Android estable)

Evita reiniciar el emulador con `pkill`; usa los scripts del repo:

```bash
# Terminal 1 — API + Docker (si aplica)
npm run dev:up

# Terminal 2 — Metro + emulador en **Terminal gráfica** (no background desde IDE)
npm run dev:android

# Si solo necesitas la ventana del emulador (recomendado tras un cierre)
open scripts/start-android-emulator.command

# Terminal 3 — reabre Expo Go si cerraste la app (no reinicia el emulador)
npm run dev:android:watchdog

**Teléfono Android por USB** (suele ser más estable que el emulador): `./scripts/android-emulator.sh physical` con Metro en :8082.
```

Variables opcionales: `ANDROID_AVD=Medium_Phone_API_36.1`, `EXPO_ANDROID_URL=exp://10.0.2.2:8082`.

Manual: `cd apps/mobile && npx expo start --port 8082` · Expo Go SDK 53 en `~/.expo/android-apk-cache/Expo-Go-2.33.22.apk`.
```

### Cuentas seed

| Rol | Email | Contraseña |
|-----|-------|------------|
| Super Admin | `super@fastroute.local` | `SuperAdmin123!` |
| Admin (tenant) | `admin@demo-logistica.local` | `Admin123!` |
| Conductor | `conductor@demo-logistica.local` | `Driver123!` |

## Mapas y tracking

- **Mapbox** (demo): setea `MAPBOX_ACCESS_TOKEN`. Sin token, el web usa un mapa SVG de respaldo.
- **Pusher** (demo tracking en vivo): setea `PUSHER_*`. La app móvil publica ubicación cada 20s mientras la ruta está en curso; el panel de Seguimiento las muestra en vivo.
- Ambos están detrás de una interfaz para migrar a Google Maps / Pub/Sub en producción sin reescribir el front.

## Contenedores

`docker-compose.yml` levanta Postgres/PostGIS + Redis (perfil por defecto) y, con `--profile full`, también API y web en contenedores. MinIO disponible con `--profile storage` para simular GCS/S3.

## GCP + Terraform (cuando elijan cloud)

```bash
brew install --cask google-cloud-sdk terraform
./infra/scripts/gcp-auth.sh          # gcloud auth login (OAuth navegador)
gcloud config set project TU_PROJECT_ID
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
cd infra/terraform && terraform init && terraform plan
```

Provisiona: APIs (Cloud Run, Maps, Secret Manager, Artifact Registry), Service Account de runtime y secret del JWT. Cloud Run + Cloud SQL se añaden al decidir Railway vs AWS vs GCP.

## Fase 2

Integraciones (Shopify, Zapier, SAP, WooCommerce, etc.), optimización VRP avanzada (worker + Redis), notificaciones WhatsApp, reportes SQL dinámicos.
