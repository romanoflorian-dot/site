/* Som do site: nunca toca sem ação do visitante. */
(function () {
  var ctx = null;
  var ligado = false;
  var ouvintes = [];

  function guardar(v) { try { localStorage.setItem("fr-som", v ? "1" : "0"); } catch (e) {} }
  function lido() { try { return localStorage.getItem("fr-som") === "1"; } catch (e) { return false; } }

  function contexto() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function ruidoBuffer(c, seg) {
    var n = Math.floor(c.sampleRate * seg);
    var b = c.createBuffer(1, n, c.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* Gravação do mar de Floriano Romano (algum_mar_1, trecho de 45 s). */
  var MAR_URL = (function () {
    var s = document.currentScript && document.currentScript.src;
    try { return new URL("../audio/mar.mp3", s || location.href).href; } catch (e) { return "/assets/audio/mar.mp3"; }
  })();
  var mar = null, marCarregando = false;

  function carregarMar() {
    if (mar || marCarregando) return;
    var c = contexto(); if (!c || !window.fetch) return;
    marCarregando = true;
    fetch(MAR_URL).then(function (r) { return r.arrayBuffer(); })
      .then(function (a) {
        return new Promise(function (ok, erro) { c.decodeAudioData(a, ok, erro); });
      })
      .then(function (b) { mar = b; })
      .catch(function () { marCarregando = false; });
  }

  /* Um pedaço curto do mar que "escapa" de um cruzamento; cada obra tem o seu trecho. */
  var ultimo = null;
  function escapar(freq) {
    if (!ligado) return;
    var c = contexto(); if (!c) return;
    if (!mar) { carregarMar(); return; }
    var t = c.currentTime, dur = 2.4;
    var inicio = (freq * 7.31) % (mar.duration - dur - 0.1);
    if (ultimo) { try { ultimo.g.gain.cancelScheduledValues(t); ultimo.g.gain.setTargetAtTime(0.0001, t, 0.08); ultimo.src.stop(t + 0.4); } catch (e) {} }
    var src = c.createBufferSource(); src.buffer = mar;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.3);
    g.gain.setValueAtTime(0.9, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g); g.connect(c.destination);
    src.start(t, inicio, dur); src.stop(t + dur + 0.05);
    ultimo = { src: src, g: g };
  }

  /* Ruído contínuo de rádio, com volume controlável (para o dial). */
  function chiado() {
    var c = contexto(); if (!c) return null;
    var src = c.createBufferSource(); src.buffer = ruidoBuffer(c, 2); src.loop = true;
    var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 500;
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
    var g = c.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(c.destination);
    src.start();
    return {
      volume: function (v) { g.gain.setTargetAtTime(ligado ? v : 0, c.currentTime, 0.05); },
      tom: function (f) { lp.frequency.setTargetAtTime(f, c.currentTime, 0.08); }
    };
  }

  function atualizarBotoes() {
    document.querySelectorAll("[data-som]").forEach(function (b) {
      b.setAttribute("aria-pressed", ligado ? "true" : "false");
      var r = b.querySelector("[data-som-rotulo]");
      if (r) r.textContent = (window.LANG === "en") ? (ligado ? "Sound off" : "Sound on") : (ligado ? "Desligar som" : "Ligar som");
    });
  }

  function definir(v) {
    ligado = v; guardar(v);
    if (v) { contexto(); carregarMar(); }
    atualizarBotoes();
    ouvintes.forEach(function (f) { f(v); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ligado = lido();
    atualizarBotoes();
    document.querySelectorAll("[data-som]").forEach(function (b) {
      b.addEventListener("click", function () { definir(!ligado); });
    });
    /* o navegador só libera o áudio depois de um gesto */
    document.addEventListener("pointerdown", function () { if (ligado) { contexto(); carregarMar(); } }, { once: true });
  });

  window.FRSom = {
    escapar: escapar,
    chiado: chiado,
    ligado: function () { return ligado; },
    aoMudar: function (f) { ouvintes.push(f); }
  };
})();
