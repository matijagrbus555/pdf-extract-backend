exports.handler = async (event) => {
  try {
    const { pdfUrl } = JSON.parse(event.body || "{}")

    if (!pdfUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing pdfUrl" }),
      }
    }

    // 1) ovdje fetch PDF ili direktno šalješ pdfUrl PDFVectoru
    // 2) ovdje radiš POST na PDFVector API sa schema (ime, prezime, razred)
    // 3) iz njihovog odgovora izvadiš ta polja

    const data = {
      ime: "Primjer Ime",
      prezime: "Primjer Prezime",
      razred: "Primjer Razred",
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
