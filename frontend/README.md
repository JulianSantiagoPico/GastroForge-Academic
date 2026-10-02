# GastroForge Appresso Dashboard (Frontend)

Dashboard web analítico y simulador de tráfico para la detección de fraude en tiempo real de Appresso.

---

## 🚀 Despliegue en Vercel

1. **Importar Repositorio en Vercel:**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

2. **Variables de Entorno en Vercel:**
   - `VITE_APPRESSO_API_URL`: URL pública de la API de backend (ej. `https://gastroforge-api.onrender.com/api/v1`).

3. **Routing SPA:**
   - La configuración de rewrites se encuentra definida en `vercel.json` para redirigir cualquier ruta a `index.html`.

---

## 💻 Desarrollo Local

```bash
# Desde la raíz del monorepo
npm run frontend:dev

# O desde esta carpeta
npm run dev
```

## 🧪 Pruebas

```bash
# Desde la raíz del monorepo
npm run frontend:test

# O desde esta carpeta
npm test
```
