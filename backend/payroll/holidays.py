"""
NZ Public Holiday Engine
- 11 national public holidays with Mondayisation
- Regional anniversary days
- Easter calculation (Anonymous Gregorian algorithm)
"""
from datetime import date, timedelta


def calculate_easter(year):
    """Calculate Easter Sunday using the Anonymous Gregorian algorithm."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def mondayise(holiday_date):
    """Apply NZ Mondayisation rules.

    If a public holiday falls on a Saturday → observed on the following Monday.
    If it falls on a Sunday → observed on the following Monday.

    Returns the observed date.
    """
    weekday = holiday_date.weekday()  # 0=Monday, 5=Saturday, 6=Sunday
    if weekday == 5:  # Saturday
        return holiday_date + timedelta(days=2)
    elif weekday == 6:  # Sunday
        return holiday_date + timedelta(days=1)
    return holiday_date


def mondayise_pair(day1_date, day2_date):
    """Apply Mondayisation for paired holidays (e.g., Christmas/Boxing Day, NY/Day after NY).

    If both fall on a weekend, they get mondayised to Monday and Tuesday.
    """
    day1_weekday = day1_date.weekday()
    day2_weekday = day2_date.weekday()

    if day1_weekday == 5:  # Day1=Saturday, Day2=Sunday
        return day1_date + timedelta(days=2), day2_date + timedelta(days=2)  # Mon, Tue
    elif day1_weekday == 6:  # Day1=Sunday, Day2=Monday
        return day1_date + timedelta(days=1), day2_date  # Mon, Mon(already)
    elif day1_weekday == 4:  # Day1=Friday, Day2=Saturday
        return day1_date, day2_date + timedelta(days=2)  # Fri, Mon

    return day1_date, day2_date


def closest_monday(target_date):
    """Find the Monday closest to the given date."""
    weekday = target_date.weekday()  # 0=Monday
    if weekday <= 3:  # Mon-Thu: go back to Monday
        return target_date - timedelta(days=weekday)
    else:  # Fri-Sun: go forward to Monday
        return target_date + timedelta(days=(7 - weekday))


# Matariki dates (officially gazetted — must be hardcoded)
MATARIKI_DATES = {
    2024: date(2024, 6, 28),
    2025: date(2025, 6, 20),
    2026: date(2026, 7, 10),
    2027: date(2027, 6, 25),
    2028: date(2028, 7, 14),
    2029: date(2029, 7, 6),
    2030: date(2030, 6, 21),
}


def get_national_holidays(year):
    """Generate 11 NZ national public holidays for a given year.

    Returns list of (actual_date, observed_date, name) tuples.
    """
    easter_sunday = calculate_easter(year)
    good_friday = easter_sunday - timedelta(days=2)
    easter_monday = easter_sunday + timedelta(days=1)

    # King's Birthday: 1st Monday in June
    june_1 = date(year, 6, 1)
    kings_birthday = june_1 + timedelta(days=(7 - june_1.weekday()) % 7)

    # Labour Day: 4th Monday in October
    oct_1 = date(year, 10, 1)
    first_monday = oct_1 + timedelta(days=(7 - oct_1.weekday()) % 7)
    labour_day = first_monday + timedelta(weeks=3)

    # Matariki
    matariki = MATARIKI_DATES.get(year)

    # New Year's Day and Day after New Year's Day (paired Mondayisation)
    ny_actual = date(year, 1, 1)
    ny2_actual = date(year, 1, 2)
    ny_observed, ny2_observed = mondayise_pair(ny_actual, ny2_actual)

    # Waitangi Day (Mondayisable since 2014)
    waitangi_actual = date(year, 2, 6)
    waitangi_observed = mondayise(waitangi_actual)

    # ANZAC Day (Mondayisable since 2015)
    anzac_actual = date(year, 4, 25)
    anzac_observed = mondayise(anzac_actual)

    # Christmas Day and Boxing Day (paired Mondayisation)
    xmas_actual = date(year, 12, 25)
    boxing_actual = date(year, 12, 26)
    xmas_observed, boxing_observed = mondayise_pair(xmas_actual, boxing_actual)

    holidays = [
        (ny_actual, ny_observed, "New Year's Day"),
        (ny2_actual, ny2_observed, "Day after New Year's Day"),
        (waitangi_actual, waitangi_observed, "Waitangi Day"),
        (good_friday, good_friday, "Good Friday"),
        (easter_monday, easter_monday, "Easter Monday"),
        (anzac_actual, anzac_observed, "ANZAC Day"),
        (kings_birthday, kings_birthday, "King's Birthday"),
        (labour_day, labour_day, "Labour Day"),
        (xmas_actual, xmas_observed, "Christmas Day"),
        (boxing_actual, boxing_observed, "Boxing Day"),
    ]

    if matariki:
        holidays.append((matariki, matariki, "Matariki"))

    return holidays


def get_regional_anniversary(region, year):
    """Calculate regional anniversary day for a given NZ region.

    Returns (actual_date, observed_date, name) or None.

    Regional anniversaries are based on historical provincial boundaries.
    """
    easter_sunday = calculate_easter(year)

    # Map regions to their anniversary calculations
    if region in ('AUCKLAND', 'NORTHLAND', 'WAIKATO', 'BAY_OF_PLENTY', 'GISBORNE'):
        # Auckland Anniversary: Monday closest to January 29
        actual = date(year, 1, 29)
        observed = closest_monday(actual)
        return (actual, observed, "Auckland Anniversary Day")

    elif region == 'WELLINGTON':
        # Wellington Anniversary: Monday closest to January 22
        actual = date(year, 1, 22)
        observed = closest_monday(actual)
        return (actual, observed, "Wellington Anniversary Day")

    elif region == 'CANTERBURY':
        # Canterbury: Second Friday after first Tuesday in November
        # (Also Christchurch Show Day)
        nov_1 = date(year, 11, 1)
        # Find first Tuesday in November
        days_to_tuesday = (1 - nov_1.weekday()) % 7  # Tuesday = 1
        first_tuesday = nov_1 + timedelta(days=days_to_tuesday)
        # Second Friday after that
        days_to_friday = (4 - first_tuesday.weekday()) % 7 or 7
        first_friday = first_tuesday + timedelta(days=days_to_friday)
        second_friday = first_friday + timedelta(weeks=1)
        return (second_friday, second_friday, "Canterbury Anniversary Day")

    elif region == 'OTAGO':
        # Otago Anniversary: Monday closest to March 23
        actual = date(year, 3, 23)
        observed = closest_monday(actual)
        return (actual, observed, "Otago Anniversary Day")

    elif region == 'SOUTHLAND':
        # Southland Anniversary: Easter Tuesday
        easter_tuesday = easter_sunday + timedelta(days=2)
        return (easter_tuesday, easter_tuesday, "Southland Anniversary Day")

    elif region == 'TARANAKI':
        # Taranaki Anniversary: Second Monday in March
        mar_1 = date(year, 3, 1)
        days_to_monday = (7 - mar_1.weekday()) % 7
        first_monday = mar_1 + timedelta(days=days_to_monday)
        second_monday = first_monday + timedelta(weeks=1)
        return (second_monday, second_monday, "Taranaki Anniversary Day")

    elif region == 'HAWKES_BAY':
        # Hawke's Bay Anniversary: Friday before Labour Day
        oct_1 = date(year, 10, 1)
        first_monday = oct_1 + timedelta(days=(7 - oct_1.weekday()) % 7)
        labour_day = first_monday + timedelta(weeks=3)
        hawkes_bay = labour_day - timedelta(days=3)  # Friday before
        return (hawkes_bay, hawkes_bay, "Hawke's Bay Anniversary Day")

    elif region in ('MANAWATU_WHANGANUI',):
        # Wellington Anniversary applies (Wellington Province)
        actual = date(year, 1, 22)
        observed = closest_monday(actual)
        return (actual, observed, "Wellington Anniversary Day")

    elif region == 'NELSON':
        # Nelson Anniversary: Monday closest to February 1
        actual = date(year, 2, 1)
        observed = closest_monday(actual)
        return (actual, observed, "Nelson Anniversary Day")

    elif region == 'MARLBOROUGH':
        # Marlborough Anniversary: Monday closest to November 1
        actual = date(year, 11, 1)
        observed = closest_monday(actual)
        return (actual, observed, "Marlborough Anniversary Day")

    elif region == 'WEST_COAST':
        # West Coast Anniversary: Monday closest to December 1
        actual = date(year, 12, 1)
        observed = closest_monday(actual)
        return (actual, observed, "Westland Anniversary Day")

    elif region == 'CHATHAM_ISLANDS':
        # Chatham Islands Anniversary: Monday closest to November 30
        actual = date(year, 11, 30)
        observed = closest_monday(actual)
        return (actual, observed, "Chatham Islands Anniversary Day")

    return None


def generate_public_holidays(year, region=None):
    """Generate all public holidays for a year, including regional anniversary.

    Args:
        year: Year to generate holidays for
        region: NZ region code (e.g., 'AUCKLAND', 'WELLINGTON')

    Returns:
        List of dicts with keys: date, observed_date, name, is_national, region
    """
    holidays = []

    # National holidays
    for actual, observed, name in get_national_holidays(year):
        holidays.append({
            'date': actual,
            'observed_date': observed,
            'name': name,
            'is_national': True,
            'region': None,
            'year': year,
        })

    # Regional anniversary
    if region:
        result = get_regional_anniversary(region, year)
        if result:
            actual, observed, name = result
            holidays.append({
                'date': actual,
                'observed_date': observed,
                'name': name,
                'is_national': False,
                'region': region,
                'year': year,
            })

    return holidays


def is_public_holiday(check_date, region=None):
    """Check if a date is a public holiday (observed date).

    Args:
        check_date: Date to check
        region: NZ region code

    Returns:
        Holiday name if it's a holiday, None otherwise.
    """
    holidays = generate_public_holidays(check_date.year, region)
    for h in holidays:
        if h['observed_date'] == check_date:
            return h['name']
    return None
