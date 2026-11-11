import os
import sys
import re
import subprocess
import html

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DOCS_DIR = os.path.abspath(r"C:\Users\CJ Baldonado\Documents\GitHub\New folder\Feasify\docs\testing")
PDF_DIR = os.path.join(DOCS_DIR, "pdf")
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

os.makedirs(PDF_DIR, exist_ok=True)

CSS_STYLES = """
@page {
    size: A4;
    margin: 18mm 18mm 20mm 18mm;
    @bottom-right {
        content: counter(page);
    }
}
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: #1e293b;
    background: #ffffff;
    margin: 0;
    padding: 0;
}
h1, h2, h3, h4 {
    color: #0f172a;
    font-weight: 700;
    margin-top: 1.4em;
    margin-bottom: 0.5em;
    page-break-after: avoid;
}
h1 {
    font-size: 18pt;
    border-bottom: 2.5px solid #1e3a8a;
    padding-bottom: 6px;
    color: #1e3a8a;
    margin-top: 0;
}
h2 {
    font-size: 13pt;
    border-bottom: 1.5px solid #cbd5e1;
    padding-bottom: 4px;
    color: #1e293b;
}
h3 {
    font-size: 11pt;
    color: #334155;
}
h4 {
    font-size: 10pt;
    color: #475569;
}
p {
    margin: 0.6em 0;
}
hr {
    border: 0;
    border-top: 1px solid #e2e8f0;
    margin: 1.2em 0;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 8.5pt;
    page-break-inside: auto;
}
tr {
    page-break-inside: avoid;
    page-break-after: auto;
}
thead tr {
    background-color: #1e3a8a !important;
    color: #ffffff !important;
    font-weight: 700;
    text-align: left;
}
th {
    padding: 7px 8px;
    border: 1px solid #1e3a8a;
    color: #ffffff;
}
td {
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
}
tbody tr:nth-child(even) {
    background-color: #f8fafc;
}
code {
    font-family: Consolas, "Liberation Mono", Courier, monospace;
    font-size: 8.5pt;
    background-color: #f1f5f9;
    color: #0f172a;
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
}
pre {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 10px 14px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 8pt;
    line-height: 1.45;
    margin: 0.8em 0;
    page-break-inside: avoid;
}
pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    border: none;
}
ul, ol {
    margin: 0.5em 0;
    padding-left: 22px;
}
li {
    margin: 0.3em 0;
}
blockquote {
    border-left: 4px solid #3b82f6;
    margin: 1em 0;
    padding: 6px 14px;
    background-color: #eff6ff;
    color: #1e3a8a;
    border-radius: 0 6px 6px 0;
}
.badge-pass {
    display: inline-block;
    padding: 2px 6px;
    background-color: #dcfce7;
    color: #15803d;
    font-weight: bold;
    border-radius: 4px;
    font-size: 8pt;
}
.badge-fail {
    display: inline-block;
    padding: 2px 6px;
    background-color: #fee2e2;
    color: #b91c1c;
    font-weight: bold;
    border-radius: 4px;
    font-size: 8pt;
}
.page-break {
    page-break-after: always;
}
.header-box {
    background: linear-gradient(135deg, #0f172a, #1e3a8a);
    color: #ffffff;
    padding: 14px 18px;
    border-radius: 8px;
    margin-bottom: 20px;
}
.header-box h1 {
    color: #ffffff;
    border-bottom: 2px solid #38bdf8;
    margin: 0 0 6px 0;
    padding-bottom: 4px;
}
.header-box p {
    margin: 2px 0;
    font-size: 9pt;
    color: #cbd5e1;
}
"""

def inline_formatting(text):
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    # Format status badges
    text = text.replace('**Passed**', '<span class="badge-pass">Passed</span>')
    text = text.replace('**Failed**', '<span class="badge-fail">Failed</span>')
    text = text.replace('&quot;Passed&quot;', '<span class="badge-pass">Passed</span>')
    text = text.replace('&quot;Failed&quot;', '<span class="badge-fail">Failed</span>')
    return text

