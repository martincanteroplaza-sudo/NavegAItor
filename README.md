# NavegAItor — backend (fase 1: solo lectura de URLs)

Este servidor todavía **no es un buscador**. Solo hace una cosa:
recibe una URL y te devuelve el título, una breve descripción y el
texto principal de esa página, para poder "leerla" desde
NavegAItor sin tener que abrirla en otra pestaña.

## Endpoint

```
GET /read?url=https://ejemplo.com
```

Respuesta (ejemplo):
```json
{
  "url": "https://ejemplo.com/",
  "titulo": "Ejemplo",
  "descripcion": "Una página de ejemplo.",
  "texto": "Aquí va el texto principal extraído de la página..."
}
```

Si algo falla, responde con un código de error HTTP y `{"error": "..."}`.

## Cómo desplegarlo en Render (gratis para empezar)

1. Sube esta carpeta (`navegaitor-backend`) a un repositorio de GitHub.
   - Puede ser el mismo repositorio que uses para CrAIthon, en una
     carpeta aparte, o uno nuevo solo para esto.
2. Entra en [render.com](https://render.com) → **New** → **Web Service**.
3. Conecta ese repositorio.
4. Configuración:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free está bien para empezar.
5. Despliega. Render te dará una URL parecida a:
   `https://navegaitor-backend.onrender.com`
6. Prueba que funciona abriendo en el navegador:
   `https://navegaitor-backend.onrender.com/read?url=https://es.wikipedia.org/wiki/Robot`

Cuando tengas esa URL, pásamela y conecto el front-end de
NavegAItor para que, al pegar un enlace, llame a este servidor y
muestre el resultado.

## Notas de privacidad

- El servidor no guarda ningún registro con la URL leída ni con
  datos del usuario que la pide.
- Rechaza URLs que apunten a direcciones internas (localhost, redes
  privadas), para evitar que se use para fisgonear la propia
  infraestructura del servidor.
- Tiene un límite de tiempo (8 segundos) y de tamaño (~2MB de HTML)
  por petición, para no quedarse colgado con páginas muy pesadas.

## Importante sobre el plan gratuito de Render

Los servicios gratuitos de Render "se duermen" tras un rato sin uso
y tardan unos segundos en despertar en la siguiente petición. Es
normal si la primera lectura tarda un poco más.
