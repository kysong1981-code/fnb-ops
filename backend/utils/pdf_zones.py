"""
PDF 서명 영역 감지 유틸리티.

DOCX 템플릿에 [[SIGNATURE]], [[INITIALS]], [[DATE]] 마커를 넣으면
PDF 변환 후 해당 위치를 자동 감지하여 서명 영역 좌표로 반환.
"""
import io
import fitz  # PyMuPDF


# 지원하는 마커 → zone type 매핑
MARKERS = {
    '[[SIGNATURE]]': 'signature',
    '[[INITIALS]]': 'initials',
    '[[DATE]]': 'date',
}

# zone type별 최소 크기 (페이지 대비 %)
MIN_SIZES = {
    'signature': {'width': 25, 'height': 5},
    'initials':  {'width': 12, 'height': 4},
    'date':      {'width': 10, 'height': 3.5},
}


def extract_and_clean_sign_zones(pdf_bytes):
    """
    PDF에서 [[SIGNATURE]], [[INITIALS]], [[DATE]] 마커를 찾아
    좌표를 기록하고, 마커 텍스트를 지운 PDF를 반환.

    Args:
        pdf_bytes: 원본 PDF 바이트

    Returns:
        (cleaned_pdf_bytes, zones_list)
        zones_list: [
            {"type": "signature", "page": 1, "x": 8.5, "y": 82.0, "width": 30, "height": 6},
            ...
        ]
        좌표는 모두 페이지 크기 대비 % (0-100)
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zones = []
    num_pages = doc.page_count

    for page_idx in range(num_pages):
        page = doc[page_idx]
        pw = page.rect.width
        ph = page.rect.height

        for marker_text, zone_type in MARKERS.items():
            instances = page.search_for(marker_text)

            for rect in instances:
                # 좌표를 페이지 대비 %로 변환
                mins = MIN_SIZES.get(zone_type, {'width': 12, 'height': 4})
                raw_w = (rect.width / pw) * 100
                raw_h = (rect.height / ph) * 100

                zone_w = max(raw_w * 2.5, mins['width'])
                zone_h = max(raw_h * 3, mins['height'])

                # x 좌표: 마커 시작점 기준 (약간 왼쪽으로 확장)
                x_pct = max(0, (rect.x0 / pw) * 100 - 2)
                # y 좌표: 마커 시작점 기준
                y_pct = max(0, (rect.y0 / ph) * 100 - 1)

                zones.append({
                    'type': zone_type,
                    'page': page_idx,
                    'x': round(x_pct, 1),
                    'y': round(y_pct, 1),
                    'width': round(zone_w, 1),
                    'height': round(zone_h, 1),
                })

                # 마커 텍스트를 흰색으로 가리기
                page.add_redact_annot(rect, fill=(1, 1, 1))

        # 페이지의 모든 redaction 적용
        page.apply_redactions()

    # [[INITIALS]]가 일부 페이지에만 있으면 모든 페이지에 복제
    initials_zones = [z for z in zones if z['type'] == 'initials']
    if initials_zones:
        ref = initials_zones[0]
        existing_pages = {z['page'] for z in initials_zones}
        for p in range(num_pages):
            if p not in existing_pages:
                # 마커가 없는 페이지는 우측 하단에 배치
                zones.append({
                    'type': 'initials',
                    'page': p,
                    'x': 80,
                    'y': 93,
                    'width': ref['width'],
                    'height': ref['height'],
                })

    # 정리된 PDF 바이트 반환
    cleaned_pdf = doc.tobytes()
    doc.close()

    # 페이지 번호 순으로 정렬
    zones.sort(key=lambda z: (z['page'], z['type']))

    return cleaned_pdf, zones


def get_default_zones(num_pages):
    """
    마커가 없는 문서에 대한 기본 서명 영역.
    (하위 호환성 — 마커 없는 기존 문서용)
    """
    zones = []

    # 모든 페이지: 이니셜 (우측 하단)
    for p in range(num_pages):
        zones.append({
            'type': 'initials',
            'page': p,
            'x': 80,
            'y': 93,
            'width': 15,
            'height': 5,
        })

    # 마지막 페이지: 서명 (좌측 하단)
    last = num_pages - 1
    zones.append({
        'type': 'signature',
        'page': last,
        'x': 8,
        'y': 90,
        'width': 35,
        'height': 7,
    })

    # 마지막 페이지: 날짜 (우측 중앙 하단)
    zones.append({
        'type': 'date',
        'page': last,
        'x': 63,
        'y': 93,
        'width': 12,
        'height': 5,
    })

    return zones
