"""
Import QT Account Ledger into CQ Transactions.
Run: docker exec fnb-ops-backend python /app/scripts/import_qt_ledger.py
"""
import os, sys, django
sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from decimal import Decimal
from datetime import date
from closing.models import CQTransaction
from users.models import Organization

# Use OneOps org for all QT entries
org = Organization.objects.get(id=3)  # OneOps (Admin)

PERSON = 'QT'
ACCT = 'CASH'

# Helper
def tx(dt, typ, amount, store='', note='', period=''):
    return {
        'date': dt, 'transaction_type': typ, 'amount': Decimal(str(amount)),
        'store_name': store, 'note': note, 'period': period,
    }

entries = []

# ============================================================
# 2024 Opening Balance
# ============================================================
entries.append(tx(date(2024, 1, 1), 'BALANCE', 21324.80, note='Opening Balance 2024', period='2024-Jan'))

# ============================================================
# 2024 H1 entries (before Nov-23 marker → roughly early-mid 2024)
# ============================================================
p1 = '2024-H1'
entries.append(tx(date(2024, 1, 15), 'EXPENSE', 300, note='사진', period=p1))
entries.append(tx(date(2024, 2, 1), 'TRANSFER', 54000, store='Q Airport', note='Q airport', period=p1))
entries.append(tx(date(2024, 2, 15), 'TRANSFER', 48450, store='5 Mile', note='5mile', period=p1))
entries.append(tx(date(2024, 3, 1), 'TRANSFER', 29400, store='Teppan', note='teppan', period=p1))
entries.append(tx(date(2024, 3, 15), 'TRANSFER', 25920, store='T1', note='T1', period=p1))
entries.append(tx(date(2024, 4, 1), 'TRANSFER', 22500, store='T2', note='T2', period=p1))
entries.append(tx(date(2024, 4, 15), 'TRANSFER', 3143, store='Mart', note='mart', period=p1))
entries.append(tx(date(2024, 5, 1), 'EXPENSE', 5820, note='마트 건강식품 환전 4757500원', period=p1))

# Nov-23 entries
entries.append(tx(date(2023, 11, 1), 'TRANSFER', 9485, store='Takanini', note='Takanini', period='2023-H2'))
entries.append(tx(date(2023, 11, 15), 'TRANSFER', 10800, store='Q Airport', note='serena 공항', period='2023-H2'))
entries.append(tx(date(2023, 11, 20), 'EXPENSE', 6250, note='국한', period='2023-H2'))
entries.append(tx(date(2023, 12, 1), 'EXPENSE', 8100, note='원정 치치 에어포트', period='2023-H2'))
entries.append(tx(date(2023, 12, 10), 'EXPENSE', 4370, note='지언 타카니니', period='2023-H2'))
entries.append(tx(date(2023, 12, 15), 'EXPENSE', 2660, note='원정타카니니', period='2023-H2'))

# 16.04.24
entries.append(tx(date(2024, 4, 16), 'EXPENSE', 80000, note='김사장님', period=p1))
entries.append(tx(date(2024, 4, 20), 'EXPENSE', 130000, note='김사장님', period=p1))

# ============================================================
# Oct-24 (2024 H2: Oct 2024 - Mar 2025)
# ============================================================
p2 = '2024-Oct'
entries.append(tx(date(2024, 10, 1), 'TRANSFER', 41040, store='Q Airport', note='Q airport', period=p2))
entries.append(tx(date(2024, 10, 2), 'TRANSFER', 45150, store='5 Mile', note='5mile', period=p2))
entries.append(tx(date(2024, 10, 3), 'TRANSFER', 29400, store='Teppan', note='teppan', period=p2))
entries.append(tx(date(2024, 10, 4), 'TRANSFER', 32760, store='T1', note='T1', period=p2))
entries.append(tx(date(2024, 10, 5), 'TRANSFER', 30690, store='T2', note='T2', period=p2))
entries.append(tx(date(2024, 10, 6), 'TRANSFER', 18900, store='Mart', note='mart', period=p2))
entries.append(tx(date(2024, 10, 7), 'TRANSFER', 6300, store='F Thai', note='F Thai', period=p2))
entries.append(tx(date(2024, 10, 8), 'TRANSFER', 93600, store='A Auckland', note='A Auckland', period=p2))
entries.append(tx(date(2024, 10, 9), 'TRANSFER', 17640, store='Takanini', note='Takanini', period=p2))
entries.append(tx(date(2024, 10, 10), 'TRANSFER', 8910, store='Mums', note='Mums 받아야함', period=p2))
entries.append(tx(date(2024, 10, 15), 'EXPENSE', 80000, note='김사장님', period=p2))
entries.append(tx(date(2024, 10, 20), 'EXPENSE', 6393.25, note='건강식품', period=p2))
entries.append(tx(date(2024, 10, 25), 'EXPENSE', 76950, note='김사장님 오클랜드 수령 총 액', period=p2))
entries.append(tx(date(2024, 10, 30), 'EXPENSE', 153000, note='김사장님', period=p2))

