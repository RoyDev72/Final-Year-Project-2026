import axios from "axios";
import FormData from "form-data";

const OCR_URL = process.env.OCR_MICROSERVICE_URL || "http://127.0.0.1:7001/ocr";
const OCR_TIMEOUT = Number(process.env.OCR_SERVICE_TIMEOUT_MS) || 90000;

function getConnectionDetails(error) {
  const causes = Array.isArray(error?.errors) ? error.errors : [];
  const codes = [error?.code, ...causes.map((cause) => cause?.code)]
    .filter(Boolean)
    .join(", ");

  return codes ? ` (${codes})` : "";
}

function toOcrServiceError(error) {
  if (error?.response) {
    const message =
      error.response.data?.message ||
      error.response.statusText ||
      "OCR microservice request failed";
    const wrapped = new Error(
      `OCR microservice returned ${error.response.status}: ${message}`,
    );
    wrapped.status = error.response.status;
    wrapped.cause = error;
    return wrapped;
  }

  if (error?.code || Array.isArray(error?.errors)) {
    const wrapped = new Error(
      `OCR microservice is not reachable at ${OCR_URL}${getConnectionDetails(
        error,
      )}. Start ocr-service/app.py or set OCR_MICROSERVICE_URL.`,
    );
    wrapped.status = 503;
    wrapped.cause = error;
    return wrapped;
  }

  return error;
}

export async function runPaddleOcr({ imageBuffer, filename, mimeType }) {
  if (!imageBuffer) {
    throw new Error("Missing OCR image buffer");
  }

  const formData = new FormData();
  formData.append("image", imageBuffer, {
    filename: filename || "floorplan.png",
    contentType: mimeType || "image/png",
  });

  let response;
  try {
    response = await axios.post(OCR_URL, formData, {
      headers: formData.getHeaders(),
      timeout: OCR_TIMEOUT,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (error) {
    throw toOcrServiceError(error);
  }

  const payload = response?.data || {};
  const lines = Array.isArray(payload.lines)
    ? payload.lines.filter(Boolean)
    : [];
  const rawText = String(payload.rawText || payload.text || "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  return { lines, rawText, items };
}
