const fetch = require("node-fetch")

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      }
    }

    const { pdfUrl } = JSON.parse(event.body || "{}")

    if (!pdfUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing pdfUrl" }),
      }
    }

    // 1) Skinemo PDF s Bubble URLa
    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Cannot download PDF" }),
      }
    }
    const pdfBuffer = await pdfRes.arrayBuffer()

    // 2) Pošaljemo PDF na PDFVector "PDF Extraction API"
    const apiKey = process.env.PDFVECTOR_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing PDFVECTOR_API_KEY" }),
      }
    }

    // primjer sheme: ime, prezime, razred kao stringovi
    const schema = {
      type: "object",
      properties: {
        ime: { type: "string" },
        prezime: { type: "string" },
        razred: { type: "string" },
      },
      required: ["ime", "prezime", "razred"],
    }

    const formData = new FormData()
    formData.append("file", Buffer.from(pdfBuffer), "document.pdf")
    formData.append("schema", JSON.stringify(schema))

    const extractRes = await fetch("https://www.pdfvector.com/api/pdf-extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!extractRes.ok) {
      const text = await extractRes.text()
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "PDFVector error", details: text }),
      }
    }

    const result = await extractRes.json()

    // Pretpostavljamo da PDFVector vrati npr. { ime: "...", prezime: "...", razred: "..." }
    const { ime, prezime, razred } = result

    return {
      statusCode: 200,
      body: JSON.stringify({
        ime,
        prezime,
        razred,
        raw: result, // za debug, možeš kasnije maknuti
      }),
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
