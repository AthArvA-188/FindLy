from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
p = canvas.Canvas("tmp_sample/two_page.pdf", pagesize=letter)
p.drawString(100, 700, "This is page 1. unique-token: ml10-unicorn-1")
p.showPage()
p.drawString(100, 700, "This is page 2. unique-token: ml10-unicorn-2")
p.save()
print("Wrote tmp_sample/two_page.pdf")
