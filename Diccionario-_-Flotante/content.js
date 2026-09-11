let rectSeleccion = null;

function ajustarPosicionPopup() {
  const popup = document.getElementById('diccionario-popup-root');
  if (!popup || !rectSeleccion) return;

  const anchoPantalla = window.innerWidth;
  let leftPos = rectSeleccion.left + window.scrollX;
  const popupAncho = popup.offsetWidth || 400;

  if (leftPos + popupAncho > anchoPantalla + window.scrollX - 10) {
    leftPos = Math.max(10, anchoPantalla + window.scrollX - popupAncho - 20);
  }

  let topPos = rectSeleccion.top + window.scrollY - popup.offsetHeight - 10;
  if (topPos < window.scrollY + 10) {
    topPos = rectSeleccion.bottom + window.scrollY + 10;
  }

  popup.style.top = `${topPos}px`;
  popup.style.left = `${leftPos < 10 ? 10 : leftPos}px`;
}

window.addEventListener('resize', ajustarPosicionPopup);

document.addEventListener('mouseup', (e) => {
  setTimeout(async () => {
    const popupExistente = document.getElementById('diccionario-popup-root');
    if (popupExistente && popupExistente.contains(e.target)) return;
    if (popupExistente) popupExistente.remove();

    const seleccion = window.getSelection();
    const textoSeleccionado = seleccion.toString().trim();

    if (!textoSeleccionado || textoSeleccionado.length > 300) return;

    const range = seleccion.getRangeAt(0);
    rectSeleccion = range.getBoundingClientRect();

    try {
      let titulo = textoSeleccionado;
      let respuesta = "";
      let urlFuente = `https://www.google.com/search?q=${encodeURIComponent(textoSeleccionado)}`;
      let fuenteNombre = "Google";

      // --- INTENTO 1: RESUMEN COMPLETO DE WIKIPEDIA (Párrafo entero) ---
      const wikiSummaryUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(textoSeleccionado.toLowerCase())}`;
      const wikiRes = await fetch(wikiSummaryUrl);

      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        if (wikiData.extract && wikiData.extract.length > 40) {
          respuesta = wikiData.extract;
          titulo = wikiData.title;
          urlFuente = wikiData.content_urls?.desktop?.page || urlFuente;
          fuenteNombre = "Wikipedia";
        }
      }

      // --- INTENTO 2: BÚSQUEDA DETALLADA CON EXTRACTO COMPLETO ---
      if (!respuesta || respuesta.length < 80) {
        const wikiSearchUrl = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(textoSeleccionado)}&prop=extracts&exintro=1&explaintext=1&exsentences=5&format=json&origin=*`;
        const searchRes = await fetch(wikiSearchUrl);

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const pages = searchData.query?.pages;

          if (pages) {
            // Tomamos la primera página relevante encontrada
            const primeraPagina = Object.values(pages)[0];
            if (primeraPagina && primeraPagina.extract) {
              respuesta = primeraPagina.extract;
              titulo = primeraPagina.title;
              urlFuente = `https://es.wikipedia.org/wiki/${encodeURIComponent(titulo)}`;
              fuenteNombre = "Wikipedia";
            }
          }
        }
      }

      // --- INTENTO 3: RESPUESTAS INSTANTÁNEAS Y TEMAS RELACIONADOS (DUCKDUCKGO) ---
      if (!respuesta) {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(textoSeleccionado)}&format=json&kl=es-es&no_html=1`;
        const ddgRes = await fetch(ddgUrl);

        if (ddgRes.ok) {
          const ddgData = await ddgRes.json();
          let fragmentos = [];

          if (ddgData.AbstractText) fragmentos.push(ddgData.AbstractText);
          if (ddgData.Answer) fragmentos.push(ddgData.Answer);

          // Si hay temas relacionados, los unimos para expandir la respuesta
          if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
            const extraTopics = ddgData.RelatedTopics
              .filter(t => t.Text)
              .slice(0, 2)
              .map(t => t.Text);
            fragmentos.push(...extraTopics);
          }

          if (fragmentos.length > 0) {
            respuesta = fragmentos.join("<br><br>");
            fuenteNombre = ddgData.AbstractSource || "DuckDuckGo";
            urlFuente = ddgData.AbstractURL || urlFuente;
          }
        }
      }

      // Mensaje si no se encuentra información suficiente
      if (!respuesta) {
        respuesta = "No se encontró una explicación amplia directa. Puedes consultar la búsqueda completa en la web.";
      }

      const logoUrl = (typeof browser !== 'undefined' ? browser : chrome).runtime.getURL('logo.png');

      const popup = document.createElement('div');
      popup.id = 'diccionario-popup-root';
      popup.className = 'diccionario-popup-floater';
      popup.innerHTML = `
        <div class="popup-header">
          <strong>${titulo}</strong>
          <img src="${logoUrl}" alt="Logo" class="popup-logo" />
        </div>
        <div class="popup-body">${respuesta}</div>
        <a class="fuente-link" href="${urlFuente}" target="_blank" rel="noopener noreferrer">
          Leer artículo completo en ${fuenteNombre} →
        </a>
      `;

      document.body.appendChild(popup);
      ajustarPosicionPopup();

    } catch (err) {
      console.error("Error consultando la selección:", err);
    }
  }, 10);
});

document.addEventListener('mousedown', (e) => {
  const popup = document.getElementById('diccionario-popup-root');
  if (popup && !popup.contains(e.target)) {
    popup.remove();
  }
});