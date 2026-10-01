// NavegAItor — servidor "lector de páginas"
// De momento NO busca nada: solo recibe una URL y devuelve
// el título, una descripción y el texto principal de esa página.
//
// Pensado para desplegarse en Render (Node 18+, tiene fetch nativo).

import express from "express";
import * as cheerio from "cheerio";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Sirve la página de NavegAItor (carpeta "public") directamente en "/".
app.use(express.static(path.join(__dirname, "public")));

// --- Privacidad -------------------------------------------------
// No usamos ningún middleware de "logging" de peticiones (nada de
// morgan, nada de console.log con la URL o la IP del usuario).
// Render puede guardar algunos logs de infraestructura por su
// cuenta durante un tiempo corto; eso ya no depende de este código.
// ------------------------------------------------------------------

app.use((req, res, next) => {
  // CORS abierto para que el front-end (por ahora en cualquier
  // dominio, incluida la vista previa de Claude) pueda llamarnos.
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/estado", (_req, res) => {
  res.json({ ok: true, service: "navegaitor-backend", mode: "solo-lectura-de-urls" });
});

// Bloquea intentos de leer direcciones internas (localhost, red
// privada, etc.) para que nadie use esto para fisgonear tu propia
// red interna cuando lo despliegues.
function esUrlPeligrosa(hostname) {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    h === "127.0.0.1" ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h === "0.0.0.0" ||
    h === "::1"
  );
}

app.get("/read", async (req, res) => {
  const target = req.query.url;

  if (!target || typeof target !== "string") {
    return res.status(400).json({ error: "Falta el parámetro url" });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "Esa URL no es válida" });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "Solo se permiten URLs http/https" });
  }
  if (esUrlPeligrosa(parsed.hostname)) {
    return res.status(400).json({ error: "Esa dirección no está permitida" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const respuesta = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Nos identificamos como lo que somos, sin enviar datos del usuario.
        "User-Agent": "NavegAItorBot/0.1 (+https://craithon.onrender.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    const tipo = respuesta.headers.get("content-type") || "";
    if (!respuesta.ok) {
      return res.status(502).json({ error: `La página respondió con estado ${respuesta.status}` });
    }
    if (!tipo.includes("text/html")) {
      return res.status(415).json({ error: "Esa URL no parece ser una página web (HTML)" });
    }

    // Limitamos cuánto HTML leemos para no cargar páginas gigantes.
    const LIMITE = 2_000_000; // ~2MB de HTML
    const reader = respuesta.body.getReader();
    let recibido = 0;
    let chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      recibido += value.length;
      if (recibido > LIMITE) {
        controller.abort();
        break;
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");

    const $ = cheerio.load(html);

    $("script, style, noscript, iframe, svg").remove();

    const titulo =
      $("title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      parsed.hostname;

    const descripcion =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    // Texto principal: intentamos <article> o <main>, si no, el body entero.
    let contenedor = $("article").first();
    if (contenedor.length === 0) contenedor = $("main").first();
    if (contenedor.length === 0) contenedor = $("body");

    const parrafos = contenedor
      .find("p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 40);

    const texto = parrafos.join("\n\n").slice(0, 6000);

    res.json({
      url: parsed.toString(),
      titulo: titulo.slice(0, 200),
      descripcion: descripcion.slice(0, 300),
      texto: texto || "(No se ha encontrado texto legible en esta página.)",
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "La página ha tardado demasiado en responder" });
    }
    return res.status(500).json({ error: "No se ha podido leer esa página" });
  }
});

app.listen(PORT, () => {
  // Este mensaje solo aparece en tus propios logs de Render, no
  // contiene datos de ningún usuario.
  console.log(`NavegAItor backend (modo lectura) escuchando en el puerto ${PORT}`);
});