def md_to_html(md_content, title="Feasify QA Report"):
    lines = md_content.split('\n')
    html_out = []
    in_code_block = False
    code_lang = ""
    code_lines = []
    in_table = False
    table_header = True
    in_list = False
    list_type = "ul"

    for line in lines:
        stripped = line.strip()

        # Handle Code Block Fences
        if stripped.startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_lang = stripped[3:].strip()
                code_lines = []
            else:
                in_code_block = False
                escaped_code = html.escape('\n'.join(code_lines))
                html_out.append(f'<pre><code class="language-{code_lang}">{escaped_code}</code></pre>')
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        # Handle Tables
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.split("|")[1:-1]]
            # Check if this is a separator line (e.g. |---|---|)
            if all(re.match(r'^:?-+:?$', c) for c in cells if c):
                continue

            if not in_table:
                if in_list:
                    html_out.append(f'</{list_type}>')
                    in_list = False
                in_table = True
                table_header = True
                html_out.append('<table>')

            if table_header:
                html_out.append('<thead><tr>')
                for c in cells:
                    html_out.append(f'<th>{inline_formatting(c)}</th>')
                html_out.append('</tr></thead><tbody>')
                table_header = False
            else:
                html_out.append('<tr>')
                for c in cells:
                    html_out.append(f'<td>{inline_formatting(c)}</td>')
                html_out.append('</tr>')
            continue
        elif in_table:
            html_out.append('</tbody></table>')
            in_table = False

        # Handle Empty Lines
        if not stripped:
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            continue

        # Handle Headers
        m_h1 = re.match(r'^#\s+(.+)$', line)
        if m_h1:
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            html_out.append(f'<h1>{inline_formatting(m_h1.group(1))}</h1>')
            continue

        m_h2 = re.match(r'^##\s+(.+)$', line)
        if m_h2:
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            html_out.append(f'<h2>{inline_formatting(m_h2.group(1))}</h2>')
            continue

        m_h3 = re.match(r'^###\s+(.+)$', line)
        if m_h3:
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            html_out.append(f'<h3>{inline_formatting(m_h3.group(1))}</h3>')
            continue

        m_h4 = re.match(r'^####\s+(.+)$', line)
        if m_h4:
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            html_out.append(f'<h4>{inline_formatting(m_h4.group(1))}</h4>')
            continue

        # Handle Horizontal Rule
        if re.match(r'^-{3,}$', stripped) or re.match(r'^\*{3,}$', stripped):
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            html_out.append('<hr/>')
            continue

        # Handle Lists
        m_ul = re.match(r'^[-*]\s+(.+)$', stripped)
        if m_ul:
            if not in_list or list_type != "ul":
                if in_list: html_out.append(f'</{list_type}>')
                in_list = True
                list_type = "ul"
                html_out.append('<ul>')
            html_out.append(f'<li>{inline_formatting(m_ul.group(1))}</li>')
            continue

        m_ol = re.match(r'^\d+\.\s+(.+)$', stripped)
        if m_ol:
            if not in_list or list_type != "ol":
                if in_list: html_out.append(f'</{list_type}>')
                in_list = True
                list_type = "ol"
                html_out.append('<ol>')
            html_out.append(f'<li>{inline_formatting(m_ol.group(1))}</li>')
            continue

        # Handle Blockquotes
        if stripped.startswith(">"):
            if in_list:
                html_out.append(f'</{list_type}>')
                in_list = False
            bq_content = stripped.lstrip("> ").strip()
            html_out.append(f'<blockquote>{inline_formatting(bq_content)}</blockquote>')
            continue

        # Normal Paragraph
        if in_list:
            html_out.append(f'</{list_type}>')
            in_list = False
        html_out.append(f'<p>{inline_formatting(stripped)}</p>')

    if in_table:
        html_out.append('</tbody></table>')
    if in_list:
        html_out.append(f'</{list_type}>')

    body_html = '\n'.join(html_out)
    full_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>{html.escape(title)}</title>
<style>
{CSS_STYLES}
</style>
</head>
<body>
{body_html}
</body>
</html>"""
    return full_doc

def convert_file(md_path, pdf_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    base_name = os.path.splitext(os.path.basename(md_path))[0]
    title = base_name.replace("_", " ").title()
    html_content = md_to_html(md_text, title=f"Feasify - {title}")

    temp_html = pdf_path.replace(".pdf", ".temp.html")
    with open(temp_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    cmd = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        temp_html
    ]

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if os.path.exists(temp_html):
        os.remove(temp_html)
    
    if result.returncode == 0 and os.path.exists(pdf_path):
        size_kb = os.path.getsize(pdf_path) / 1024
        print(f"  [OK] PDF Generated: {os.path.basename(pdf_path)} ({size_kb:.1f} KB)")
        return True
    else:
        print(f"  [FAIL] PDF Failed: {os.path.basename(pdf_path)}")
        return False

def main():
    print("=================================================================")
    print("  FEASIFY QA DOCUMENTATION - BATCH PDF GENERATION")
    print("=================================================================\n")

    md_files = [
        "01_System_Analysis.md",
        "02_Software_Test_Plan.md",
        "03_Functional_Test_Cases.md",
        "04_Integration_Test_Report.md",
        "05_Database_Test_Report.md",
        "06_UI_UX_Test_Report.md",
        "07_API_Test_Report.md",
        "08_Security_Assessment.md",
        "09_Performance_Stress_Test.md",
        "10_Bug_And_Issue_Registry.md",
        "11_Test_Execution_Summary.md",
        "12_Final_QA_Report.md"
    ]

    generated_count = 0
    all_combined_md = []

    for fname in md_files:
        md_path = os.path.join(DOCS_DIR, fname)
        if not os.path.exists(md_path):
            print(f"  ⚠️ Missing: {fname}")
            continue

        pdf_name = fname.replace(".md", ".pdf")
        pdf_path = os.path.join(PDF_DIR, pdf_name)
        if convert_file(md_path, pdf_path):
            generated_count += 1

        # Also collect for master document
        with open(md_path, 'r', encoding='utf-8') as f:
            all_combined_md.append(f.read())
            all_combined_md.append("\n\n<div class=\"page-break\"></div>\n\n")

    # Generate Unified Consolidated Master PDF
    print("\n--- Generating Consolidated Master QA Package PDF ---")
    master_md = "\n".join(all_combined_md)
    master_pdf_path = os.path.join(DOCS_DIR, "Feasify_Complete_QA_Documentation_Package.pdf")
    temp_master_html = os.path.join(DOCS_DIR, "master_temp.html")
    
    master_html = md_to_html(master_md, title="Feasify - Complete QA & System Testing Documentation Package")
    with open(temp_master_html, 'w', encoding='utf-8') as f:
        f.write(master_html)

    cmd = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={master_pdf_path}",
        temp_master_html
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if os.path.exists(temp_master_html):
        os.remove(temp_master_html)

    if res.returncode == 0 and os.path.exists(master_pdf_path):
        size_kb = os.path.getsize(master_pdf_path) / 1024
        print(f"  [OK] [MASTER PDF GENERATED] Feasify_Complete_QA_Documentation_Package.pdf ({size_kb:.1f} KB)")
        generated_count += 1

    print("\n=================================================================")
    print(f"SUMMARY: {generated_count} PDF Documents Successfully Created!")
    print(f"Output Directory: {PDF_DIR}")
    print(f"Master Document: {master_pdf_path}")
    print("=================================================================")

if __name__ == "__main__":
    main()
