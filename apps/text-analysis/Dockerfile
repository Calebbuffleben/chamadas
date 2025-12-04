FROM python:3.11-slim

# Instalar dependências do sistema (incluindo para ML)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Criar diretório para modelos ML
RUN mkdir -p /app/models

# Copiar código
COPY src/ ./src/
COPY scripts/ ./scripts/

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Variáveis para modelos ML
ENV TRANSFORMERS_CACHE=/app/models/.cache
ENV HF_HOME=/app/models/.cache

# Expor porta
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Comando de inicialização
CMD ["python", "-m", "src.main"]

