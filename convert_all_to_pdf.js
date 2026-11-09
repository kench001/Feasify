const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { marked } = require("marked");

const docsDir = path.join(__dirname, "docs", "testing");
const pdfOutputDir = path.join(docsDir, "pdf");
const tempHtmlDir = path.join(docsDir, ".temp_html");

if (!fs.existsSync(pdfOutputDir)) {
  fs.mkdirSync(pdfOutputDir, { recursive: true });
}
if (!fs.existsSync(tempHtmlDir)) {
  fs.mkdirSync(tempHtmlDir, { recursive: true });
}

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browserExe = fs.existsSync(edgePath) ? edgePath : chromePath;

console.log("Using browser engine:", browserExe);

const mdFiles = fs
  .readdirSync(docsDir)
  .filter((file) => file.endsWith(".md") && !file.startsWith("."));

console.log(`Found ${mdFiles.length} Markdown files to convert to PDF.`);

const htmlTemplate = (title, content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 16mm 20mm 16mm;
      @bottom-right {
        content: counter(page);
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1f2937;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #122244;
      font-weight: 700;
      page-break-after: avoid;
    }
    h1 {
      font-size: 20pt;
      border-bottom: 2.5px solid #122244;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      font-size: 14pt;
      border-bottom: 1.5px solid #e5e7eb;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 10px;
    }
    h3 {
      font-size: 12pt;
      margin-top: 16px;
      margin-bottom: 8px;
    }
    p {
      margin-top: 0;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #122244;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) td {
      background-color: #f9fafb;
    }
    code {
      font-family: "Cascadia Code", "Fira Code", Consolas, Monaco, monospace;
      font-size: 9pt;
      background-color: #f3f4f6;
      color: #be123c;
      padding: 1.5px 4px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      font-size: 8.5pt;
      line-height: 1.45;
      overflow-x: auto;
      page-break-inside: avoid;
      margin: 12px 0;
    }
    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: inherit;
    }
    blockquote {
      margin: 14px 0;
      padding: 10px 14px;
      border-left: 4px solid #122244;
      background-color: #f8fafc;
      color: #334155;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    blockquote p:last-child {
      margin-bottom: 0;
    }
    hr {
      border: 0;
      height: 1px;
      background: #e5e7eb;
      margin: 20px 0;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 10px;
      padding-left: 22px;
    }
    li {
      margin-bottom: 4px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 8pt;
      font-weight: bold;
      border-radius: 4px;
    }
    .badge-pass { background: #dcfce7; color: #15803d; }
    .badge-fail { background: #fee2e2; color: #b91c1c; }
    .badge-crit { background: #fef2f2; color: #991b1b; border: 1px solid #f87171; }
    .footer {
      margin-top: 30px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      font-size: 8pt;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
    }
    .mermaid-box {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      margin: 12px 0;
      font-family: monospace;
      font-size: 8pt;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${content}
  <div class="footer">
    <span>Feasify Capstone Project Quality Assurance & System Audit Report</span>
    <span>Document Generated: November 10, 2026</span>
  </div>
</body>
</html>`;

for (const mdFile of mdFiles) {
  const baseName = path.parse(mdFile).name;
  const mdPath = path.join(docsDir, mdFile);
  const tempHtmlPath = path.join(tempHtmlDir, `${baseName}.html`);
  const outputPdfPath = path.join(pdfOutputDir, `${baseName}.pdf`);
  const rootPdfPath = path.join(docsDir, `${baseName}.pdf`);

  console.log(`Processing: ${mdFile}...`);

  const mdContent = fs.readFileSync(mdPath, "utf-8");
  
  // Format alerts nicely
  let processedMd = mdContent
    .replace(/> \[!NOTE\]/g, '> **NOTE:**')
    .replace(/> \[!WARNING\]/g, '> **WARNING:**')
    .replace(/> \[!CAUTION\]/g, '> **CAUTION:**')
    .replace(/> \[!IMPORTANT\]/g, '> **IMPORTANT:**')
    .replace(/> \[!TIP\]/g, '> **TIP:**');

  // Convert markdown to HTML
  const rawHtml = marked.parse(processedMd);
  const fullHtml = htmlTemplate(baseName, rawHtml);

  fs.writeFileSync(tempHtmlPath, fullHtml, "utf-8");

  // Construct absolute file:/// URL
  const fileUrl = "file:///" + tempHtmlPath.replace(/\\/g, "/");

  // Run headless browser to print PDF
  const cmd = `"${browserExe}" --headless --disable-gpu --allow-file-access-from-files --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "${fileUrl}"`;
  
  try {
    execSync(cmd, { stdio: "pipe", timeout: 25000 });
    // Also copy to docs/testing/ root for immediate access
    fs.copyFileSync(outputPdfPath, rootPdfPath);
    console.log(`  ✓ Successfully generated: ${baseName}.pdf`);
  } catch (err) {
    console.error(`  ✗ Failed converting ${baseName}:`, err.message);
  }
}

// Clean up temporary HTML files
try {
  const tempFiles = fs.readdirSync(tempHtmlDir);
  for (const f of tempFiles) {
    fs.unlinkSync(path.join(tempHtmlDir, f));
  }
  fs.rmdirSync(tempHtmlDir);
} catch (e) {
  // ignore
}

console.log("\nAll PDF conversions completed successfully!");
