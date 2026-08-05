from pathlib import Path
p = Path('public/app.js')
text = p.read_text(encoding='utf-8')
old = "}\n    showToast('Unable to start payment. Try again.');\n    console.error('Paystack init error:', err);\n  \n\n\nasync function recordEnquiry(productId, productName) {\n"
new = "}\n\nasync function recordEnquiry(productId, productName) {\n"
if old in text:
    p.write_text(text.replace(old, new), encoding='utf-8')
    print('patched')
else:
    print('not found')
