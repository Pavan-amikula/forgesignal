FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1
WORKDIR /app
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY backend ./backend
COPY data ./data
COPY scripts ./scripts
RUN mkdir artifacts && python -m backend.ml && useradd -m forge && chown -R forge:forge /app
COPY --from=ui /ui/dist ./frontend/dist
USER forge
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=3)"
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000"]
