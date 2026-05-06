OCR & OpenCV Setup

This server includes an OCR route that expects a system-installed PaddleOCR CLI and optionally uses `opencv4nodejs` for image processing.

Quick setup notes:

- Install PaddleOCR (Python) and its dependencies on your system. Example (Linux / Windows WSL):

```bash
python -m pip install paddlepaddle -f https://www.paddlepaddle.org.cn/whl/linux/mkl/avx/stable.html
python -m pip install paddleocr
```

- Verify the CLI is available: `paddleocr --help`.

- The Node route `POST /api/ocr/paddle` accepts a multipart `image` field and calls the `paddleocr` CLI. The server returns JSON when the CLI outputs JSON.

- Optional: to enable Node OpenCV checks, install `opencv4nodejs` (native build required). Follow the module docs: https://www.npmjs.com/package/opencv4nodejs

Notes and troubleshooting:

- `opencv4nodejs` requires OpenCV system libraries installed prior to `npm i`.
- PaddleOCR is executed as an external process; ensure Python environment and PATH include the `paddleocr` entry point.
