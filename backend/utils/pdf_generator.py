"""
PDF Generation Utility for fnb-ops
Provides helper functions for generating various PDF reports
Uses ReportLab for PDF creation
"""
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, Flowable
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


class PDFGenerator:
    """
    Base PDF Generator class
    Provides common PDF generation functionality
    """

    def __init__(self, title="Report", pagesize=A4, orientation='portrait'):
        """
        Initialize PDF generator
        Args:
            title: Document title
            pagesize: Page size (A4, letter, etc.)
            orientation: 'portrait' or 'landscape'
        """
        self.title = title
        self.pagesize = pagesize
        self.orientation = orientation
        self.buffer = BytesIO()
        self.styles = getSampleStyleSheet()
        self._init_custom_styles()

    def _init_custom_styles(self):
        """Initialize custom paragraph styles"""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
        ))

        # Heading style
        self.styles.add(ParagraphStyle(
            name='CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#374151'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        ))

        # Normal text
        self.styles.add(ParagraphStyle(
            name='CustomNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#374151'),
            spaceAfter=6,
        ))

        # Emphasis
        self.styles.add(ParagraphStyle(
            name='CustomEmphasis',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#1f2937'),
            fontName='Helvetica-Bold',
        ))

    def _create_header_table(self, company_name, document_title, date_str=None):
        """Create header table with company info and document title"""
        if date_str is None:
            date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        header_data = [
            [
                Paragraph(f"<b>{company_name}</b><br/>fnb-ops System", self.styles['CustomNormal']),
                Paragraph(f"<b>{document_title}</b>", self.styles['CustomTitle']),
                Paragraph(f"<b>Date:</b> {date_str}", self.styles['CustomNormal']),
            ]
        ]

        header_table = Table(header_data, colWidths=[2*inch, 3*inch, 2*inch])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f4f6')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
        ]))

        return header_table

    def _create_footer_table(self, page_text="Page 1"):
        """Create footer table"""
        footer_data = [[Paragraph(page_text, self.styles['CustomNormal'])]]
        footer_table = Table(footer_data, colWidths=[7.5*inch])
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#9ca3af')),
            ('GRID', (0, 0), (-1, -1), 0),
        ]))
        return footer_table

    def get_buffer(self):
        """Return the PDF buffer"""
        self.buffer.seek(0)
        return self.buffer


