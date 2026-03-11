"""
GoMenu POS API Client
=====================
Implements the GoMenu signature algorithm and API calls
for syncing daily sales data into DailyClosing.

API Base: https://api.yugu.co.nz
Signature: MD5-based with sorted params + salt
"""

import hashlib
import time
import logging
import requests
from decimal import Decimal
from datetime import date, datetime

logger = logging.getLogger(__name__)

GOMENU_API_BASE = 'https://api.yugu.co.nz'
REQUEST_DEVICE = 'gomenu202601'
REQUEST_TIMEOUT = 30


class GoMenuError(Exception):
    """GoMenu API error"""
    pass


class GoMenuClient:
    """
    GoMenu POS API client.

    Usage:
        client = GoMenuClient(api_key='xxx', account='user', password='pass')
        success, data = client.test_connection()
        if success:
            sales = client.get_daily_sales(store_id, target_date)
    """

    def __init__(self, api_key, account=None, password=None):
        self.api_key = api_key
        self.account = account
        self.password = password
        self.login_token = None
        self.shop_id = None
        self.store_list = []

    def _generate_sign(self, params):
        """
        Generate MD5 signature per GoMenu API spec.

        Algorithm:
        1. Add fixed params (lang_id, timestamp, request_device)
        2. Sort all params alphabetically by key
        3. Concatenate as "key=value&key=value&..."
        4. salt = MD5(api_key + timestamp)
        5. Append salt to string
        6. sign = MD5(result)
        """
        timestamp = str(int(time.time()))

        # Add fixed params
        all_params = dict(params)
        all_params['lang_id'] = '1'
        all_params['timestamp'] = timestamp
        all_params['request_device'] = REQUEST_DEVICE

        # Sort alphabetically by key
        sorted_keys = sorted(all_params.keys())

        # Concatenate as key=value& (with trailing &)
        param_str = '&'.join(f'{k}={all_params[k]}' for k in sorted_keys) + '&'

        # salt = MD5(api_key + timestamp)
        salt_input = self.api_key + timestamp
        salt = hashlib.md5(salt_input.encode('utf-8')).hexdigest()

        # Append salt to param string
        sign_input = param_str + salt

        # Final sign = MD5
        sign = hashlib.md5(sign_input.encode('utf-8')).hexdigest()

        return sign, timestamp

    def _make_request(self, endpoint, params=None):
        """
        Make an authenticated POST request to GoMenu API.
        Auto-logs in if not already authenticated.
        """
        if params is None:
            params = {}

        # Add auth token if we have it
        if self.login_token:
            params['login_token'] = self.login_token
        if self.shop_id:
            params['shop_id'] = str(self.shop_id)

        # Generate signature
        sign, timestamp = self._generate_sign(params)

        # Build full payload
        payload = dict(params)
        payload['lang_id'] = '1'
        payload['timestamp'] = timestamp
        payload['request_device'] = REQUEST_DEVICE
        payload['sign'] = sign

        url = f'{GOMENU_API_BASE}{endpoint}'

        # Log full request details for debugging
        safe_payload = {k: ('***' if k in ('password', 'sign') else v) for k, v in payload.items()}
        logger.info(f'GoMenu API call: POST {endpoint}')
        logger.info(f'GoMenu payload keys: {list(payload.keys())}')
        logger.info(f'GoMenu payload (safe): {safe_payload}')

        try:
            # Send as form-encoded (GoMenu API is PHP-based)
            response = requests.post(url, data=payload, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            logger.info(f'GoMenu response: {data}')
            return data
        except requests.exceptions.Timeout:
            raise GoMenuError('GoMenu API request timed out')
        except requests.exceptions.ConnectionError:
            raise GoMenuError('Could not connect to GoMenu API')
        except requests.exceptions.RequestException as e:
            raise GoMenuError(f'GoMenu API request failed: {str(e)}')
        except ValueError:
            raise GoMenuError('GoMenu API returned invalid JSON')

    def login(self):
        """
        Login to GoMenu and retrieve login_token + store list.

        POST /Weblogin/accountLogin
        Returns: login_token, shop_id, store_list
        """
        if not self.account or not self.password:
            raise GoMenuError('GoMenu account and password are required')

        params = {
            'account': self.account,
            'password': self.password,
        }

        data = self._make_request('/Weblogin/accountLogin', params)

        # Check response status
        code = data.get('code', data.get('status'))
        if code in (200, 1, '200', '1'):
            result = data.get('data', data)
            self.login_token = result.get('login_token')
            self.shop_id = result.get('shop_id')
            self.store_list = result.get('store_list', [])
            logger.info(f'GoMenu login success. shop_id={self.shop_id}, stores={len(self.store_list)}')
            return True, result
        else:
            msg = data.get('msg', data.get('message', 'Login failed'))
            logger.warning(f'GoMenu login failed: {msg}')
            return False, data

    def ensure_logged_in(self):
        """Ensure we have a valid login token."""
        if not self.login_token:
            success, data = self.login()
            if not success:
                raise GoMenuError(f'GoMenu login failed: {data.get("msg", "Unknown error")}')

    def test_connection(self):
        """
        Test the connection by attempting login.
        Returns (success: bool, data: dict)
        """
        try:
            success, data = self.login()
            if success:
                store_count = len(self.store_list)
                return True, {
                    'message': f'Successfully connected to GoMenu. Found {store_count} store(s).',
                    'shop_id': self.shop_id,
                    'store_count': store_count,
                    'store_list': self.store_list,
                }
            else:
                return False, {
                    'message': data.get('msg', 'Login failed. Check your credentials.'),
                }
        except GoMenuError as e:
            return False, {'message': str(e)}
        except Exception as e:
            logger.exception('GoMenu test_connection error')
            return False, {'message': f'Connection error: {str(e)}'}

    def get_store_categories(self, store_id):
        """
        Get store categories.
        POST /Webstoreitems/getStoreCate
        """
        self.ensure_logged_in()
        return self._make_request('/Webstoreitems/getStoreCate', {
            'store_id': str(store_id),
        })

    def get_product_list(self, store_id, page=1, limit=100):
        """
        Get product list with prices.
        POST /Webstoreitems/productList
        """
        self.ensure_logged_in()
        return self._make_request('/Webstoreitems/productList', {
            'store_id': str(store_id),
            'page': str(page),
            'limit': str(limit),
        })

    def get_stock_logs(self, store_id, page=1, limit=50, start_date=None, end_date=None):
        """
        Get stock logs (includes sales deductions with order_no).
        POST /Webstock/itemsStockLog
        """
        self.ensure_logged_in()
        params = {
            'store_id': str(store_id),
            'page': str(page),
            'limit': str(limit),
        }
        if start_date:
            params['start_date'] = start_date
        if end_date:
            params['end_date'] = end_date
        return self._make_request('/Webstock/itemsStockLog', params)

    def cashier_sync(self, store_id):
        """
        Data sync endpoint - pushes/pulls changes.
        POST /Cashiersync/cashierSyncUpdate
        """
        self.ensure_logged_in()
        return self._make_request('/Cashiersync/cashierSyncUpdate', {
            'store_id': str(store_id),
        })


def create_client_from_integration(integration):
    """
    Create a GoMenuClient from an Integration model instance.

    Args:
        integration: users.models.Integration instance (service='GOMENU')

    Returns:
        GoMenuClient instance
    """
    config = integration.config or {}
    return GoMenuClient(
        api_key=integration.api_key or '',
        account=config.get('account', ''),
        password=config.get('password', ''),
    )


def sync_daily_sales(integration, target_date=None):
    """
    Sync daily sales from GoMenu POS to DailyClosing.

    This function:
    1. Logs into GoMenu with saved credentials
    2. Retrieves the store list
    3. Fetches sales data for the target date
    4. Updates the DailyClosing record for that date

    Args:
        integration: Integration model instance (service='GOMENU')
        target_date: date object (defaults to today)

    Returns:
        dict with sync results
    """
    from closing.models import DailyClosing

    if target_date is None:
        target_date = date.today()

    client = create_client_from_integration(integration)

    # Login
    success, login_data = client.test_connection()
    if not success:
        return {
            'success': False,
            'error': login_data.get('message', 'Login failed'),
        }

    store_list = login_data.get('store_list', [])
    if not store_list:
        return {
            'success': False,
            'error': 'No stores found in GoMenu account',
        }

    # Use the first store (or match by config)
    config = integration.config or {}
    target_store_id = config.get('store_id')

    if target_store_id:
        store = next((s for s in store_list if str(s.get('store_id')) == str(target_store_id)), None)
        if not store:
            store = store_list[0]
    else:
        store = store_list[0]

    store_id = store.get('store_id', store.get('id'))
    store_name = store.get('store_name', store.get('name', 'Unknown'))

    # Try to get sales data via cashier sync
    try:
        sync_data = client.cashier_sync(store_id)
        logger.info(f'GoMenu cashier sync response keys: {sync_data.keys() if isinstance(sync_data, dict) else "not dict"}')
    except GoMenuError as e:
        logger.warning(f'GoMenu cashier sync failed: {e}')
        sync_data = {}

    # Try stock logs for sales data
    try:
        date_str = target_date.strftime('%Y-%m-%d')
        stock_data = client.get_stock_logs(
            store_id,
            start_date=date_str,
            end_date=date_str,
            limit=500,
        )
        logger.info(f'GoMenu stock logs response keys: {stock_data.keys() if isinstance(stock_data, dict) else "not dict"}')
    except GoMenuError as e:
        logger.warning(f'GoMenu stock logs failed: {e}')
        stock_data = {}

    # Extract sales totals from available data
    pos_card = Decimal('0')
    pos_cash = Decimal('0')
    tab_count = 0
    synced = False

    # Parse sync_data if it contains sales info
    if isinstance(sync_data, dict):
        data_content = sync_data.get('data', {})
        if isinstance(data_content, dict):
            # Look for sales totals in various possible formats
            if 'card_total' in data_content:
                pos_card = Decimal(str(data_content['card_total']))
                synced = True
            if 'cash_total' in data_content:
                pos_cash = Decimal(str(data_content['cash_total']))
                synced = True
            if 'total_card' in data_content:
                pos_card = Decimal(str(data_content['total_card']))
                synced = True
            if 'total_cash' in data_content:
                pos_cash = Decimal(str(data_content['total_cash']))
                synced = True
            if 'tab_count' in data_content:
                tab_count = int(data_content['tab_count'])
            if 'order_count' in data_content:
                tab_count = int(data_content['order_count'])

            # Check for daily_sales or sales_summary objects
            sales = data_content.get('daily_sales', data_content.get('sales_summary', {}))
            if isinstance(sales, dict) and sales:
                if 'card' in sales:
                    pos_card = Decimal(str(sales['card']))
                    synced = True
                if 'cash' in sales:
                    pos_cash = Decimal(str(sales['cash']))
                    synced = True
                if 'count' in sales:
                    tab_count = int(sales['count'])

    # Parse stock logs for order info
    if isinstance(stock_data, dict) and not synced:
        logs = stock_data.get('data', {})
        if isinstance(logs, dict):
            log_list = logs.get('list', logs.get('items', []))
        elif isinstance(logs, list):
            log_list = logs
        else:
            log_list = []

        # Count unique orders from stock logs
        order_numbers = set()
        for log in log_list:
            if isinstance(log, dict):
                order_no = log.get('order_no', '')
                mark = log.get('mark_string', '')
                if order_no and 'sale' in mark.lower():
                    order_numbers.add(order_no)

        if order_numbers:
            tab_count = len(order_numbers)

    # Update DailyClosing if we got sales data
    org = integration.organization

    try:
        closing, created = DailyClosing.objects.get_or_create(
            organization=org,
            closing_date=target_date,
            defaults={
                'pos_card': pos_card,
                'pos_cash': pos_cash,
                'tab_count': tab_count,
                'status': 'DRAFT',
            }
        )

        if not created and closing.status == 'DRAFT':
            # Only update POS fields if still in DRAFT
            if synced:
                closing.pos_card = pos_card
                closing.pos_cash = pos_cash
            if tab_count:
                closing.tab_count = tab_count
            closing.save()

        return {
            'success': True,
            'date': str(target_date),
            'store_name': store_name,
            'store_id': store_id,
            'pos_card': str(pos_card),
            'pos_cash': str(pos_cash),
            'pos_total': str(pos_card + pos_cash),
            'tab_count': tab_count,
            'closing_id': closing.id,
            'closing_created': created,
            'data_synced': synced,
            'message': (
                f'Sales data synced for {target_date}'
                if synced
                else f'Connected to store "{store_name}". Sales endpoint response captured - check logs for details.'
            ),
        }

    except Exception as e:
        logger.exception('Error saving GoMenu sync data')
        return {
            'success': False,
            'error': f'Error saving data: {str(e)}',
        }
