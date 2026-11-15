// Builds real PDF and DOCX files in memory for the parser tests.

import JSZip from "jszip"

const escapePdf = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)

/**
 * A valid one-page PDF. With `lines` it has a text layer in Helvetica; with
 * none it is image-free and text-free, like a scan without a text layer.
 */
export function makePdf(lines: string[]): Uint8Array {
  const content = lines.length
    ? [
        "BT /F1 11 Tf 50 750 Td 14 TL",
        ...lines.map((l) => `(${escapePdf(l)}) Tj T*`),
        "ET",
      ].join("\n")
    : ""
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const R =
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

const paragraph = (text: string, bullet = false) =>
  bullet
    ? `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
    : `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`

/** A minimal Word document; `- ` lines become list items. */
export async function makeDocx(
  lines: string[],
  { header }: { header?: string } = {}
): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
${header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ""}
</Types>`
  )
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
${header ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : ""}
</Relationships>`
  )
  zip.file(
    "word/numbering.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering ${W}>
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`
  )
  if (header) {
    zip.file(
      "word/header1.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:hdr ${W}>${paragraph(header)}</w:hdr>`
    )
  }
  const body = lines
    .map((l) =>
      l.startsWith("- ") ? paragraph(l.slice(2), true) : paragraph(l)
    )
    .join("")
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document ${W} ${R}><w:body>${body}${header ? '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/></w:sectPr>' : ""}</w:body></w:document>`
  )
  return await zip.generateAsync({ type: "uint8array" })
}

export const RESUME_LINES = [
  "Aanya Kulkarni",
  "B.Tech Computer Engineering, Pune University, 2026",
  "Projects",
  "Course planner: built in React and TypeScript, used by 400 students.",
  "Designed the PostgreSQL schema and a REST API in Node.js with Docker.",
  "Skills: React, TypeScript, Node.js, PostgreSQL, Docker, Git",
]
