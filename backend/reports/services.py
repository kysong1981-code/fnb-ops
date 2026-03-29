"""
AI-powered sales analysis service using Claude API.
Generates insights, recommendations, and anomaly detection for F&B sales data.
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

INSIGHTS_PROMPT = """You are an expert F&B (Food & Beverage) business analyst.
Analyze the following sales data for "{store_name}" from {start_date} to {end_date}.

DATA:
- Total Sales: ${total_sales:,.2f}
- Daily Average: ${average_daily:,.2f}
- Card Sales: ${card_total:,.2f} ({card_pct:.1f}%)
- Cash Sales: ${cash_total:,.2f} ({cash_pct:.1f}%)
- Best Day: {best_day} (${best_amount:,.2f})
- Worst Day: {worst_day} (${worst_amount:,.2f})
- Trend: {trend} ({trend_pct:+.1f}%)

Day-of-Week Averages:
{dow_data}

Daily Breakdown:
{daily_data}

Respond ONLY with valid JSON in this exact format (use Korean for all text values):
{{
  "summary": "2-3 sentence performance overview in Korean",
  "key_findings": [
    {{"title": "short title", "description": "detail", "type": "positive"}},
    {{"title": "short title", "description": "detail", "type": "negative"}},
    {{"title": "short title", "description": "detail", "type": "neutral"}}
  ],
  "recommendations": [
    "actionable suggestion 1",
    "actionable suggestion 2",
    "actionable suggestion 3"
  ]
}}

Rules:
- Provide 2-4 key findings (mix of positive/negative/neutral)
- Provide 2-4 specific, actionable recommendations
- Focus on patterns, anomalies, and improvement opportunities
- All text must be in Korean
- Be concise but insightful
"""


def generate_sales_insights(sales_data, store_name, start_date, end_date):
    """
    Generate AI-powered insights from sales data.
    Returns dict with summary, key_findings, recommendations or None if API unavailable.
    """
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not configured, skipping AI insights")
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        total = sales_data.get('total_sales', 0)
        card = sales_data.get('card_total', 0)
        cash = sales_data.get('cash_total', 0)
        card_pct = (card / total * 100) if total > 0 else 0
        cash_pct = (cash / total * 100) if total > 0 else 0

        best = sales_data.get('highest', {})
        worst = sales_data.get('lowest', {})

        # Format day-of-week data
        dow_lines = []
        for d in sales_data.get('day_of_week_avg', []):
            dow_lines.append(f"  {d['day']}: ${d['avg_sales']:,.2f}")
        dow_data = '\n'.join(dow_lines) if dow_lines else 'No data'

        # Format daily data (last 14 days max for prompt size)
        daily = sales_data.get('data', [])[-14:]
        daily_lines = []
        for d in daily:
            daily_lines.append(f"  {d['date']}: ${d['actual_total']:,.2f} (Card: ${d['card_sales']:,.2f}, Cash: ${d['cash_sales']:,.2f})")
        daily_data = '\n'.join(daily_lines) if daily_lines else 'No data'

        prompt = INSIGHTS_PROMPT.format(
            store_name=store_name,
            start_date=start_date,
            end_date=end_date,
            total_sales=total,
            average_daily=sales_data.get('average_daily', 0),
            card_total=card,
            card_pct=card_pct,
            cash_total=cash,
            cash_pct=cash_pct,
            best_day=best.get('date', 'N/A'),
            best_amount=best.get('amount', 0),
            worst_day=worst.get('date', 'N/A'),
            worst_amount=worst.get('amount', 0),
            trend=sales_data.get('trend', 'stable'),
            trend_pct=sales_data.get('trend_percentage', 0),
            dow_data=dow_data,
            daily_data=daily_data,
        )

        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=2048,
            messages=[{'role': 'user', 'content': prompt}],
        )

        text = response.content[0].text.strip()
        # Extract JSON from response
        if text.startswith('```'):
            text = text.split('\n', 1)[1].rsplit('```', 1)[0].strip()

        result = json.loads(text)
        return result

    except Exception as e:
        logger.error(f"AI insights generation failed: {e}")
        return None


SKY_REPORT_ANALYSIS_PROMPT = """You are an expert F&B (Food & Beverage) business analyst specializing in P&L analysis for New Zealand restaurants.

Analyze the following financial data for "{store_name}" for the period {period}.

CURRENT PERIOD DATA:
- Total Sales (inc GST): ${total_sales:,.2f}
- Excl GST Sales: ${excl_gst:,.2f}
- COGS: ${cogs:,.2f} ({cogs_ratio:.1f}%)
- Operating Expenses: ${op_exp:,.2f}
- Total Labour: ${labour:,.2f} ({labour_ratio:.1f}%)
- Operating Profit: ${profit:,.2f} ({profit_ratio:.1f}% margin)
- Trading Days: {days}

