FROM python:3.11-slim-bookworm

# Install build deps for zsign + runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    git g++ pkg-config \
    libssl-dev libminizip-dev zlib1g-dev \
    unzip zip curl \
    make build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

# Build zsign from source
RUN git clone --depth=1 https://github.com/zhlynn/zsign.git /tmp/zsign \
    && cd /tmp/zsign/build/linux \
    && make clean && make \
    && cp /tmp/zsign/bin/zsign /usr/local/bin/zsign \
    && chmod +x /usr/local/bin/zsign \
    && rm -rf /tmp/zsign \
    && zsign -v

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /tmp/ipa_signer_jobs

ENV ZSIGN_PATH=/usr/local/bin/zsign \
    JOB_TTL_SECONDS=1800 \
    MAX_FILE_SIZE_MB=500 \
    ZSIGN_TIMEOUT=300 \
    CLEANUP_INTERVAL=300 \
    MAX_CONCURRENT_JOBS=5

EXPOSE 8001

CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}
