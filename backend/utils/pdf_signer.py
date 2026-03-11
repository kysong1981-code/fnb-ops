"""Overlay signature & initials onto a PDF using PyPDF2 + reportlab."""
import io

from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader


def _make_overlay(width, height, image_bytes, x, y, img_w, img_h):
    """Create a single-page PDF with one image placed at (x, y)."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(width, height))
    img = ImageReader(io.BytesIO(image_bytes))
    c.drawImage(img, x, y, width=img_w, height=img_h, mask='auto')
    c.save()
    buf.seek(0)
    return buf


def sign_pdf(pdf_bytes, signature_bytes=None, initials_bytes=None, sign_zones=None):
    """
    PDF에 서명 + 이니셜을 오버레이.
    sign_zones가 있으면 해당 좌표에, 없으면 기본 위치에 배치.

    Args:
        pdf_bytes: 원본 PDF 바이트
        signature_bytes: 서명 이미지 PNG 바이트
        initials_bytes: 이니셜 이미지 PNG 바이트
        sign_zones: [{"type": "signature", "page": 1, "x": 8, "y": 85, "width": 30, "height": 6}, ...]
                    (좌표는 페이지 대비 %)

    Returns:
        bytes: 오버레이된 PDF, 또는 원본
    """
    if not signature_bytes and not initials_bytes:
        return pdf_bytes

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()
        num_pages = len(reader.pages)

        for i, page in enumerate(reader.pages):
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)

            if sign_zones:
                # Zone 좌표 기반 배치
                page_zones = [z for z in sign_zones if z['page'] == i]

                for zone in page_zones:
                    z_type = zone['type']
                    # % → 포인트 변환
                    z_x = (zone['x'] / 100) * page_width
                    # PDF 좌표는 아래에서 위로 → y를 반전
                    z_y = page_height - ((zone['y'] / 100) * page_height) - ((zone['height'] / 100) * page_height)
                    z_w = (zone['width'] / 100) * page_width
                    z_h = (zone['height'] / 100) * page_height

                    img_bytes = None
                    if z_type == 'signature' and signature_bytes:
                        img_bytes = signature_bytes
                    elif z_type == 'initials' and initials_bytes:
                        img_bytes = initials_bytes

                    if img_bytes:
                        overlay_buf = _make_overlay(
                            page_width, page_height,
                            img_bytes, z_x, z_y, z_w, z_h,
                        )
                        overlay_reader = PdfReader(overlay_buf)
                        page.merge_page(overlay_reader.pages[0])
            else:
                # 기본 위치 (하위 호환성)
                is_last_page = (i == num_pages - 1)

                if initials_bytes:
                    init_w, init_h = 60, 30
                    init_x = page_width - init_w - 30
                    init_y = 25
                    overlay_buf = _make_overlay(
                        page_width, page_height,
                        initials_bytes, init_x, init_y, init_w, init_h,
                    )
                    overlay_reader = PdfReader(overlay_buf)
                    page.merge_page(overlay_reader.pages[0])

                if signature_bytes and is_last_page:
                    sig_w, sig_h = 180, 60
                    sig_x = (page_width - sig_w) / 2
                    sig_y = 60
                    overlay_buf = _make_overlay(
                        page_width, page_height,
                        signature_bytes, sig_x, sig_y, sig_w, sig_h,
                    )
                    overlay_reader = PdfReader(overlay_buf)
                    page.merge_page(overlay_reader.pages[0])

            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        return pdf_bytes
