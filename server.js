const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/cotizar', async (req, res) => {
  const { destino, peso } = req.body;

  if (!destino || !peso) {
    return res.status(400).json({ error: 'Faltan datos: destino o peso' });
  }

  let browser;
  try {
    console.log('Lanzando navegador...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('Navegador lanzado, cargando página...');
    await page.goto('https://gtsviacargo.alertran.net/gts/pub/cotizacion.seam', { waitUntil: 'domcontentloaded' });

    console.log('Seleccionando origen...');
    await page.select('#form\\:provinciaOrigen', '2'); // CABA
    await page.waitForSelector('#form\\:localidadOrigen');
    await page.select('#form\\:localidadOrigen', '1000'); // Capital Federal

    console.log('Seleccionando destino...');
    await page.select('#form\\:provinciaDestino', '2');
    await page.waitForSelector('#form\\:localidadDestino');
    await page.select('#form\\:localidadDestino', destino);

    console.log(`Cargando peso: ${peso}g`);
    await page.type('#form\\:peso', peso.toString());

    console.log('Clickeando en cotizar...');
    await Promise.all([
      page.click('#form\\:botonCotizar'),
      page.waitForSelector('#form\\:datosCotizacion', { timeout: 10000 })
    ]);

    console.log('Extrayendo resultado...');
    const resultado = await page.evaluate(() => {
      const tabla = document.querySelector('#form\\:datosCotizacion');
      if (!tabla) return null;

      const celda = tabla.querySelector('td.valor');
      return celda ? celda.innerText : null;
    });

    await browser.close();

    if (!resultado) {
      console.error('No se encontró resultado');
      return res.status(500).json({ error: 'No se pudo obtener el valor de cotización' });
    }

    console.log(`Resultado obtenido: ${resultado}`);
    res.json({ precio: resultado });

  } catch (error) {
    if (browser) await browser.close();
    console.error('ERROR DETECTADO:', error.message);
    res.status(500).json({ error: 'Error durante la cotización', detalle: error.message });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
