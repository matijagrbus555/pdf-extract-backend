// netlify/functions/extract.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      }
    }

    // Očekujemo { "url": "https://..." } iz Bubblea
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

    // Schema za sanitetski nalog (odvojeno ime/prezime, polaziste/odrediste rastavljeno)
    const schema = {
      type: "object",
      properties: {
        prezime: { type: "string" },
        ime: { type: "string" },
        datum_rodjenja: { type: "string" },

        polaziste_ustanova: { type: "string" },
        polaziste_ulica_broj: { type: "string" },
        polaziste_grad: { type: "string" },

        odrediste_ustanova: { type: "string" },
        odrediste_ulica_broj: { type: "string" },
        odrediste_grad: { type: "string" },

        napomena: { type: "string" }
      },
      required: [
        "prezime",
        "ime",
        "datum_rodjenja",
        "polaziste_ustanova",
        "polaziste_ulica_broj",
        "polaziste_grad",
        "odrediste_ustanova",
        "odrediste_ulica_broj",
        "odrediste_grad"
      ],
      additionalProperties: false
    }

    // Poziv prema PDFVector (global host)
    const extractRes = await fetch("https://global.pdfvector.com/api/document/extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        prompt: `
          This is a Croatian medical transport form "NALOG za sanitetski prijevoz osigurane osobe".

          1) Name:
          The field labeled "Ime i prezime" contains "PREZIME IME" (e.g. "KRAJAČIĆ DAVOR").
          - Extract "prezime": only the last name (first token(s)).
          - Extract "ime": only the first name (remaining token(s)).

          2) Date of birth:
          Field "Datum rođenja" -> map to "datum_rodjenja" as string exactly as written (e.g. "21.06.1955").

          3) Departure (POLAZIŠTE):
          There are two lines after the "POLAZIŠTE" label.
          - Line 1: institution name (e.g. "Spec. ord. obit. med., Branko Fotivec spec. obit. med").
          - Line 2: address (e.g. "ZABOK, LUG ZABOČKI 78").
          Extract:
          - "polaziste_ustanova": full line 1.
          - "polaziste_grad": city / place name from line 2 (e.g. "ZABOK").
          - "polaziste_ulica_broj": street and house number from line 2 (e.g. "LUG ZABOČKI 78").

          4) Destination (ODREDIŠTE):
          Two lines after the "ODREDIŠTE" label.
          - Line 1: institution name (e.g. "Opća bolnica Zabok i bolnica hrvatski ferana").
          - Line 2: address like "Bračak 8,49210 ZABOK".
          Extract:
          - "odrediste_ustanova": full line 1.
          - "odrediste_ulica_broj": street and house number from line 2 (e.g. "Bračak 8").
          - "odrediste_grad": city from line 2 (e.g. "ZABOK").

          5) Napomena:
          Extract the text after the "NAPOMENA" label into "napomena".

          Return a JSON object that strictly matches the provided JSON schema (fields and types).
        `,
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
        prezime: result.prezime,
        ime: result.ime,
        datum_rodjenja: result.datum_rodjenja,

        polaziste_ustanova: result.polaziste_ustanova,
        polaziste_ulica_broj: result.polaziste_ulica_broj,
        polaziste_grad: result.polaziste_grad,

        odrediste_ustanova: result.odrediste_ustanova,
        odrediste_ulica_broj: result.odrediste_ulica_broj,
        odrediste_grad: result.odrediste_grad,

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
