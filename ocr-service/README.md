# PaddleOCR Microservice

## Setup

1. Create and activate a Python environment.
2. Install dependencies:

```
pip install -r requirements.txt
```

3. Run the service:

```
python app.py
```

The service listens on `http://localhost:7001/ocr` and expects multipart form-data with a file field named `image`.
