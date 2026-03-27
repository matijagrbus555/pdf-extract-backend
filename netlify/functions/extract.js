
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
    mbo: { type: "string" },
    ime_prezime: { type: "string" },
    oib: { type: "string" },
    datum_rodjenja: { type: "string" },
    grad_naselje: { type: "string" },
    ulica_broj: { type: "string" },
    sifra_zdr_ustanove: { type: "string" },
    sifra_ugovornog_doktora: { type: "string" },
    kat_osiguranja: { type: "string" },
    spol: { type: "string" },
    dijagnoza: { type: "string" },
    sifra_dijag: { type: "string" },
    polaziste: { type: "string" },
    odrediste: { type: "string" },
    datum: { type: "string" },

    sanitetsko_vozilo: { type: "boolean" },
    plovilo: { type: "boolean" },
    vozilo_i_plovilo: { type: "boolean" },
    lezi: { type: "boolean" },
    sjedi: { type: "boolean" },
    ne_smije_se_samostalno_kretati: { type: "boolean" },
    vrijedi_za_vise_putovanja: { type: "boolean" },
    vrijedi_za_jedno_putovanje: { type: "boolean" },

    napomena: { type: "string" }
  },
  required: [
    "mbo",
    "ime_prezime",
    "oib",
    "datum_rodjenja",
    "grad_naselje",
    "ulica_broj",
    "sifra_zdr_ustanove",
    "sifra_ugovornog_doktora",
    "kat_osiguranja",
    "spol",
    "dijagnoza",
    "sifra_dijag",
    "polaziste",
    "odrediste",
    "datum"
  ]
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