# ============================================================
# Apr-25 (2025 H1: Apr 2025 - Sep 2025)
# ============================================================
p3 = '2025-Apr'
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 51660, store='Q Airport', note='Q airport', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 53460, store='5 Mile', note='5mile', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 25800, store='Teppan', note='teppan', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 35910, store='T1', note='T1', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 41850, store='T2', note='T2', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 39960, store='Mart', note='mart', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 30681, store='F Thai', note='F Thai', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 131040, store='A Auckland', note='A Auckland', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 36000, store='Takanini', note='Takanini', period=p3))
entries.append(tx(date(2025, 4, 1), 'TRANSFER', 13770, store='Mums', note='Mums 받음', period=p3))
# A chch and Riverside: inflow = outflow (net zero, both columns have same amount)
entries.append(tx(date(2025, 4, 2), 'TRANSFER', 144280, store='A ChCh', note='A chch', period=p3))
entries.append(tx(date(2025, 4, 2), 'EXPENSE', 144280, note='A chch 지출', period=p3))
entries.append(tx(date(2025, 4, 2), 'TRANSFER', 53908, store='Riverside', note='Riverside', period=p3))
entries.append(tx(date(2025, 4, 2), 'EXPENSE', 53908, note='Riverside 지출', period=p3))
entries.append(tx(date(2025, 4, 3), 'TRANSFER', 57600, store='Manawa Bay', note='manawabay', period=p3))
entries.append(tx(date(2025, 4, 5), 'EXPENSE', 52600, note='지출', period=p3))
entries.append(tx(date(2025, 4, 6), 'EXPENSE', 20000, note='집 디포짓', period=p3))
entries.append(tx(date(2025, 4, 7), 'EXPENSE', 8173.95, note='건강식품', period=p3))
entries.append(tx(date(2025, 4, 10), 'EXPENSE', 100000, note='김사장님', period=p3))
entries.append(tx(date(2025, 4, 12), 'EXPENSE', 290000, note='용', period=p3))
entries.append(tx(date(2025, 4, 13), 'EXPENSE', 2000, note='은환 맥북', period=p3))
entries.append(tx(date(2025, 4, 15), 'EXPENSE', 80000, note='김사장님', period=p3))
entries.append(tx(date(2025, 4, 16), 'EXPENSE', 38650, note='김사장님 오클랜드 오클 공항 4월', period=p3))
entries.append(tx(date(2025, 4, 17), 'EXPENSE', 12700, note='김사장님 오클랜드 마나와 4월', period=p3))

