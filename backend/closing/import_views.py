"""
Excel Import for historical Sales & COGs data.
Parses the OneOps Monthly Import Template and creates DailyClosing records.
"""
import io
import calendar
import openpyxl
from decimal import Decimal, InvalidOperation
from datetime import date

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser

from users.models import Organization
from users.views import get_target_org
from closing.models import (
    DailyClosing, ClosingOtherSale, ClosingSupplierCost,
    Supplier, SalesCategory,
)

# Names that map to POS fields (not Other Sales)
POS_FIELDS = {
    'cash': 'pos_cash',
    'card': 'pos_card',
}
SURCHARGE_NAME = 'surcharge'

# These names are skipped (totals, variance rows)
SKIP_NAMES = {'income total', 'cogs total', 'total', 'variance'}


def _safe_decimal(val):
    """Convert cell value to Decimal, return None if empty/zero."""
    if val is None or val == '' or val == 0:
        return None
    try:
        d = Decimal(str(val)).quantize(Decimal('0.01'))
        return d if d > 0 else None
    except (InvalidOperation, ValueError):
        return None


class ImportDataView(APIView):
    """Upload Excel file to import historical sales & COGs data."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        org = get_target_org(request)
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file uploaded'}, status=400)

        try:
            wb = openpyxl.load_workbook(file, data_only=True)
        except Exception as e:
            return Response({'error': f'Invalid Excel file: {str(e)}'}, status=400)

        stats = {
            'months_processed': 0,
            'closings_created': 0,
            'closings_updated': 0,
            'other_sales_created': 0,
            'supplier_costs_created': 0,
            'suppliers_added': [],
            'sales_categories_added': [],
            'errors': [],
        }

        for sheet_name in wb.sheetnames:
            if sheet_name.lower() == 'reference':
                continue

            # Parse sheet name as YYYY-MM
            try:
                parts = sheet_name.strip().split('-')
                year = int(parts[0])
                month = int(parts[1])
                if not (2020 <= year <= 2030 and 1 <= month <= 12):
                    continue
            except (ValueError, IndexError):
                continue

            ws = wb[sheet_name]
            days_in_month = calendar.monthrange(year, month)[1]

            try:
                result = self._process_sheet(ws, org, year, month, days_in_month)
                stats['months_processed'] += 1
                stats['closings_created'] += result['closings_created']
                stats['closings_updated'] += result['closings_updated']
                stats['other_sales_created'] += result['other_sales_created']
                stats['supplier_costs_created'] += result['supplier_costs_created']
                for s in result.get('suppliers_added', []):
                    if s not in stats['suppliers_added']:
                        stats['suppliers_added'].append(s)
                for s in result.get('sales_categories_added', []):
                    if s not in stats['sales_categories_added']:
                        stats['sales_categories_added'].append(s)
            except Exception as e:
                stats['errors'].append(f'{sheet_name}: {str(e)}')

        return Response(stats)

    def _process_sheet(self, ws, org, year, month, days_in_month):
        """Process a single monthly sheet."""
        result = {
            'closings_created': 0, 'closings_updated': 0,
            'other_sales_created': 0, 'supplier_costs_created': 0,
            'suppliers_added': [], 'sales_categories_added': [],
        }

        # Find sections by scanning column A
        income_rows = []
        cogs_rows = []
        current_section = None

        for row_idx in range(1, ws.max_row + 1):
            cell_a = ws.cell(row=row_idx, column=1).value
            if cell_a is None:
                continue
            cell_str = str(cell_a).strip().lower()

            if cell_str == 'income':
                current_section = 'income'
                continue
            elif cell_str == 'cogs':
                current_section = 'cogs'
                continue
            elif cell_str in SKIP_NAMES:
                continue

            if current_section == 'income' and cell_str:
                income_rows.append((row_idx, str(cell_a).strip()))
            elif current_section == 'cogs' and cell_str:
                cogs_rows.append((row_idx, str(cell_a).strip()))

        # Process each day
        for day in range(1, days_in_month + 1):
            col = day + 2  # Column C = day 1

            # Check if any data exists for this day
            has_data = False
            for row_idx, _ in income_rows + cogs_rows:
                val = ws.cell(row=row_idx, column=col).value
                if _safe_decimal(val) is not None:
                    has_data = True
                    break

            if not has_data:
                continue

            closing_date = date(year, month, day)

            # Get or create DailyClosing
            closing, created = DailyClosing.objects.get_or_create(
                organization=org,
                closing_date=closing_date,
                defaults={'status': 'APPROVED'}
            )
            if created:
                result['closings_created'] += 1
            else:
                result['closings_updated'] += 1
                # Clear existing other sales and supplier costs for reimport
                closing.other_sales.all().delete()
                closing.supplier_costs.all().delete()

            # Process income rows
            pos_cash = Decimal('0')
            pos_card = Decimal('0')
            surcharge = Decimal('0')

            for row_idx, name in income_rows:
                val = _safe_decimal(ws.cell(row=row_idx, column=col).value)
                if val is None:
                    continue

                name_lower = name.lower()

                if name_lower == 'cash':
                    pos_cash = val
                elif name_lower == 'card':
                    pos_card = val
                elif name_lower == SURCHARGE_NAME:
                    surcharge = val
                else:
                    # Other sale (Uber, DoorDash, etc.)
                    ClosingOtherSale.objects.create(
                        closing=closing,
                        name=name,
                        amount=val,
                    )
                    result['other_sales_created'] += 1

                    # Auto-add to SalesCategory if not exists
                    _, sc_created = SalesCategory.objects.get_or_create(
                        organization=org,
                        name=name,
                        defaults={'is_active': True}
                    )
                    if sc_created and name not in result['sales_categories_added']:
                        result['sales_categories_added'].append(name)

            # Update POS fields
            closing.pos_cash = pos_cash
            closing.pos_card = pos_card + surcharge  # Card includes surcharge
            closing.actual_cash = pos_cash
            closing.actual_card = pos_card + surcharge
            closing.save()

            # Process COGs rows
            for row_idx, name in cogs_rows:
                val = _safe_decimal(ws.cell(row=row_idx, column=col).value)
                if val is None:
                    continue

                name_lower = name.lower()
                if name_lower == 'other':
                    # Create as generic supplier
                    supplier, _ = Supplier.objects.get_or_create(
                        organization=org,
                        code=f'OTHER',
                        defaults={'name': 'Other', 'category': 'COGS'}
                    )
                else:
                    # Auto-add supplier if not exists
                    code = name.upper().replace(' ', '_')[:50]
                    supplier, sup_created = Supplier.objects.get_or_create(
                        organization=org,
                        code=code,
                        defaults={'name': name, 'category': 'COGS'}
                    )
                    if sup_created and name not in result['suppliers_added']:
                        result['suppliers_added'].append(name)

                ClosingSupplierCost.objects.create(
                    closing=closing,
                    supplier=supplier,
                    amount=val,
                )
                result['supplier_costs_created'] += 1

        return result


class ImportTemplateView(APIView):
    """Download the import template Excel file."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        org = get_target_org(request)

        # Get existing suppliers and sales categories
        suppliers = list(Supplier.objects.filter(
            organization=org, is_active=True
        ).values_list('name', flat=True))
        sales_cats = list(SalesCategory.objects.filter(
            organization=org, is_active=True
        ).values_list('name', flat=True))

        wb = openpyxl.Workbook()
        wb.remove(wb.active)

        # Styles
        section_font = Font(bold=True, size=12, color='FFFFFF')
        income_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
        cogs_fill = PatternFill(start_color='ED7D31', end_color='ED7D31', fill_type='solid')
        total_fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid')
        total_row_fill = PatternFill(start_color='B4C6E7', end_color='B4C6E7', fill_type='solid')
        cogs_total_fill = PatternFill(start_color='F8CBAD', end_color='F8CBAD', fill_type='solid')
        grey_fill = PatternFill(start_color='D9D9D9', end_color='D9D9D9', fill_type='solid')
        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )

        income_defaults = ['Cash', 'Card', 'Surcharge'] + sales_cats
        cogs_defaults = suppliers if suppliers else ['Supplier 1']

        INCOME_ROWS = max(len(income_defaults) + 5, 15)
        COGS_ROWS = max(len(cogs_defaults) + 5, 15)

        # Reference sheet
        ref_ws = wb.create_sheet('Reference')
        ref_ws.cell(row=1, column=1, value='Income Channels').font = Font(bold=True, size=12)
        ref_ws.cell(row=1, column=3, value='COGs Suppliers').font = Font(bold=True, size=12)
        for i, name in enumerate(income_defaults, 2):
            ref_ws.cell(row=i, column=1, value=name)
        for i, name in enumerate(cogs_defaults, 2):
            ref_ws.cell(row=i, column=3, value=name)
        ref_ws.column_dimensions['A'].width = 20
        ref_ws.column_dimensions['C'].width = 20

        ref_ws.cell(row=1, column=5, value='How to Use').font = Font(bold=True, size=14)
        instructions = [
            '1. Fill in daily sales/costs in each monthly sheet',
            '2. Cash, Card rows = POS sales data',
            '3. Other income rows (Uber, DoorDash etc) = Other Sales',
            '4. COGs rows = Supplier costs',
            '5. New company names are auto-added to Store Settings',
            '6. 0 or blank = no data for that day (skipped)',
            '7. Existing data for same date will be overwritten',
            '',
            'WARNING: Do not rename Cash/Card rows',
        ]
        for i, text in enumerate(instructions, 2):
            ref_ws.cell(row=i, column=5, value=text)
        ref_ws.column_dimensions['E'].width = 55

        # Generate 24 monthly sheets
        today = date.today()
        start_year = today.year - 2
        start_month = today.month + 1
        if start_month > 12:
            start_month = 1
            start_year += 1

        for m_offset in range(24):
            y = start_year + (start_month + m_offset - 1) // 12
            mo = (start_month + m_offset - 1) % 12 + 1
            sheet_name = f'{y}-{mo:02d}'
            ws = wb.create_sheet(sheet_name)

            days = calendar.monthrange(y, mo)[1]

            # Income header
            row = 1
            ws.cell(row=row, column=1, value='Income').font = section_font
            ws.cell(row=row, column=1).fill = income_fill
            ws.cell(row=row, column=2, value='Total').font = Font(bold=True, color='FFFFFF')
            ws.cell(row=row, column=2).fill = income_fill
            for d in range(1, days + 1):
                c = ws.cell(row=row, column=d + 2, value=d)
                c.font = Font(bold=True, color='FFFFFF')
                c.fill = income_fill
                c.alignment = Alignment(horizontal='center')
            for d in range(days + 1, 32):
                ws.cell(row=row, column=d + 2).fill = PatternFill(start_color='808080', end_color='808080', fill_type='solid')

            for i in range(INCOME_ROWS):
                r = row + 1 + i
                nc = ws.cell(row=r, column=1)
                if i < len(income_defaults):
                    nc.value = income_defaults[i]
                nc.border = thin_border
                tc = ws.cell(row=r, column=2)
                tc.value = f'=SUM(C{r}:{get_column_letter(days + 2)}{r})'
                tc.font = Font(bold=True)
                tc.fill = total_fill
                tc.border = thin_border
                tc.number_format = '#,##0.00'
                for d in range(1, days + 1):
                    ws.cell(row=r, column=d + 2).border = thin_border
                    ws.cell(row=r, column=d + 2).number_format = '#,##0.00'
                for d in range(days + 1, 32):
                    ws.cell(row=r, column=d + 2).fill = grey_fill

            itr = row + 1 + INCOME_ROWS
            ws.cell(row=itr, column=1, value='Income Total').font = Font(bold=True)
            ws.cell(row=itr, column=1).fill = total_row_fill
            ws.cell(row=itr, column=1).border = thin_border
            for c in range(2, days + 3):
                cl = get_column_letter(c)
                cell = ws.cell(row=itr, column=c)
                cell.value = f'=SUM({cl}{row + 1}:{cl}{itr - 1})'
                cell.font = Font(bold=True)
                cell.fill = total_row_fill
                cell.border = thin_border
                cell.number_format = '#,##0.00'

            # COGs header
            chr_ = itr + 2
            ws.cell(row=chr_, column=1, value='COGs').font = section_font
            ws.cell(row=chr_, column=1).fill = cogs_fill
            ws.cell(row=chr_, column=2, value='Total').font = Font(bold=True, color='FFFFFF')
            ws.cell(row=chr_, column=2).fill = cogs_fill
            for d in range(1, days + 1):
                c = ws.cell(row=chr_, column=d + 2, value=d)
                c.font = Font(bold=True, color='FFFFFF')
                c.fill = cogs_fill
                c.alignment = Alignment(horizontal='center')
            for d in range(days + 1, 32):
                ws.cell(row=chr_, column=d + 2).fill = PatternFill(start_color='808080', end_color='808080', fill_type='solid')

            for i in range(COGS_ROWS):
                r = chr_ + 1 + i
                nc = ws.cell(row=r, column=1)
                if i < len(cogs_defaults):
                    nc.value = cogs_defaults[i]
                nc.border = thin_border
                tc = ws.cell(row=r, column=2)
                tc.value = f'=SUM(C{r}:{get_column_letter(days + 2)}{r})'
                tc.font = Font(bold=True)
                tc.fill = total_fill
                tc.border = thin_border
                tc.number_format = '#,##0.00'
                for d in range(1, days + 1):
                    ws.cell(row=r, column=d + 2).border = thin_border
                    ws.cell(row=r, column=d + 2).number_format = '#,##0.00'
                for d in range(days + 1, 32):
                    ws.cell(row=r, column=d + 2).fill = grey_fill

            ctr = chr_ + 1 + COGS_ROWS
            ws.cell(row=ctr, column=1, value='COGs Total').font = Font(bold=True)
            ws.cell(row=ctr, column=1).fill = cogs_total_fill
            ws.cell(row=ctr, column=1).border = thin_border
            for c in range(2, days + 3):
                cl = get_column_letter(c)
                cell = ws.cell(row=ctr, column=c)
                cell.value = f'=SUM({cl}{chr_ + 1}:{cl}{ctr - 1})'
                cell.font = Font(bold=True)
                cell.fill = cogs_total_fill
                cell.border = thin_border
                cell.number_format = '#,##0.00'

            ws.column_dimensions['A'].width = 18
            ws.column_dimensions['B'].width = 12
            for d in range(1, 32):
                ws.column_dimensions[get_column_letter(d + 2)].width = 9
            ws.freeze_panes = 'C2'

        wb.move_sheet('Reference', offset=-24)

        # Write to response
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="OneOps_Import_Template_{org.name}.xlsx"'
        return response
