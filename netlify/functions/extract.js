// netlify/functions/extract.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      }
    }

    // OČEKUJEMO { "url": "https://..." } iz Bubblea
    const { url } = JSON.parse(event.body || "{}")

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing url" }),
      }
    }

    const apiKey = process.env.PDFVECTOR_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing PDFVECTOR_API_KEY" }),
      }
    }

    // JSON schema za nalog – samo polja koja stvarno želiš koristiti
    const schema = {
      type: "object",
      properties: {
        ime: { type: "string" },
        prezime: { type: "string" },
        datum_rodjenja: { type: "string" },
        grad_naselje: { type: "string" },
        ulica_broj: { type: "string" },
        spol: { type: "string" },
        polaziste: { type: "string" },
        odrediste: { type: "string" },
        datum: { type: "string" },
        napomena: { type: "string" }
      },
      required: [
        "ime",
        "prezime",
        "datum_rodjenja",
        "grad_naselje",
        "ulica_broj",
        "spol",
        "polaziste",
        "odrediste",
        "datum"
      ],
      additionalProperties: false
    }

    // Poziv prema PDFVector (novi global host)
    const extractRes = await fetch("https://global.pdfvector.com/api/document/extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        prompt:
          "Extract sanitetski nalog fields: first name (ime), last name (prezime), date of birth (datum rodjenja), city and settlement (grad i naselje), street and number (ulica i broj), gender (spol), departure (polaziste), destination (odrediste), date (datum), note (napomena). Return them in JSON exactly matching keys: ime, prezime, datum_rodjenja, grad_naselje, ulica_broj, spol, polaziste, odrediste, datum, napomena.",
        schema: schema
      }),
    })

    if (!extractRes.ok) {
      const text = await extractRes.text()
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "PDFVector error", details: text }),
      }
    }

    const result = await extractRes.json()

    return {
      statusCode: 200,
      body: JSON.stringify({
        ime: result.ime,
        prezime: result.prezime,
        datum_rodjenja: result.datum_rodjenja,
        grad_naselje: result.grad_naselje,
        ulica_broj: result.ulica_broj,
        spol: result.spol,
        polaziste: result.polaziste,
        odrediste: result.odrediste,
        datum: result.datum,
        napomena: result.napomena,
        raw: result
      }),
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
