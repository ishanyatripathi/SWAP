
import pdfplumber

def test(file_path):
    with pdfplumber.open(file_path) as pdf:
        if not pdf.pages: return
        tables = pdf.pages[0].extract_tables()
        if tables:
            for row in tables[0][2:7]:
                print(row[0], [str(c).replace('\n', ' ') for c in row[1:5]])

test(r'C:\Users\ishan\.gemini\antigravity\brain\dc79928a-c441-4646-952c-320d1d31a3f5\.user_uploaded\media_1788437989372.pdf')

