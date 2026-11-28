# Stage 1: Build Frontend React (bebas konflik node_modules Windows vs Linux)
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json tsconfig.app.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY src ./src
RUN npm run build

# Stage 2: Runtime HPC (Python 3.11 + OpenMPI + FastAPI + React dist/)
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libopenmpi-dev \
    openmpi-bin \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Izinkan OpenMPI berjalan sebagai root & mendukung oversubscribe (P = 16 pada host 4/8 core)
ENV OMPI_ALLOW_RUN_AS_ROOT=1
ENV OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1
ENV OMPI_MCA_rmaps_base_oversubscribe=1
ENV PRTE_MCA_rmaps_default_mapping_policy=:oversubscribe
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY backend /app/backend
COPY src /app/src
COPY results /app/results
COPY run_experiments.sh README.md /app/
COPY --from=frontend-builder /build/dist /app/dist

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
