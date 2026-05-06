import os
import tempfile
import traceback

from flask import Flask, jsonify, request  # type: ignore
from paddleocr import PaddleOCR  # type: ignore

app = Flask(__name__)
ocr_engine = None


def get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        ocr_engine = PaddleOCR(
            use_angle_cls=False,
            lang="en",
            show_log=False,
            cpu_threads=1,
            det_limit_side_len=1280,
        )
    return ocr_engine


def parse_ocr_result(result):
    lines = []
    items = []

    for block in result or []:
        for line in block or []:
            if len(line) < 2:
                continue

            box = line[0] if len(line) > 0 else None
            text = line[1][0]
            confidence = line[1][1] if len(line[1]) > 1 else None

            if text:
                lines.append(text)
                items.append({
                    "text": text,
                    "box": box,
                    "confidence": confidence,
                })

    raw_text = "\n".join(lines)
    return lines, raw_text, items


@app.post("/ocr")
def run_ocr():
    image = request.files.get("image") or request.files.get("file")
    if image is None:
        return jsonify({"message": "Missing file field 'image'."}), 400

    suffix = os.path.splitext(image.filename or "")[1] or ".png"
    temp_dir = tempfile.mkdtemp(prefix="ocr-")
    temp_path = os.path.join(temp_dir, f"input{suffix}")
    image.save(temp_path)

    try:
        result = get_ocr_engine().ocr(temp_path, cls=False)
        lines, raw_text, items = parse_ocr_result(result)
        return jsonify({"lines": lines, "rawText": raw_text, "items": items})
    except Exception as error:
        traceback.print_exc()
        return jsonify({"message": str(error) or "OCR processing failed."}), 500
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        try:
            os.rmdir(temp_dir)
        except OSError:
            pass


@app.get("/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7001, debug=False)
