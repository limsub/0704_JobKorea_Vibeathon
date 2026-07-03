FROM python:3.11-slim

ENV HOST=0.0.0.0 \
    PORT=8080 \
    OCR_MAX_PAGES=20 \
    OCR_DPI=160 \
    TESSERACT_LANGS=kor+eng

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      poppler-utils \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-kor \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["python", "server.py"]