KPIs:
- Sales/Day: ${sales_per_day:,.2f}
- Sales/Tab: {sales_per_tab}
- Sales/Labour Hour: {sales_per_labour_hr}
- Sales/Opening Hour: {sales_per_opening_hr}

{comparison_text}

MONTHLY BREAKDOWN:
{monthly_breakdown}

Respond ONLY with valid JSON:
{{
  "executive_summary": "2-3 sentence performance overview",
  "highlights": [
    {{"text": "positive finding", "type": "positive"}},
    {{"text": "concern or issue", "type": "negative"}}
  ],
  "recommendations": [
    "actionable suggestion 1",
    "actionable suggestion 2",
    "actionable suggestion 3"
  ],
  "trend_note": "1-2 sentence trend analysis"
}}

Rules:
- Provide 2-4 highlights (mix of positive/negative)
- Provide 2-4 specific, actionable recommendations for an F&B business owner
- Consider NZ seasonal factors and market conditions
- All text must be in English
- Be concise but insightful
- Focus on profitability improvement opportunities
"""


def generate_sky_report_analysis(range_data, store_name):
    """
    Generate AI-powered P&L analysis from Sky Report range data.
    Returns dict with executive_summary, highlights, recommendations, trend_note or None.
    """
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not configured, skipping AI analysis")
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        totals = range_data.get('totals', {})
        period = f"{range_data['from_month']}/{range_data['from_year']} - {range_data['to_month']}/{range_data['to_year']}"

        # Build comparison text
        comparison_text = ""
        comp = range_data.get('comparison', {})
        if comp.get('prev_1'):
            p1 = comp['prev_1']['totals']
            yoy1 = comp.get('yoy_1', {})
            comparison_text += f"\nVS LAST YEAR (same period):\n"
            comparison_text += f"- Sales: ${p1.get('total_sales', 0):,.2f} (YoY: {yoy1.get('sales', 0):+.1f}%)\n"
            comparison_text += f"- COGS: ${p1.get('cogs', 0):,.2f} (YoY: {yoy1.get('cogs', 0):+.1f}%)\n"
            comparison_text += f"- Profit: ${p1.get('profit', 0):,.2f} (YoY: {yoy1.get('profit', 0):+.1f}%)\n"

        if comp.get('prev_2'):
            p2 = comp['prev_2']['totals']
            yoy2 = comp.get('yoy_2', {})
            comparison_text += f"\nVS 2 YEARS AGO (same period):\n"
            comparison_text += f"- Sales: ${p2.get('total_sales', 0):,.2f} (YoY: {yoy2.get('sales', 0):+.1f}%)\n"
            comparison_text += f"- Profit: ${p2.get('profit', 0):,.2f} (YoY: {yoy2.get('profit', 0):+.1f}%)\n"

        if not comparison_text:
            comparison_text = "No previous year data available for comparison."

        # Monthly breakdown
        monthly_lines = []
        for r in range_data.get('reports', []):
            monthly_lines.append(
                f"  {r.get('month_display', r.get('month'))}: Sales=${r.get('total_sales_inc_gst', 0)}, "
                f"COGS=${r.get('cogs', 0)}, Profit=${r.get('operating_profit', 0)}"
            )
        monthly_breakdown = '\n'.join(monthly_lines) if monthly_lines else 'No monthly data'

        excl_gst = totals.get('excl_gst', 0)
        total_sales = totals.get('total_sales', 0)
        cogs = totals.get('cogs', 0)
        labour = totals.get('labour', 0)
        profit = totals.get('profit', 0)

        prompt = SKY_REPORT_ANALYSIS_PROMPT.format(
            store_name=store_name,
            period=period,
            total_sales=total_sales,
            excl_gst=excl_gst,
            cogs=cogs,
            cogs_ratio=(cogs / excl_gst * 100) if excl_gst else 0,
            op_exp=totals.get('op_exp', 0),
            labour=labour,
            labour_ratio=(labour / excl_gst * 100) if excl_gst else 0,
            profit=profit,
            profit_ratio=(profit / excl_gst * 100) if excl_gst else 0,
            days=totals.get('days', 0),
            sales_per_day=f"{excl_gst / totals['days']:,.2f}" if totals.get('days') else 'N/A',
            sales_per_tab=totals.get('sales_per_tab', 'N/A'),
            sales_per_labour_hr=totals.get('sales_per_labour_hr', 'N/A'),
            sales_per_opening_hr=totals.get('sales_per_opening_hr', 'N/A'),
            comparison_text=comparison_text,
            monthly_breakdown=monthly_breakdown,
        )

        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=2048,
            messages=[{'role': 'user', 'content': prompt}],
        )

        text = response.content[0].text.strip()
        if text.startswith('```'):
            text = text.split('\n', 1)[1].rsplit('```', 1)[0].strip()

        result = json.loads(text)
        return result

    except Exception as e:
        logger.error(f"Sky Report AI analysis failed: {e}")
        return None