# ============================================================
# Oct-25 onwards (2025 H2: Oct 2025 - Mar 2026)
# ============================================================
p4 = '2025-Oct'
entries.append(tx(date(2025, 10, 1), 'TRANSFER', 49675, store='Q Airport', note='Q airport', period=p4))
entries.append(tx(date(2025, 10, 2), 'TRANSFER', 42930, store='5 Mile', note='5mile', period=p4))
entries.append(tx(date(2025, 10, 3), 'TRANSFER', 24840, store='Teppan', note='teppan', period=p4))
entries.append(tx(date(2025, 10, 4), 'TRANSFER', 35595, store='T1', note='T1', period=p4))
entries.append(tx(date(2025, 10, 5), 'TRANSFER', 36340, store='T2', note='T2', period=p4))
entries.append(tx(date(2025, 10, 6), 'TRANSFER', 32400, store='Mart', note='mart', period=p4))
entries.append(tx(date(2025, 10, 7), 'TRANSFER', 31500, store='F Thai', note='F Thai', period=p4))
entries.append(tx(date(2025, 10, 8), 'TRANSFER', 135360, store='A Auckland', note='A Auckland', period=p4))
entries.append(tx(date(2025, 10, 9), 'TRANSFER', 28000, store='Takanini', note='Takanini', period=p4))
entries.append(tx(date(2025, 10, 10), 'TRANSFER', 11340, store='Mums', note='Mums 받아야함 3/11 받음', period=p4))
entries.append(tx(date(2025, 10, 11), 'TRANSFER', 10000, store='Dunedin', note='더니든 미란', period=p4))
entries.append(tx(date(2025, 10, 12), 'TRANSFER', 63347, store='Manawa Bay', note='manawabay', period=p4))
entries.append(tx(date(2025, 10, 13), 'TRANSFER', 22900, store='Frankton Thai', note='프랜크톤 타이 빛', period=p4))
entries.append(tx(date(2025, 10, 14), 'EXPENSE', 5000, note='퀸타 한인의 날', period=p4))
entries.append(tx(date(2025, 10, 15), 'EXPENSE', 32650, note='오클 공항 10월 김사장님 전달', period=p4))
entries.append(tx(date(2025, 10, 16), 'EXPENSE', 12850, note='마나와 10월 김사장님 전달', period=p4))
entries.append(tx(date(2025, 10, 17), 'EXPENSE', 160000, note='김사장님 전달 삼수 통해서', period=p4))
entries.append(tx(date(2025, 10, 18), 'EXPENSE', 20000, note='마포 종진/은환', period=p4))
entries.append(tx(date(2025, 10, 19), 'EXPENSE', 210000, note='용돈', period=p4))
entries.append(tx(date(2025, 10, 20), 'EXPENSE', 2000, note='마포 공사비 디포짓', period=p4))
entries.append(tx(date(2025, 10, 21), 'EXPENSE', 50000, note='13/10 김사장님 전달 오클에서', period=p4))
entries.append(tx(date(2025, 10, 22), 'TRANSFER', 2525, store='Manawa Bay', note='마나와 노트북', period=p4))
entries.append(tx(date(2025, 10, 23), 'EXPENSE', 4000, note='마트 건강 식품', period=p4))
entries.append(tx(date(2025, 10, 24), 'EXPENSE', 22570, note='용훈 나무 스카이 라이트', period=p4))
entries.append(tx(date(2025, 10, 25), 'EXPENSE', 4300, note='침대', period=p4))
entries.append(tx(date(2025, 10, 26), 'EXPENSE', 5248.40, note='가구', period=p4))
entries.append(tx(date(2025, 10, 27), 'EXPENSE', 6498, note='전자 기기', period=p4))
entries.append(tx(date(2025, 10, 28), 'EXPENSE', 442, note='블라인드 커튼 배송비', period=p4))
entries.append(tx(date(2025, 10, 29), 'EXPENSE', 3000, note='마포 공사', period=p4))
entries.append(tx(date(2025, 10, 30), 'EXPENSE', 441, note='메트리스 시트 셋', period=p4))
entries.append(tx(date(2025, 11, 1), 'EXPENSE', 5000, note='에어비앤비 처음 세팅 비용', period=p4))
entries.append(tx(date(2025, 11, 2), 'TRANSFER', 54560, store='Multiple', note='오클 지언 원정 하늘 혜진 - 김사장님이 지급', period=p4))
entries.append(tx(date(2025, 11, 3), 'EXPENSE', 20000, note='용훈 잭스추가 비용중 일부', period=p4))
entries.append(tx(date(2025, 11, 4), 'EXPENSE', 7724, note='$3862 3월 청소비', period=p4))
entries.append(tx(date(2025, 11, 5), 'EXPENSE', 22000, note='지언 오클 출장비', period=p4))
entries.append(tx(date(2025, 11, 6), 'EXPENSE', 53700, note='김사장님 오클 3월 18일', period=p4))
entries.append(tx(date(2025, 11, 7), 'EXPENSE', 270, note='에어비앤비 비용', period=p4))

# ============================================================
# Import
# ============================================================
print(f"Total entries to import: {len(entries)}")

created = 0
for e in entries:
    CQTransaction.objects.create(
        organization=org,
        date=e['date'],
        store_name=e['store_name'],
        transaction_type=e['transaction_type'],
        person=PERSON,
        amount=e['amount'],
        account_type=ACCT,
        note=e['note'],
        period=e['period'],
    )
    created += 1

print(f"Created {created} CQ Transactions for QT account")

# Verify running balance
qs = CQTransaction.objects.filter(person='QT').order_by('date', 'id')
INFLOW = ('COLLECTION', 'BALANCE', 'TRANSFER')
balance = Decimal('0')
for t in qs:
    if t.transaction_type in INFLOW:
        balance += t.amount
    else:
        balance -= t.amount
print(f"Final QT balance: ${balance:,.2f}")
