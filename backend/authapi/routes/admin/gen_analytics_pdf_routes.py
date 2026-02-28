# backend/admin/gen_analytics_pdf_routes.py
import pdfkit
from flask import Blueprint, render_template, make_response, jsonify
import requests
from datetime import datetime
import io
import base64
import matplotlib
import matplotlib.pyplot as plt
import pandas as pd

matplotlib.use('Agg')

# Blueprint
gen_analytics_pdf_bp = Blueprint("gen_analytics_pdf", __name__)

# Path to wkhtmltopdf
PATH_WKHTMLTOPDF = r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
config = pdfkit.configuration(wkhtmltopdf=PATH_WKHTMLTOPDF)

# -----------------------------
# Helper: Encode matplotlib figure as base64
# -----------------------------
def safe_encode_plot(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=120, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode('utf-8')

# -----------------------------
# Weekly Scans Bar Chart
# -----------------------------
def generate_weekly_chart(daily_scans):
    if not daily_scans:
        return None
    try:
        days = [d['day'] for d in daily_scans]
        counts = [d.get('scans', 0) for d in daily_scans]
        colors = ['#27AE60', '#2ecc71', '#1abc9c', '#16a085', '#3498db', '#9b59b6', '#e67e22']

        fig, ax = plt.subplots(figsize=(8, 3))
        bars = ax.bar(days, counts)
        for i, bar in enumerate(bars):
            bar.set_color(colors[i % len(colors)])

        ax.set_title('Weekly Scan Activity', fontsize=13, fontweight='bold')
        ax.set_ylabel('Scans')
        ax.set_xlabel('Day')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.grid(axis='y', linestyle='--', alpha=0.3)
        plt.tight_layout()
        return safe_encode_plot(fig)
    except Exception as e:
        print(f"Weekly Chart Error: {e}")
        return None

# -----------------------------
# Scan Success Pie Chart
# -----------------------------
def generate_success_pie_chart(stats):
    if not stats or 'scan_success_breakdown' not in stats:
        return None
    try:
        data = stats['scan_success_breakdown']
        sizes = [data.get('successful', 0), data.get('rejected', 0)]
        labels = ['Successful', 'Rejected']
        colors = ['#10B981', '#EF4444']

        fig, ax = plt.subplots(figsize=(5, 4))
        ax.pie(sizes, labels=labels, autopct=lambda p: f'{p:.1f}%' if p > 0 else '', startangle=140, colors=colors, pctdistance=0.8)
        centre_circle = plt.Circle((0, 0), 0.65, fc='white')
        ax.add_artist(centre_circle)
        ax.set_title('Scan Success Breakdown', fontsize=13, fontweight='bold')
        ax.axis('equal')
        plt.tight_layout()
        return safe_encode_plot(fig)
    except Exception as e:
        print(f"Pie Chart Error: {e}")
        return None

# -----------------------------
# Main PDF route
# -----------------------------
@gen_analytics_pdf_bp.route("/admin/GenAnalytics/pdf")
def download_admin_analytics_pdf():
    # Fetch admin analytics from your backend API
    analytics_url = "http://localhost:8000/admin/GenAnalytics"  # Adjust if needed

    try:
        response = requests.get(analytics_url)
        data = response.json()
    except Exception as e:
        print(f"Fetch analytics error: {e}")
        return jsonify({"error": "Failed to fetch analytics", "success": False}), 500

    if not data.get("success"):
        return jsonify({"error": data.get("error", "Failed to fetch analytics"), "success": False}), 400

    stats = data.get("stats", {})
    daily_scans = stats.get("daily_scans", [])

    report_data = {
        "generated_at": datetime.now().strftime('%m/%d/%Y, %I:%M %p'),
        "stats": stats,
        "weekly_chart": generate_weekly_chart(daily_scans),
        "success_pie": generate_success_pie_chart(stats)
    }

    html = render_template('gen_admin_analytics_template.html', data=report_data)

    options = {
        'page-size': 'A4',
        'encoding': "UTF-8",
        'enable-local-file-access': None
    }

    pdf = pdfkit.from_string(html, False, configuration=config, options=options)

    response = make_response(pdf)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=gen_admin_analytics.pdf'

    return response