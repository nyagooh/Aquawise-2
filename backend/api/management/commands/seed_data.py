"""Populate the database with initial data matching the frontend mock data."""
import math
import random
from datetime import datetime, timedelta, timezone

from django.core.management.base import BaseCommand
from django.utils import timezone as dj_timezone

from api.models import (
    Alert, ForecastDay, Region, RegionPrediction,
    SensorParameter, TimeSeriesReading, WaterSource,
)


class Command(BaseCommand):
    help = 'Seed the database with initial Aquawise data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding data…')

        # ── Regions ────────────────────────────────────────────────────────
        regions_data = [
            ('r1', 'Dunga',    'Lake Victoria — Dunga Beach'),
            ('r2', 'Ahero',    'Nyando River & Irrigation Canals'),
            ('r3', 'Nyalenda', 'Nyalenda Wetland & Streams'),
            ('r4', 'Kibos',    'Kibos River'),
            ('r5', 'Kondele',  'Kondele Municipal Water Points'),
        ]
        regions = {}
        for rid, name, water_body in regions_data:
            r, _ = Region.objects.update_or_create(
                region_id=rid, defaults={'name': name, 'water_body': water_body}
            )
            regions[rid] = r

        # ── Water sources ──────────────────────────────────────────────────
        sources_data = [
            ('ws1', 'Dunga Beach Station',    'r1', 'safe'),
            ('ws2', 'Ahero Irrigation Canal', 'r2', 'warning'),
            ('ws3', 'Nyalenda Wetland',       'r3', 'danger'),
            ('ws4', 'Kibos River Point',      'r4', 'safe'),
            ('ws5', 'Kondele Water Point',    'r5', 'safe'),
        ]
        for sid, name, rid, risk in sources_data:
            WaterSource.objects.update_or_create(
                source_id=sid,
                defaults={'name': name, 'region': regions[rid], 'risk': risk},
            )

        # ── 24-hour time series ────────────────────────────────────────────
        TimeSeriesReading.objects.all().delete()
        now = datetime.now(tz=timezone.utc)
        random.seed(42)
        for i in range(23, -1, -1):
            t = now - timedelta(hours=i)
            hour = t.hour
            temp_base = 24 + 4 * math.sin((hour - 6) * math.pi / 12)
            turb_base = 3.2 + (2.5 if 6 <= hour <= 10 else 0) + random.random() * 0.8
            TimeSeriesReading.objects.create(
                timestamp=t,
                temperature=round(temp_base + (random.random() - 0.5) * 0.6, 1),
                turbidity=round(turb_base + (random.random() - 0.5) * 0.5, 2),
                ph=round(7.2 + (random.random() - 0.5) * 0.4, 2),
                dissolved_oxygen=round(7.8 + (random.random() - 0.5) * 0.6, 2),
                conductivity=round(410 + (random.random() - 0.5) * 30),
                nitrates=round(4.2 + (random.random() - 0.5) * 1.2, 2),
            )

        # ── Current sensor readings (use last time-series point) ──────────
        latest = TimeSeriesReading.objects.last()
        params = [
            ('temperature',      'Temperature',       latest.temperature,      '°C',    15,   30,   True,  'High temps reduce oxygen and encourage bacteria growth.'),
            ('turbidity',        'Turbidity',         latest.turbidity,        'NTU',   0,    5,    True,  'Measures water cloudiness. Higher = more particles.'),
            ('ph',               'pH Level',          latest.ph,               'pH',    6.5,  8.5,  False, 'Acidity balance. Unsafe pH harms humans and aquatic life.'),
            ('dissolved_oxygen', 'Dissolved Oxygen',  latest.dissolved_oxygen, 'mg/L',  6,    14,   False, 'Low dissolved oxygen signals pollution or algae bloom.'),
            ('conductivity',     'Conductivity',      latest.conductivity,     'µS/cm', 200,  800,  False, 'Dissolved salts/minerals. Spikes may indicate runoff.'),
            ('nitrates',         'Nitrates',          latest.nitrates,         'mg/L',  0,    10,   False, 'Nutrients from fertiliser. High levels cause algae blooms.'),
        ]
        for pid, name, value, unit, smin, smax, is_real, desc in params:
            SensorParameter.objects.update_or_create(
                param_id=pid,
                defaults={
                    'name': name, 'value': value, 'unit': unit,
                    'safe_min': smin, 'safe_max': smax,
                    'is_real': is_real, 'description': desc,
                },
            )

        # ── Alerts ─────────────────────────────────────────────────────────
        alerts_data = [
            ('a1', '08:42 AM',  'Nyalenda Wetland',       'r3', 'Turbidity',     '8.7 NTU',   'danger',  'Boil water advisory issued for Nyalenda'),
            ('a2', '07:15 AM',  'Ahero Irrigation Canal', 'r2', 'Nitrates',      '11.2 mg/L', 'warning', 'Increased monitoring at Ahero canal'),
            ('a3', '06:30 AM',  'Kibos River Point',      'r4', 'pH Level',      '8.8 pH',    'warning', 'Treatment chemicals adjusted at Kibos'),
            ('a4', 'Yesterday', 'Dunga Beach Station',    'r1', 'Temperature',   '31.2 °C',   'warning', 'Resolved — temperature normalised at Dunga'),
            ('a5', 'Yesterday', 'Nyalenda Wetland',       'r3', 'E. coli (Sim)', 'Detected',  'danger',  'Source isolated, samples sent to KIWASCO lab'),
        ]
        for aid, time_label, source, rid, param, value, risk, action in alerts_data:
            Alert.objects.update_or_create(
                alert_id=aid,
                defaults={
                    'time_label': time_label, 'source': source,
                    'region': regions[rid], 'parameter': param,
                    'value': value, 'risk': risk, 'action': action,
                },
            )

        # ── Regional predictions ───────────────────────────────────────────
        preds_data = [
            ('r1', 18, 'safe',    'stable',  8,  'None',
             'Lake water quality at Dunga Beach expected to remain stable. No significant contamination risk over the next 7 days.',
             [('Mon',15),('Tue',18),('Wed',14),('Thu',20),('Fri',16),('Sat',19),('Sun',17)]),
            ('r2', 42, 'warning', 'rising',  35, 'Turbidity',
             'Rising turbidity expected from agricultural runoff through Ahero irrigation channels during the current planting season.',
             [('Mon',38),('Tue',42),('Wed',48),('Thu',52),('Fri',45),('Sat',40),('Sun',38)]),
            ('r3', 61, 'danger',  'rising',  72, 'E. coli & Nitrates',
             'High contamination risk from informal settlement waste entering wetland streams. E. coli levels above safe thresholds.',
             [('Mon',55),('Tue',61),('Wed',68),('Thu',70),('Fri',65),('Sat',58),('Sun',54)]),
            ('r4', 22, 'safe',    'falling', 5,  'None',
             'Kibos River conditions are favourable. Industrial discharge from sugar factories within acceptable limits.',
             [('Mon',25),('Tue',22),('Wed',20),('Thu',18),('Fri',15),('Sat',16),('Sun',14)]),
            ('r5', 31, 'warning', 'stable',  22, 'pH Level',
             'Moderate pH fluctuations detected at Kondele water points. Pipe corrosion under investigation by KIWASCO.',
             [('Mon',28),('Tue',31),('Wed',33),('Thu',30),('Fri',29),('Sat',32),('Sun',30)]),
        ]
        for rid, score, level, next_risk, prob, concern, text, forecast in preds_data:
            pred, _ = RegionPrediction.objects.update_or_create(
                region=regions[rid],
                defaults={
                    'risk_score': score, 'risk_level': level,
                    'prediction_text': text, 'next_risk': next_risk,
                    'contamination_probability': prob, 'top_concern': concern,
                },
            )
            pred.forecast_days.all().delete()
            for order, (day, score_val) in enumerate(forecast):
                ForecastDay.objects.create(prediction=pred, day=day, score=score_val, order=order)

        self.stdout.write(self.style.SUCCESS('Done. Database seeded successfully.'))
