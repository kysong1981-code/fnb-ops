"""
Import historical Sales & COGs data from Excel (.xlsx) or CSV files.
Supports both the OneOps template format and the SkyT2 CSV format.
"""
import io
import csv
import calendar
import openpyxl
from decimal import Decimal, InvalidOperation
from datetime import date

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser

from users.views import get_target_org
from closing.models import (
    DailyClosing, ClosingOtherSale, ClosingSupplierCost,
    Supplier, SalesCategory,
)

# These names are skipped (totals, variance, headers)
SKIP_NAMES = {'income total', 'cogs total', 'total', 'variance', 'income', 'store name', 'month'}

SURCHARGE_NAME = 'surcharge'


def _safe_decimal(val):
    """Convert cell value to Decimal, return None if empty/zero/invalid."""
    if val is None or val == '' or val == 0:
        return None
    try:
        d = Decimal(str(val).strip()).quantize(Decimal('0.01'))
        return d if d != 0 else None
    except (InvalidOperation, ValueError):
        return None


def _process_day_data(org, closing_date, income_data, cogs_data, result):
    """
    Process one day's income and COGs data.
    income_data: list of (name, value) tuples
    cogs_data: list of (name, value) tuples
    """
    # Check if any data exists
    has_data = any(v is not None for _, v in income_data + cogs_data)
    if not has_data:
        return

    closing, created = DailyClosing.objects.get_or_create(
        organization=org,
        closing_date=closing_date,
        defaults={'status': 'APPROVED'}
    )
    if created:
        result['closings_created'] += 1
    else:
        result['closings_updated'] += 1
        closing.other_sales.all().delete()
        closing.supplier_costs.all().delete()

    pos_cash = Decimal('0')
    pos_card = Decimal('0')
    surcharge = Decimal('0')

    for name, val in income_data:
        if val is None:
            continue
        name_lower = name.lower().strip()
        if name_lower == 'cash':
            pos_cash = val
        elif name_lower == 'card':
            pos_card = val
        elif name_lower == SURCHARGE_NAME:
            surcharge = val
        else:
            ClosingOtherSale.objects.create(closing=closing, name=name.strip(), amount=val)
            result['other_sales_created'] += 1
            _, sc_created = SalesCategory.objects.get_or_create(
                organization=org, name=name.strip(),
                defaults={'is_active': True}
            )
            if sc_created and name.strip() not in result['sales_categories_added']:
                result['sales_categories_added'].append(name.strip())

    closing.pos_cash = pos_cash
    closing.pos_card = pos_card + surcharge
    closing.actual_cash = pos_cash
    closing.actual_card = pos_card + surcharge
    closing.save()

    for name, val in cogs_data:
        if val is None:
            continue
        name_clean = name.strip()
        name_lower = name_clean.lower()
        if name_lower == 'other':
            supplier, _ = Supplier.objects.get_or_create(
                organization=org, code='OTHER',
                defaults={'name': 'Other', 'category': 'COGS'}
            )
        else:
            code = name_clean.upper().replace(' ', '_')[:50]
            supplier, sup_created = Supplier.objects.get_or_create(
                organization=org, code=code,
                defaults={'name': name_clean, 'category': 'COGS'}
            )
            if sup_created and name_clean not in result['suppliers_added']:
                result['suppliers_added'].append(name_clean)

        ClosingSupplierCost.objects.create(closing=closing, supplier=supplier, amount=val)
        result['supplier_costs_created'] += 1


def _new_result():
    return {
        'closings_created': 0, 'closings_updated': 0,
        'other_sales_created': 0, 'supplier_costs_created': 0,
        'suppliers_added': [], 'sales_categories_added': [],
    }


def _merge_result(stats, result):
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


