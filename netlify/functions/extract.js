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

    const apiKey = process.env.PDFVECTOR_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing PDFVECTOR_API_KEY" }),
      }
    }

    // JSON schema: TR, teksta i checkboxovi
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

    // Pozivamo PDFVector s URL-om i shemom
    const extractRes = await fetch("https://www.pdfvector.com/v1/api/pdf-extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf_url: pdfUrl,
        schema,
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
        mbo: result.mbo,
        ime_prezime: result.ime_prezime,
        oib: result.oib,
        datum_rodjenja: result.datum_rodjenja,
        grad_naselje: result.grad_naselje,
        ulica_broj: result.ulica_broj,
        sifra_zdr_ustanove: result.sifra_zdr_ustanove,
        sifra_ugovornog_doktora: result.sifra_ugovornog_doktora,
        kat_osiguranja: result.kat_osiguranja,
        spol: result.spol,
        dijagnoza: result.dijagnoza,
        sifra_dijag: result.sifra_dijag,
        polaziste: result.polaziste,
        odrediste: result.odrediste,
        datum: result.datum,
        sanitetsko_vozilo: result.sanitetsko_vozilo,
        plovilo: result.plovilo,
        vozilo_i_plovilo: result.vozilo_i_plovilo,
        lezi: result.lezi,
        sjedi: result.sjedi,
        ne_smije_se_samostalno_kretati: result.ne_smije_se_samostalno_kretati,
        vrijedi_za_vise_putovanja: result.vrijedi_za_vise_putovanja,
        vrijedi_za_jedno_putovanje: result.vrijedi_za_jedno_putovanje,
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
