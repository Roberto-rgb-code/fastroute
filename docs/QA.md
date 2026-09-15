# FastRoute — Jenkins QA

## Qué valida el pipeline

1. `npm ci`
2. `prisma generate`
3. Typecheck API
4. **Jest** unit tests (API + web) con coverage
5. Build producción API + web
6. Smoke opcional de **geopy/Nominatim** (geocoding gratis)

## Cómo correrlo local (mismo gate que Jenkins)

```bash
chmod +x scripts/qa.sh
npm run qa
```

O por partes:

```bash
npm run test:ci
npm run build:ci
```

## Jenkins

1. New Item → Pipeline
2. Pipeline from SCM → este repo → script path `Jenkinsfile`
3. (Opcional) Plugins: HTML Publisher, JUnit
4. Agent Docker debe poder pull `node:20-bookworm`

## Jest

| Workspace | Comando | Config |
|-----------|---------|--------|
| `@fastroute/api` | `npm run test -w @fastroute/api` | `apps/api/package.json` → jest |
| `@fastroute/web` | `npm run test -w @fastroute/web` | `apps/web/jest.config.js` + `jest-preset-angular` |
