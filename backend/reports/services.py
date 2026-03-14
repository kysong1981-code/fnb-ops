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