class DailyClosingPDFGenerator(PDFGenerator):
    """PDF Generator for Daily Closing Reports"""

    def generate(self, closing_data, company_name="FNB Store"):
        """
        Generate Daily Closing PDF Report
        Args:
            closing_data: Dict with closing information
            company_name: Company/Store name
        Returns:
            BytesIO buffer with PDF content
        """
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=self.pagesize,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch,
            leftMargin=0.75*inch,
            rightMargin=0.75*inch,
        )

        elements = []

        # Header
        elements.append(self._create_header_table(
            company_name,
            "Daily Closing Report",
            closing_data.get('date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        ))
        elements.append(Spacer(1, 0.3*inch))

        # Closing Summary
        elements.append(Paragraph("Closing Summary", self.styles['CustomHeading']))

        summary_data = [
            ['POS Card', f"${closing_data.get('pos_card', 0):.2f}"],
            ['POS Cash', f"${closing_data.get('pos_cash', 0):.2f}"],
            ['Actual Card', f"${closing_data.get('actual_card', 0):.2f}"],
            ['Actual Cash', f"${closing_data.get('actual_cash', 0):.2f}"],
        ]

        if 'hr_cash' in closing_data and closing_data['hr_cash']:
            summary_data.append(['HR Cash', f"${closing_data['hr_cash']:.2f}"])

        variance = closing_data.get('variance', 0)
        summary_data.append([
            'Variance',
            f"${variance:.2f}",
        ])

        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e5e7eb')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0fdf4') if variance == 0 else colors.HexColor('#fef2f2')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1f2937')),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))

        elements.append(summary_table)
        elements.append(Spacer(1, 0.2*inch))

        # Status
        status = closing_data.get('status', 'DRAFT')
        status_color = {
            'DRAFT': colors.HexColor('#3b82f6'),
            'SUBMITTED': colors.HexColor('#f59e0b'),
            'APPROVED': colors.HexColor('#10b981'),
            'REJECTED': colors.HexColor('#ef4444'),
        }.get(status, colors.HexColor('#6b7280'))

        status_text = f"Status: <b><font color='{status_color.hexval()}'>{status}</font></b>"
        elements.append(Paragraph(status_text, self.styles['CustomNormal']))
        elements.append(Spacer(1, 0.3*inch))

        # Cash Expenses (if any)
        if closing_data.get('expenses'):
            elements.append(Paragraph("Cash Expenses", self.styles['CustomHeading']))

            expense_data = [['Category', 'Reason', 'Amount']]
            total_expenses = 0

            for expense in closing_data['expenses']:
                expense_data.append([
                    expense.get('category', 'Other'),
                    expense.get('reason', ''),
                    f"${expense.get('amount', 0):.2f}",
                ])
                total_expenses += expense.get('amount', 0)

            expense_data.append(['TOTAL', '', f"${total_expenses:.2f}"])

            expense_table = Table(expense_data, colWidths=[1.5*inch, 3.5*inch, 1.5*inch])
            expense_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0fdf4')),
            ]))

            elements.append(expense_table)
            elements.append(Spacer(1, 0.3*inch))

        # Footer
        elements.append(Spacer(1, 0.5*inch))
        elements.append(self._create_footer_table(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"))

        # Build PDF
        doc.build(elements)
        self.buffer.seek(0)

        return self.buffer


class PayslipPDFGenerator(PDFGenerator):
    """PDF Generator for Payslips"""

    def generate(self, payslip_data, company_name="FNB Company"):
        """
        Generate Payslip PDF
        Args:
            payslip_data: Dict with payslip information
            company_name: Company name
        Returns:
            BytesIO buffer with PDF content
        """
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=self.pagesize,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch,
            leftMargin=0.75*inch,
            rightMargin=0.75*inch,
        )

        elements = []

        # Header
        elements.append(self._create_header_table(
            company_name,
            "Payslip",
            payslip_data.get('pay_period', datetime.now().strftime('%Y-%m'))
        ))
        elements.append(Spacer(1, 0.3*inch))

        # Employee Information
        elements.append(Paragraph("Employee Information", self.styles['CustomHeading']))

        emp_data = [
            [f"Name: {payslip_data.get('employee_name', 'N/A')}", f"ID: {payslip_data.get('employee_id', 'N/A')}"],
            [f"Position: {payslip_data.get('position', 'N/A')}", f"Department: {payslip_data.get('department', 'N/A')}"],
        ]

        emp_table = Table(emp_data, colWidths=[3.75*inch, 3.75*inch])
        emp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f9fafb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
        ]))

        elements.append(emp_table)
        elements.append(Spacer(1, 0.3*inch))

        # Earnings
        elements.append(Paragraph("Earnings", self.styles['CustomHeading']))

        earnings_data = [['Description', 'Amount']]
        total_earnings = 0

        for earning in payslip_data.get('earnings', []):
            earnings_data.append([
                earning.get('description', ''),
                f"${earning.get('amount', 0):.2f}",
            ])
            total_earnings += earning.get('amount', 0)

        earnings_data.append(['Total Earnings', f"${total_earnings:.2f}"])

        earnings_table = Table(earnings_data, colWidths=[4*inch, 3.5*inch])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#dcfce7')),
        ]))

        elements.append(earnings_table)
        elements.append(Spacer(1, 0.2*inch))

        # Deductions
        elements.append(Paragraph("Deductions", self.styles['CustomHeading']))

        deductions_data = [['Description', 'Amount']]
        total_deductions = 0

        for deduction in payslip_data.get('deductions', []):
            deductions_data.append([
                deduction.get('description', ''),
                f"${deduction.get('amount', 0):.2f}",
            ])
            total_deductions += deduction.get('amount', 0)

        deductions_data.append(['Total Deductions', f"${total_deductions:.2f}"])

        deductions_table = Table(deductions_data, colWidths=[4*inch, 3.5*inch])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c2d12')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fee2e2')),
        ]))

        elements.append(deductions_table)
        elements.append(Spacer(1, 0.3*inch))

        # Net Pay
        net_pay = total_earnings - total_deductions
        net_pay_text = f"<b>Net Pay: ${net_pay:.2f}</b>"
        elements.append(Paragraph(net_pay_text, self.styles['CustomEmphasis']))

        elements.append(Spacer(1, 0.5*inch))

        # Footer
        elements.append(self._create_footer_table(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"))

        # Build PDF
        doc.build(elements)
        self.buffer.seek(0)

        return self.buffer
