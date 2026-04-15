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

    // JSON schema za nalog – razdvojeno polazište/odredište + poštanski brojevi
    const schema = {
      type: "object",
      properties: {
        // osobni podaci
        ime: { type: "string" },
        prezime: { type: "string" },
        datum_rodjenja: { type: "string" },
        grad_naselje: { type: "string" },
        ulica_broj: { type: "string" },
        spol: { type: "string" },
        postanski_broj: { type: "string" },

        // polaziste – staro polje + rastavljeno
        polaziste: { type: "string" },
        polaziste_ustanova: { type: "string" },
        polaziste_ulica_broj: { type: "string" },
        polaziste_grad: { type: "string" },
        polaziste_postanski_broj: { type: "string" },

        // odrediste – staro polje + rastavljeno
        odrediste: { type: "string" },
        odrediste_ustanova: { type: "string" },
        odrediste_ulica_broj: { type: "string" },
        odrediste_grad: { type: "string" },
        odrediste_postanski_broj: { type: "string" },

        // datumi i napomena
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
        prompt: `
          This is a Croatian medical transport form "NALOG za sanitetski prijevoz osigurane osobe".
          You are not allowed to guess or summarize.
          If a field is not clearly present, return an empty string "" for that field.
          Always copy the text exactly as printed in the document.

          Extract these fields and return JSON with EXACT keys:
          ime, prezime, datum_rodjenja, grad_naselje, ulica_broj, spol, postanski_broj,
          polaziste, polaziste_ustanova, polaziste_ulica_broj, polaziste_grad, polaziste_postanski_broj,
          odrediste, odrediste_ustanova, odrediste_ulica_broj, odrediste_grad, odrediste_postanski_broj,
          datum, napomena.

          1) Name:
          Field "Ime i prezime" is in format "PREZIME IME" (e.g. "KRAJAČIĆ DAVOR").
          - "prezime": only the last name (first token(s)).
          - "ime": only the first name (remaining token(s)).

          2) Date of birth:
          Field "Datum rođenja" -> "datum_rodjenja" as string exactly as printed (e.g. "21.06.1955").

          3) Address:
          Under "Grad/naselje" and "Adresa osig. osobe":
          - "grad_naselje": city / settlement (e.g. "ZABOK").
          - "ulica_broj": street and house number (e.g. "LUG ZABOČKI 78").
          - "postanski_broj": 5-digit postal code if present near the city (e.g. "49210"). If you cannot find it, use empty string.

          4) Gender:
          From the M/Z marking -> "spol" as "M" or "Z".
          
          5) Departure (POLAZIŠTE):
          Two lines after "POLAZIŠTE":
          - Line 1: institution name (e.g. "Spec. ord. obit. med., Branko Fotivec spec. obit. med").
          - Line 2: address (e.g. "49210 ZABOK, LUG ZABOČKI 78" or "ZABOK, LUG ZABOČKI 78").
          Extract:
          - "polaziste_ustanova": full line 1.
          - "polaziste_postanski_broj": 5-digit postal code from line 2 (e.g. "49210") if present, otherwise empty string.
          - "polaziste_grad": city from line 2 (e.g. "ZABOK").
          - "polaziste_ulica_broj": street and number from line 2 (e.g. "LUG ZABOČKI 78").
          - "polaziste": combined full departure (e.g. both lines together).
          
          6) Destination (ODREDIŠTE):
          Two lines after "ODREDIŠTE":
          - Line 1: institution name (e.g. "Opća bolnica Zabok i bolnica hrvatski ferana").
          - Line 2: address like "Bračak 8,49210 ZABOK" or "49210 ZABOK, Bračak 8".
          Extract:
          - "odrediste_ustanova": full line 1.
          - "odrediste_ulica_broj": street and number from line 2 (e.g. "Bračak 8").
          - "odrediste_postanski_broj": 5-digit postal code from line 2 (e.g. "49210") if present, otherwise empty string.
          - "odrediste_grad": city from line 2 (e.g. "ZABOK").
          - "odrediste": combined full destination.

          7) Nalog date:
          Field "Datum:" near the middle/bottom of the form -> "datum" (e.g. "31.03.2026").

          8) Napomena:
          Locate the label "NAPOMENA:" on the form.
          - "napomena": return ALL text after "NAPOMENA:" on that line and on the following lines until you reach the next section or an empty area.
          Do NOT summarize, translate, or change the wording.
          Return the text exactly as printed (preserve line breaks and punctuation).
          If there is no note, return an empty string "".

          Return JSON that strictly matches the provided JSON schema (fields and types).
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
        ime: result.ime,
        prezime: result.prezime,
        datum_rodjenja: result.datum_rodjenja,
        grad_naselje: result.grad_naselje,
        ulica_broj: result.ulica_broj,
        postanski_broj: result.postanski_broj,
        spol: result.spol,

        polaziste: result.polaziste,
        polaziste_ustanova: result.polaziste_ustanova,
        polaziste_ulica_broj: result.polaziste_ulica_broj,
        polaziste_grad: result.polaziste_grad,
        polaziste_postanski_broj: result.polaziste_postanski_broj,

        odrediste: result.odrediste,
        odrediste_ustanova: result.odrediste_ustanova,
        odrediste_ulica_broj: result.odrediste_ulica_broj,
        odrediste_grad: result.odrediste_grad,
        odrediste_postanski_broj: result.odrediste_postanski_broj,

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