class ImportDataView(APIView):
    """Upload Excel or CSV file to import historical sales & COGs data."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        org = get_target_org(request)
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file uploaded'}, status=400)

        filename = file.name.lower()
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

        if filename.endswith('.csv'):
            self._process_csv(file, org, stats)
        elif filename.endswith(('.xlsx', '.xls')):
            self._process_excel(file, org, stats)
        else:
            return Response({'error': 'Unsupported file format. Use .xlsx or .csv'}, status=400)

        return Response(stats)

    def _process_csv(self, file, org, stats):
        """
        Process CSV in SkyT2 format:
        Store Name,Sky T2
        Month,2024-01
        (blank)
        Income,Total,1,2,...,31
        Cash,total,val,val,...
        ...
        Income Total,...
        (blank)
        COGs (Supplier Costs),Total,1,2,...,31
        Coke,total,val,...
        ...
        COGs Total,...
        (repeats for each month)
        """
        content = file.read().decode('utf-8-sig')  # Handle BOM
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)

        month_blocks = []
        current_block = {'year': None, 'month': None, 'income': [], 'cogs': []}
        current_section = None

        for row in rows:
            if not row or all(c.strip() == '' for c in row):
                continue

            first = row[0].strip().lower() if row[0] else ''

            # Detect month line
            if first == 'month' and len(row) >= 2:
                # Save previous block if it has data
                if current_block['year'] and (current_block['income'] or current_block['cogs']):
                    month_blocks.append(current_block)
                # Parse YYYY-MM
                try:
                    parts = row[1].strip().split('-')
                    current_block = {
                        'year': int(parts[0]),
                        'month': int(parts[1]),
                        'income': [],
                        'cogs': [],
                    }
                    current_section = None
                except (ValueError, IndexError):
                    current_block = {'year': None, 'month': None, 'income': [], 'cogs': []}
                continue

            if first == 'store name':
                continue

            # Detect section headers
            if first == 'income':
                current_section = 'income'
                continue
            elif first.startswith('cogs'):
                current_section = 'cogs'
                continue

            # Skip totals/variance
            if first in SKIP_NAMES:
                current_section = None  # End of section
                continue

            # Data rows
            if current_block['year'] and current_section and first:
                name = row[0].strip()
                # Values start at index 2 (skip name and total)
                values = row[2:] if len(row) > 2 else []
                if current_section == 'income':
                    current_block['income'].append((name, values))
                elif current_section == 'cogs':
                    current_block['cogs'].append((name, values))

        # Don't forget the last block
        if current_block['year'] and (current_block['income'] or current_block['cogs']):
            month_blocks.append(current_block)

        # Process each month block
        for block in month_blocks:
            year, month = block['year'], block['month']
            days_in_month = calendar.monthrange(year, month)[1]
            result = _new_result()

            try:
                for day in range(1, days_in_month + 1):
                    day_idx = day - 1  # 0-based index into values

                    income_data = []
                    for name, values in block['income']:
                        val = _safe_decimal(values[day_idx]) if day_idx < len(values) else None
                        income_data.append((name, val))

                    cogs_data = []
                    for name, values in block['cogs']:
                        val = _safe_decimal(values[day_idx]) if day_idx < len(values) else None
                        cogs_data.append((name, val))

                    _process_day_data(org, date(year, month, day), income_data, cogs_data, result)

                stats['months_processed'] += 1
                _merge_result(stats, result)
            except Exception as e:
                stats['errors'].append(f'{year}-{month:02d}: {str(e)}')

    def _process_excel(self, file, org, stats):
        """Process Excel file (OneOps template format)."""
        try:
            wb = openpyxl.load_workbook(file, data_only=True)
        except Exception as e:
            stats['errors'].append(f'Invalid Excel file: {str(e)}')
            return

        for sheet_name in wb.sheetnames:
            if sheet_name.lower() == 'reference':
                continue
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
            result = _new_result()

            try:
                # Find sections
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
                    elif cell_str.startswith('cogs'):
                        current_section = 'cogs'
                        continue
                    elif cell_str in SKIP_NAMES:
                        continue
                    if current_section == 'income' and cell_str:
                        income_rows.append((row_idx, str(cell_a).strip()))
                    elif current_section == 'cogs' and cell_str:
                        cogs_rows.append((row_idx, str(cell_a).strip()))

                for day in range(1, days_in_month + 1):
                    col = day + 2

                    income_data = []
                    for row_idx, name in income_rows:
                        val = _safe_decimal(ws.cell(row=row_idx, column=col).value)
                        income_data.append((name, val))

                    cogs_data = []
                    for row_idx, name in cogs_rows:
                        val = _safe_decimal(ws.cell(row=row_idx, column=col).value)
                        cogs_data.append((name, val))

                    _process_day_data(org, date(year, month, day), income_data, cogs_data, result)

                stats['months_processed'] += 1
                _merge_result(stats, result)
            except Exception as e:
                stats['errors'].append(f'{sheet_name}: {str(e)}')


class ImportTemplateView(APIView):
    """Download the import template Excel file."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        org = get_target_org(request)
        fmt = request.query_params.get('format', 'xlsx')

        suppliers = list(Supplier.objects.filter(
            organization=org, is_active=True
        ).values_list('name', flat=True))
        sales_cats = list(SalesCategory.objects.filter(
            organization=org, is_active=True
        ).values_list('name', flat=True))

        income_defaults = ['Cash', 'Card', 'Surcharge'] + sales_cats
        cogs_defaults = suppliers if suppliers else []

        # Generate date range: 2 years back from current month
        today = date.today()
        start_year = today.year - 2
        start_month = today.month + 1
        if start_month > 12:
            start_month = 1
            start_year += 1

        months = []
        for m_offset in range(24):
            y = start_year + (start_month + m_offset - 1) // 12
            mo = (start_month + m_offset - 1) % 12 + 1
            months.append((y, mo))

        if fmt == 'csv':
            return self._generate_csv(org, months, income_defaults, cogs_defaults)
        else:
            return self._generate_xlsx(org, months, income_defaults, cogs_defaults)

    def _generate_csv(self, org, months, income_defaults, cogs_defaults):
        """Generate CSV template in SkyT2 format."""
        output = io.StringIO()
        writer = csv.writer(output)

        for year, month in months:
            days = calendar.monthrange(year, month)[1]
            day_headers = ['Total'] + list(range(1, days + 1))
            # Pad to 31 columns
            while len(day_headers) < 32:
                day_headers.append('')

            writer.writerow(['Store Name', org.name])
            writer.writerow(['Month', f'{year}-{month:02d}'])
            writer.writerow([])

            # Income header
            writer.writerow(['Income'] + day_headers)
            for name in income_defaults:
                writer.writerow([name, ''] + [''] * 31)
            # Extra blank rows for new entries
            for _ in range(5):
                writer.writerow([''] + [''] * 32)
            writer.writerow(['Income Total'] + [''] * 32)
            writer.writerow([])

            # COGs header
            writer.writerow(['COGs (Supplier Costs)'] + day_headers)
            for name in cogs_defaults:
                writer.writerow([name, ''] + [''] * 31)
            writer.writerow(['Other', ''] + [''] * 31)
            for _ in range(5):
                writer.writerow([''] + [''] * 32)
            writer.writerow(['COGs Total'] + [''] * 32)
            writer.writerow([])
            writer.writerow([])

        content = output.getvalue()
        response = HttpResponse(content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="OneOps_Import_Template_{org.name}.csv"'
        return response

    def _generate_xlsx(self, org, months, income_defaults, cogs_defaults):
        """Generate Excel template."""
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook()
        wb.remove(wb.active)

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
            '8. You can also upload CSV files in the same format',
            '',
            'WARNING: Do not rename Cash/Card rows',
        ]
        for i, text in enumerate(instructions, 2):
            ref_ws.cell(row=i, column=5, value=text)
        ref_ws.column_dimensions['E'].width = 55

        for y, mo in months:
            sheet_name = f'{y}-{mo:02d}'
            ws = wb.create_sheet(sheet_name)
            days = calendar.monthrange(y, mo)[1]

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

        wb.move_sheet('Reference', offset=-len(months))

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="OneOps_Import_Template_{org.name}.xlsx"'
        return response
