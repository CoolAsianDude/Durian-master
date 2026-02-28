from fpdf import FPDF
from io import BytesIO
from db import get_admin_analytics_data

def generate_receipt_pdf(items, total, transaction_id):
    pdf = FPDF()
    pdf.add_page()
    
    # Built-in Helvetica font
    pdf.set_font("helvetica", "B", 16)
    pdf.cell(0, 10, "Durian App Receipt", ln=True, align="C")
    pdf.ln(10)

    # Transaction info
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 10, f"Transaction ID: {transaction_id}", ln=True)
    pdf.ln(5)

    # Table header
    pdf.set_font("helvetica", "B", 12)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(90, 10, "Item", 1, 0, "C", True)
    pdf.cell(30, 10, "Qty", 1, 0, "C", True)
    pdf.cell(70, 10, "Total", 1, 1, "C", True)

    # Table rows
    pdf.set_font("helvetica", "", 12)
    for item in items:
        name = item.get("name", "Unknown Product")
        qty = item.get("quantity", 1)
        price = item.get("price", 0)
        pdf.cell(90, 10, f" {name}", 1)
        pdf.cell(30, 10, str(qty), 1, 0, "C")
        pdf.cell(70, 10, f"P{price * qty}", 1, 1, "R")

    pdf.ln(10)
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, f"Grand Total: P{total}", ln=True, align="R")

    # Output as bytes
    pdf_bytes = pdf.output(dest="S").encode("latin1")
    return pdf_bytes

def generate_admin_report_pdf():
    data = get_admin_analytics_data()  # returns dict with all admin analytics

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "Gen Analytics Report", ln=True, align="C")

    pdf.set_font("Arial", "", 12)
    pdf.ln(10)
    pdf.cell(0, 10, f"Total Users: {data['total_users']}", ln=True)
    pdf.cell(0, 10, f"Total Scans: {data['total_scans']}", ln=True)
    pdf.cell(0, 10, f"Durians Detected: {data['total_durians_detected']}", ln=True)
    pdf.cell(0, 10, f"Overall Success Rate: {data['overall_success_rate']}%", ln=True)
    pdf.cell(0, 10, f"User Growth: {data.get('user_growth_percent', 'N/A')}%", ln=True)
    pdf.cell(0, 10, f"Weekly Growth: {data.get('weekly_growth_percent', 'N/A')}%", ln=True)

    return pdf.output(dest='S').encode('latin1')  # returns PDF bytes

