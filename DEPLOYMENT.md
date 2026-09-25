# Guía de Despliegue en Producción 24/7 (Apex Analytics)

Esta guía detalla cómo desplegar la plataforma completa (**PostgreSQL**, **Motor ML en Python/FastAPI** y **Bot en NestJS**) en la nube para funcionamiento continuo 24/7.

---

## 1. ¿Por qué Vercel NO es adecuado para este proyecto?

Muchas veces se piensa en Vercel para subir páginas web, pero en este caso **no funcionará** por las siguientes razones técnicas:
1. **El Bot de Telegram necesita un proceso persistente 24/7**:
   El bot utiliza *Long Polling* (`getUpdates`) para escuchar los mensajes de Telegram al instante y cronjobs que ejecutan análisis cada hora. En Vercel las funciones son *Serverless* (se apagan tras 10 a 15 segundos de inactividad), lo que mataría el bot y los cronjobs.
2. **Modelos de Machine Learning y FastF1**:
   El motor de Python carga librerías pesadas (`scikit-learn`, `fastf1`, `pandas`, `numpy`) y archivos `.joblib` en memoria. Vercel tiene límites estrictos de tamaño de paquete y tiempo de cómputo que impiden ejecutar simulaciones Monte Carlo o pipelines ML.
3. **Múltiples contenedores**:
   El sistema está compuesto por 3 piezas que se comunican internamente: Base de Datos PostgreSQL, API Python (puerto 8000) y Servidor NestJS (puerto 3000). Vercel no soporta Docker Compose multi-contenedor.

---

## 2. Opciones Recomendadas para Producción

### Opción A: Railway.app (La más rápida y sencilla - Recomendada)
Railway es una plataforma en la nube tipo PaaS que soporta Docker, bases de datos y procesos 24/7 de forma automática:
1. Creas una cuenta en [Railway.app](https://railway.app).
2. Añades un servicio **PostgreSQL** con 1 clic (te da la `DATABASE_URL` lista).
3. Conectas tu repositorio de GitHub:
   - Creas un servicio para la carpeta `MachineLearning` (expone puerto 8000).
   - Creas un servicio para la carpeta `microservice` (expone puerto 3000).
4. Railway te genera automáticamente un subdominio público con **HTTPS gratuito** (por ejemplo: `https://apex-bot-production.up.railway.app`).
5. Configuras las variables de entorno en el panel:
   - `DASHBOARD_URL = https://apex-bot-production.up.railway.app/dashboard`
   - `PYTHON_ML_URL = http://ml-engine.railway.internal:8000` (comunicación interna ultrarrápida sin costo de datos).
6. **Telegram WebApp**: Como Railway provee un dominio con SSL (`https://`), los botones de Telegram WebApp funcionan inmediatamente en cualquier teléfono móvil o PC.

---

### Opción B: Servidor VPS Linux (Hetzner, DigitalOcean, Linode) - Costo: ~$4 - $5 / mes
Ideal si quieres control absoluto y el menor costo mensual:
1. Contrata un VPS con Ubuntu 22.04 / 24.04 (mínimo 2 GB RAM).
2. Instala Docker y Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   ```
3. Clona tu proyecto:
   ```bash
   git clone <tu-repositorio> app
   cd app/MicroServicio
   ```
4. Configura tu `.env` con tus credenciales y token.
5. Inicia los contenedores:
   ```bash
   docker compose up -d --build
   ```
6. **Para tener HTTPS público y que Telegram lo acepte**:
   Instala Caddy o Nginx para redireccionar el puerto 3000 a un dominio con SSL gratuito (Let's Encrypt):
   ```bash
   # Con Caddy es 1 sola línea en /etc/caddy/Caddyfile:
   tu-dominio.com {
       reverse_proxy localhost:3000
   }
   ```

---

## 3. ¿Cómo resolver el problema de `localhost` en Desarrollo vs Producción?

Telegram **prohíbe estrictamente** URLs con `http://localhost` dentro de botones interactivos (`inline_keyboard`).

1. **En Desarrollo Local**:
   - Si accedes desde el navegador de tu computadora, abres directamente: `http://localhost:3000/dashboard`.
   - Si quieres probar la WebApp dentro de la app móvil de Telegram desde tu PC local, utiliza una herramienta de túnel seguro como **Cloudflare Tunnel** o **Ngrok**:
     ```bash
     ngrok http 3000
     ```
     Ngrok te dará una URL tipo `https://abc1234.ngrok-free.app`.
     En tu archivo `.env` configuras:
     ```env
     DASHBOARD_URL=https://abc1234.ngrok-free.app/dashboard
     ```
     ¡Y el botón de Telegram funcionará al instante sin dar error 400!

2. **En Producción**:
   Simplemente asignas tu dominio HTTPS en el archivo `.env`:
   ```env
   DASHBOARD_URL=https://tudominio.com/dashboard
   ```

---

## 4. Migración de Base de Datos y Población Inicial

Cuando levantes la base de datos por primera vez en Docker o en la nube:
1. **Crear las tablas en PostgreSQL**:
   ```bash
   npx prisma db push
   ```
2. **Poblar la base de datos de Peleadores UFC (4,612 atletas) y Gran Premio F1**:
   ```bash
   node seed_ufc_db.cjs
   ```
   (El script lee `ufc_fighter_tott.csv` y carga a todos los peleadores y el evento activo en PostgreSQL).

