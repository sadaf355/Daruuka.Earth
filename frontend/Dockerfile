# Development image — the compose file bind-mounts ./frontend and runs `vite --host`,
# so this stays a plain Node container rather than a multi-stage nginx build.
# Production deploys are static: `npm run build` output served by Vercel.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
