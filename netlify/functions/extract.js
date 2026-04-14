// netlify/functions/extract.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      }
    }

    const { url } = JSON.parse(event.body || "{}")

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing url" }),
      }
    }

    const pdfcoKey = process.env.PDFCO_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    if (!pdfcoKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing PDFCO_API_KEY" }),
      }
    }
    if (!geminiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
      }
    }

    // 1) PDF → TEXT preko PDF.co (s OCR)
    const pdfcoRes = await fetch("https://api.pdf.co/v1/pdf/convert/to/text", {
      method: "POST",
      headers: {
        "x-api-key": pdfcoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        inline: true, // vrati tekst direktno u response
        // jednostavan OCR profil; po potrebi kasnije pojačamo
        profiles: JSON.stringify({
          OCRMode: "TextFromImagesAndVectors",
          OCRLanguage: "hrv", // ili "eng,hrv" ako treba
        }),
      }),
    })

    if (!pdfcoRes.ok) {
      const text = await pdfcoRes.text()
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "PDF.co error", details: text }),
      }
    }

    const pdfcoData = await pdfcoRes.json()
    const pdfText = pdfcoData.body || pdfcoData.text || ""

    if (!pdfText) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Empty text from PDF.co" }),
      }
    }

    // 2) TEXT → STRUKTURIRANI JSON preko Gemini
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
        polaziste_ustanova: { type: "string" },
        polaziste_ulica_broj: { type: "string" },
        polaziste_grad: { type: "string" },

        odrediste: { type: "string" },
        odrediste_ustanova: { type: "string" },
        odrediste_ulica_broj: { type: "string" },
        odrediste_grad: { type: "string" },

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

    const prompt = `
This is the plain text content of a Croatian medical transport form "NALOG za sanitetski prijevoz osigurane osobe".
The text may come from a scanned PDF (OCR), so expect line breaks and noise.

From ONLY the text provided below, extract these fields and return STRICT JSON with EXACT keys:
ime, prezime, datum_rodjenja, grad_naselje, ulica_broj, spol,
polaziste, polaziste_ustanova, polaziste_ulica_broj, polaziste_grad,
odrediste, odrediste_ustanova, odrediste_ulica_broj, odrediste_grad,
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

4) Gender:
From the M/Z marking -> "spol" as "M" or "Z".

5) Departure (POLAZIŠTE):
Around the label "POLAZIŠTE":
- There are typically two lines:
  - Line 1: institution name (e.g. "Spec. ord. obit. med., Branko Fotivec spec. obit. med").
  - Line 2: address (e.g. "ZABOK, LUG ZABOČKI 78").
Extract:
- "polaziste_ustanova": full line 1.
- "polaziste_grad": city from line 2 (e.g. "ZABOK").
- "polaziste_ulica_broj": street and number from line 2 (e.g. "LUG ZABOČKI 78").
- "polaziste": combined full departure (e.g. both lines together).

6) Destination (ODREDIŠTE):
Around the label "ODREDIŠTE":
- Typically two lines:
  - Line 1: institution name (e.g. "Opća bolnica Zabok i bolnica hrvatski ferana").
  - Line 2: address like "Bračak 8,49210 ZABOK".
Extract:
- "odrediste_ustanova": full line 1.
- "odrediste_ulica_broj": street and number from line 2 (e.g. "Bračak 8").
- "odrediste_grad": city from line 2 (e.g. "ZABOK").
- "odrediste": combined full destination.

7) Nalog date:
Field "Datum:" near the middle/bottom of the form -> "datum" (e.g. "31.03.2026").

8) Napomena:
Text after "NAPOMENA:" -> "napomena".

RULES:
- Always return a SINGLE JSON object, no explanations, no markdown.
- Keys must match the JSON schema exactly.
- If a field cannot be confidently determined, return an empty string for that field.
- The JSON must be valid and parseable.
    `.trim()

    const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + geminiKey, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { text: "\n\n--- BEGIN DOCUMENT TEXT ---\n" + pdfText + "\n--- END DOCUMENT TEXT ---\n" }
            ]
          }
        ],
        // tražimo da vrati direktno JSON
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      })
    })

    if (!geminiRes.ok) {
      const text = await geminiRes.text()
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Gemini error", details: text }),
      }
    }

    const geminiData = await geminiRes.json()

    // Ovisno o formatu, Gemini će vratiti ili direktno objekt ili u candidates[0].content.parts[0].text
    let result = null

    // Ako responseMimeType i schema prođu, često je response direktno JSON objekt:
    if (geminiData && !geminiData.candidates && !Array.isArray(geminiData)) {
      result = geminiData
    } else {
      const candidate = geminiData.candidates && geminiData.candidates[0]
      const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0]
      const text = part && part.text
      if (!text) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Gemini returned no text" }),
        }
      }
      try {
        result = JSON.parse(text)
      } catch (e) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Failed to parse Gemini JSON", details: text }),
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ime: result.ime || "",
        prezime: result.prezime || "",
        datum_rodjenja: result.datum_rodjenja || "",
        grad_naselje: result.grad_naselje || "",
        ulica_broj: result.ulica_broj || "",
        spol: result.spol || "",

        polaziste: result.polaziste || "",
        polaziste_ustanova: result.polaziste_ustanova || "",
        polaziste_ulica_broj: result.polaziste_ulica_broj || "",
        polaziste_grad: result.polaziste_grad || "",

        odrediste: result.odrediste || "",
        odrediste_ustanova: result.odrediste_ustanova || "",
        odrediste_ulica_broj: result.odrediste_ulica_broj || "",
        odrediste_grad: result.odrediste_grad || "",

        datum: result.datum || "",
        napomena: result.napomena || "",

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
