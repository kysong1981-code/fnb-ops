"""
Statement parsing service using Claude Vision API.
Extracts line items (date, description, amount) from supplier statements.
"""
import base64
import json
import logging
from decimal import Decimal

import fitz  # PyMuPDF
from django.conf import settings

logger = logging.getLogger(__name__)

VISION_PROMPT = """You are analyzing a supplier statement/invoice document.
Extract ALL line items from this document. For each line item, extract:
- date: the date of the transaction (format: YYYY-MM-DD)
- description: brief description of the item/service
- amount: the amount in dollars (just the number, no currency symbol)

Also extract the total amount shown on the statement.

IMPORTANT:
- If a date is ambiguous (e.g. "05/03"), assume DD/MM format (New Zealand standard)
- Include ALL line items, even if amounts are small
- If there's a subtotal and GST, use the line item amounts (excl. GST) unless only incl. GST amounts are shown
- For the total, use the GRAND TOTAL or TOTAL DUE (incl. GST if shown)

Respond ONLY with valid JSON in this exact format:
{
  "total": 1234.56,
  "line_items": [
    {"date": "2026-03-05", "description": "Frozen items", "amount": 620.00},
    {"date": "2026-03-07", "description": "Meat & poultry", "amount": 850.00}
  ]
}

If you cannot extract any data, respond with:
{"total": 0, "line_items": [], "error": "Could not parse statement"}
"""


def file_to_images(file_path, file_type):
    """Convert file to list of base64-encoded images for Vision API."""
    images = []

    if file_type in ('jpg', 'jpeg', 'png'):
        with open(file_path, 'rb') as f:
            data = base64.standard_b64encode(f.read()).decode('utf-8')
        media_type = 'image/jpeg' if file_type in ('jpg', 'jpeg') else 'image/png'
        images.append({'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': data}})

    elif file_type == 'pdf':
        doc = fitz.open(file_path)
        for page_num in range(min(len(doc), 10)):  # Max 10 pages
            page = doc[page_num]
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes('png')
            data = base64.standard_b64encode(img_bytes).decode('utf-8')
            images.append({'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': data}})
        doc.close()

    return images


def parse_statement(file_path, file_type):
    """
    Parse a supplier statement using Claude Vision API.

    Args:
        file_path: Path to the uploaded file
        file_type: File extension (pdf, jpg, jpeg, png)

    Returns:
        dict: {total: Decimal, line_items: [{date, description, amount}], raw_response: str}
    """
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not configured, skipping Vision parsing")
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        images = file_to_images(file_path, file_type)
        if not images:
            logger.warning(f"Could not convert file to images: {file_path}")
            return None

        # Build message content: images + text prompt
        content = images + [{'type': 'text', 'text': VISION_PROMPT}]

        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=4096,
            messages=[{'role': 'user', 'content': content}],
        )

        raw_text = response.content[0].text.strip()
        logger.info(f"Vision API response: {raw_text[:500]}")

        # Parse JSON from response (handle markdown code blocks)
        json_text = raw_text
        if '```json' in json_text:
            json_text = json_text.split('```json')[1].split('```')[0].strip()
        elif '```' in json_text:
            json_text = json_text.split('```')[1].split('```')[0].strip()

        parsed = json.loads(json_text)

        # Normalize amounts to Decimal
        result = {
            'total': Decimal(str(parsed.get('total', 0))),
            'line_items': [],
            'raw_response': raw_text,
        }

        for item in parsed.get('line_items', []):
            result['line_items'].append({
                'date': item.get('date', ''),
                'description': item.get('description', ''),
                'amount': float(item.get('amount', 0)),
            })

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Vision response as JSON: {e}")
        return {'total': Decimal('0'), 'line_items': [], 'raw_response': raw_text, 'error': str(e)}
    except Exception as e:
        logger.error(f"Vision API call failed: {e}")
        return None


def compare_entries(parsed_data, our_entries):
    """
    Compare parsed statement line items with our ClosingSupplierCost entries.

    Args:
        parsed_data: dict with 'line_items' from parse_statement
        our_entries: list of dicts [{date, amount, invoice_number, id}]

    Returns:
        dict with comparison results
    """
    if not parsed_data or not parsed_data.get('line_items'):
        return {
            'statement_items': [],
            'matched': [],
            'unmatched_statement': [],
            'unmatched_ours': list(our_entries),
            'total_variance': 0,
        }

    statement_items = list(parsed_data['line_items'])
    our_items = list(our_entries)

    matched = []
    unmatched_statement = []

    # Track which of our entries have been matched
    matched_our_ids = set()

    for si in statement_items:
        si_date = si.get('date', '')
        si_amount = round(float(si.get('amount', 0)), 2)
        found = False

        for oi in our_items:
            if oi['id'] in matched_our_ids:
                continue
            oi_date = str(oi.get('date', ''))
            oi_amount = round(float(oi.get('amount', 0)), 2)

            # Match by date + amount (exact)
            if si_date == oi_date and si_amount == oi_amount:
                matched.append({
                    'statement': si,
                    'ours': oi,
                    'status': 'exact_match',
                })
                matched_our_ids.add(oi['id'])
                found = True
                break

        if not found:
            # Try amount-only match (date might differ slightly)
            for oi in our_items:
                if oi['id'] in matched_our_ids:
                    continue
                oi_amount = round(float(oi.get('amount', 0)), 2)
                if si_amount == oi_amount:
                    matched.append({
                        'statement': si,
                        'ours': oi,
                        'status': 'amount_match',
                    })
                    matched_our_ids.add(oi['id'])
                    found = True
                    break

        if not found:
            unmatched_statement.append(si)

    unmatched_ours = [oi for oi in our_items if oi['id'] not in matched_our_ids]

    stmt_total = sum(float(si.get('amount', 0)) for si in statement_items)
    our_total = sum(float(oi.get('amount', 0)) for oi in our_items)

    return {
        'statement_items': statement_items,
        'matched': matched,
        'unmatched_statement': unmatched_statement,
        'unmatched_ours': unmatched_ours,
        'statement_total': round(stmt_total, 2),
        'our_total': round(our_total, 2),
        'total_variance': round(stmt_total - our_total, 2),
    }
