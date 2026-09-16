
import pdfplumber
import sys

def debug(file_path):
    with pdfplumber.open(file_path) as pdf:
        table = pdf.pages[0].extract_tables()[0]
        for row in table[2:]:
            print(row[0], row[1:5])

debug(r'C:\Users\ishan\.gemini\antigravity\brain\dc79928a-c441-4646-952c-320d1d31a3f5\.user_uploaded\media_1788441068405.png')

