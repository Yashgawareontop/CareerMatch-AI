import { beforeEach, describe, expect, test, vi } from "vitest"

import { makeDocx, makePdf, RESUME_LINES } from "@/tests/fixtures/resumes"

// The OCR fallback is the only AI call in parsing; stub the provider.
const ocr = vi.hoisted(() => ({
  provider: null as null | { generateText: ReturnType<typeof vi.fn> },
}))
vi.mock("@/lib/ai", () => ({ getFileCapableProvider: () => ocr.provider }))

const { parseResume, detectResumeType, ResumeParseError } =
  await import("./index")

beforeEach(() => {
  ocr.provider = null
})

describe("detectResumeType", () => {
  test("goes by the bytes, not the name", async () => {
    expect(await detectResumeType(makePdf(RESUME_LINES))).toBe(
      "application/pdf"
    )
    expect(await detectResumeType(await makeDocx(RESUME_LINES))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect(
      await detectResumeType(new TextEncoder().encode("just some text"))
    ).toBeNull()
  })
})

describe("parseResume", () => {
  test("reads the text layer of a PDF", async () => {
    const { text, method } = await parseResume(makePdf(RESUME_LINES))
    expect(method).toBe("pdf")
    expect(text).toContain("Aanya Kulkarni")
    expect(text).toContain("PostgreSQL")
  })

  test("reads a DOCX with list items and page headers", async () => {
    const { text, method } = await parseResume(
      await makeDocx(
        [
          ...RESUME_LINES,
          "- Shipped a React dashboard",
          "- Wrote the API tests",
        ],
        { header: "aanya@example.com · +91 98765 43210" }
      )
    )
    expect(method).toBe("docx")
    expect(text).toContain("aanya@example.com")
    expect(text).toMatch(/^- Shipped a React dashboard$/m)
    expect(text).toContain("Course planner")
  })

  test("sends a PDF without a text layer to OCR", async () => {
    ocr.provider = {
      generateText: vi.fn(async () => RESUME_LINES.join("\n")),
    }
    const { text, method } = await parseResume(makePdf([]))
    expect(method).toBe("pdf-ocr")
    expect(text).toContain("Aanya Kulkarni")
    const call = ocr.provider.generateText.mock.calls[0][0]
    expect(call.feature).toBe("ocr")
    expect(call.files[0].mimeType).toBe("application/pdf")
  })

  test("rejects a scan when no OCR provider is configured", async () => {
    await expect(parseResume(makePdf([]))).rejects.toBeInstanceOf(
      ResumeParseError
    )
  })

  test("a failed OCR call is a readable error, not a crash", async () => {
    ocr.provider = {
      generateText: vi.fn(async () => {
        throw new Error("503 Service Unavailable")
      }),
    }
    await expect(parseResume(makePdf([]))).rejects.toThrow(
      /Could not read this scanned PDF/
    )
  })

  test("rejects files that are not a PDF or DOCX", async () => {
    await expect(
      parseResume(new TextEncoder().encode("<html>not a resume</html>"))
    ).rejects.toThrow(/not a PDF or DOCX/)
  })

  test("rejects a corrupted PDF with a readable message", async () => {
    const broken = new TextEncoder().encode("%PDF-1.4\n%garbage only")
    await expect(parseResume(broken)).rejects.toBeInstanceOf(ResumeParseError)
  })
})
