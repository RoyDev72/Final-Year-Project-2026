from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

def generate_modern_report(
    filename,
    company_name,
    report_title,
    project_info,
    summary_cards,
    table_data,
    table_headers
):
    doc = SimpleDocTemplate(filename, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18)
    styles = getSampleStyleSheet()
    elements = []

    # Header
    header_style = ParagraphStyle('Header', parent=styles['Heading1'], fontSize=22, textColor=colors.HexColor('#1a2236'), spaceAfter=8)
    elements.append(Paragraph(company_name, header_style))
    elements.append(Paragraph(report_title, styles['Heading2']))
    elements.append(Spacer(1, 12))

    # Project Info
    for info in project_info:
        elements.append(Paragraph(info, styles['Normal']))
    elements.append(Spacer(1, 16))

    # Summary Cards (as a table row)
    card_table = Table([summary_cards], colWidths=[60*mm, 40*mm, 40*mm])
    card_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f5f7fa')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1a2236')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTSIZE', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#e0e3e7')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0e3e7')),
    ]))
    elements.append(card_table)
    elements.append(Spacer(1, 18))

    # Table Title
    elements.append(Paragraph('Cost Breakdown', styles['Heading3']))

    # Table Data
    table = Table([table_headers] + table_data, repeatRows=1, colWidths=[40*mm, 25*mm, 20*mm, 25*mm, 25*mm, 25*mm, 30*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a2236')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 12),
        ('FONTSIZE', (0,1), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,0), 10),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f5f7fa')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0e3e7')),
    ]))
    elements.append(table)

    doc.build(elements)

# Example usage (call this with your data after calculation):
# generate_modern_report(
#     filename='output.pdf',
#     company_name='Inavitmodutech',
#     report_title='Interior Cost Estimate Report',
#     project_info=[
#         'Project: 24 (1) page 0001',
#         'Plan: Basic',
#     ],
#     summary_cards=[
#         'TOTAL ESTIMATE\nRs. 8,23,925',
#         'DETECTED SPACES\n6',
#         'TOTAL AREA\n594.93 sqft',
#     ],
#     table_headers=['Space', 'Area', 'Rate', 'Base', 'Material', 'Add-ons', 'Total'],
#     table_data=[
#         ['Bathroom', '27.99', '1,200', '33,588', '9,797', '0', '43,385'],
#         # ... more rows ...
#     ]
# )
from flask import Flask, jsonify, request # type: ignore
from paddleocr import PaddleOCR # type: ignore
import tempfile
import os

app = Flask(__name__)
ocr = PaddleOCR(use_angle_cls=True, lang="en")


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

    temp_dir = tempfile.mkdtemp(prefix="ocr-")
    temp_path = os.path.join(temp_dir, image.filename)
    image.save(temp_path)

    try:
        result = ocr.ocr(temp_path, cls=True)
        lines, raw_text, items = parse_ocr_result(result)
        return jsonify({"lines": lines, "rawText": raw_text, "items": items})
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
