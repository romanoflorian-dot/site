/* Mapa "Estradas" — as obras são cidades, as linhas são estradas.
   Cada ponto é um pequeno laço de mola: ao puxar um ponto, o desenho inteiro
   se mexe um pouco e depois volta ao lugar.
   Ao passar sobre um ponto, as estradas que saem dele ficam em evidência e um som escapa. */
document.addEventListener("DOMContentLoaded", function () {
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".mapa.rede").forEach(function (svg) {
    /* ---- pontos: cidades (obras), cruzamentos e pontas soltas */
    var pts = {}, lista = [];
    function novo(el, id, tipo) {
      var p = { el: el, id: id, tipo: tipo,
        x0: parseFloat(el.getAttribute("data-x")), y0: parseFloat(el.getAttribute("data-y")),
        ux: 0, uy: 0, vx: 0, vy: 0, viz: [], papel: [], preso: false, tx: 0, ty: 0 };
      pts[id] = p; lista.push(p);
      return p;
    }
    svg.querySelectorAll(".m-no").forEach(function (el) {
      novo(el, el.getAttribute("data-no") || el.getAttribute("data-id"), "no");
    });
    svg.querySelectorAll(".m-ponta").forEach(function (el) {
      novo(el, el.getAttribute("data-id"), "ponta");
    });

    /* ---- estradas */
    var vias = [];
    svg.querySelectorAll(".m-via").forEach(function (el) {
      var a = pts[el.getAttribute("data-a")], b = pts[el.getAttribute("data-b")];
      if (!a || !b) return;
      var v = { el: el, a: a, b: b, c: parseFloat(el.getAttribute("data-c")) || 0,
        o: el.getAttribute("data-o").split(",").map(parseFloat) };
      a.viz.push(b); b.viz.push(a);
      vias.push(v);
    });

    /* o papel: cada ponto também se liga, sem linha visível, aos três pontos mais próximos,
       para que nenhuma parte do desenho fique solta do resto */
    lista.forEach(function (p) {
      lista.filter(function (q) { return q !== p; })
        .sort(function (q, r) {
          return Math.hypot(q.x0 - p.x0, q.y0 - p.y0) - Math.hypot(r.x0 - p.x0, r.y0 - p.y0);
        })
        .slice(0, 3).forEach(function (q) {
          if (p.papel.indexOf(q) < 0) { p.papel.push(q); q.papel.push(p); }
        });
    });

    function desenhaVia(v) {
      var ax = v.a.x0 + v.a.ux, ay = v.a.y0 + v.a.uy, bx = v.b.x0 + v.b.ux, by = v.b.y0 + v.b.uy;
      var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / L, ny = dx / L, n = v.o.length - 1, d = "";
      for (var i = 0; i <= n; i++) {
        var t = i / n, k = v.c * 4 * t * (1 - t) * L + v.o[i];
        d += (i ? " L" : "M") + (ax + dx * t + nx * k).toFixed(1) + " " + (ay + dy * t + ny * k).toFixed(1);
      }
      v.el.setAttribute("d", d);
    }
    function desenha() {
      vias.forEach(desenhaVia);
      lista.forEach(function (p) {
        if (p.tipo === "no") p.el.setAttribute("transform", "translate(" + p.ux.toFixed(2) + " " + p.uy.toFixed(2) + ")");
      });
    }

    /* ---- molas
       cada ponto está preso ao seu lugar por uma mola fraca (ANC)
       e aos vizinhos por molas mais fortes (VIZ): o puxão se espalha pelo desenho, diminuindo */
    var VIZ = 0.035, PAPEL = 0.012, ANC = 0.06, ATRITO = reduz ? 0.6 : 0.86, LIMITE = 70;
    var rodando = false;
    function passo() {
      var energia = 0;
      lista.forEach(function (p) {
        if (p.preso) return;
        var fx = -ANC * p.ux, fy = -ANC * p.uy;
        p.viz.forEach(function (q) { fx += VIZ * (q.ux - p.ux); fy += VIZ * (q.uy - p.uy); });
        p.papel.forEach(function (q) { fx += PAPEL * (q.ux - p.ux); fy += PAPEL * (q.uy - p.uy); });
        p.vx = (p.vx + fx) * ATRITO; p.vy = (p.vy + fy) * ATRITO;
      });
      lista.forEach(function (p) {
        if (p.preso) {
          var mx = (p.tx - p.ux) * 0.35, my = (p.ty - p.uy) * 0.35;
          p.ux += mx; p.uy += my;
          energia += Math.abs(mx) + Math.abs(my);
          return;
        }
        p.ux += p.vx; p.uy += p.vy;
        energia += Math.abs(p.vx) + Math.abs(p.vy) + (Math.abs(p.ux) + Math.abs(p.uy)) * 0.01;
      });
      return energia;
    }
    function quadro() {
      var e = passo();
      desenha();
      if (e > 0.02 || arrasto) requestAnimationFrame(quadro);
      else {
        lista.forEach(function (p) { p.ux = p.uy = p.vx = p.vy = 0; });
        desenha();
        rodando = false;
      }
    }
    function acorda() { if (!rodando) { rodando = true; requestAnimationFrame(quadro); } }

    /* ---- puxar um ponto */
    var arrasto = null;
    function noSvg(ev) {
      var m = svg.getScreenCTM();
      if (!m) return null;
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      return pt.matrixTransform(m.inverse());
    }
    function resiste(d) { /* quanto mais longe, mais a mola resiste */
      var r = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
      if (!r) return d;
      var f = LIMITE * (1 - Math.exp(-r / LIMITE)) / r;
      return [d[0] * f, d[1] * f];
    }
    svg.querySelectorAll(".m-no").forEach(function (el) {
      var p = pts[el.getAttribute("data-no") || el.getAttribute("data-id")];
      el.addEventListener("pointerdown", function (ev) {
        if (ev.button > 0) return;
        var s = noSvg(ev); if (!s) return;
        arrasto = { p: p, el: el, id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, ox: s.x, oy: s.y, moveu: false };
      });
      el.addEventListener("click", function (ev) {
        if (el.getAttribute("data-puxado")) { ev.preventDefault(); el.removeAttribute("data-puxado"); }
      });
      el.addEventListener("dragstart", function (ev) { ev.preventDefault(); });
    });
    window.addEventListener("pointermove", function (ev) {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      if (!arrasto.moveu) {
        if (Math.abs(ev.clientX - arrasto.sx) + Math.abs(ev.clientY - arrasto.sy) < 6) return;
        arrasto.moveu = true;
        arrasto.p.preso = true;
        svg.classList.add("puxando");
        try { arrasto.el.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      var s = noSvg(ev); if (!s) return;
      var d = resiste([s.x - arrasto.ox, s.y - arrasto.oy]);
      arrasto.p.tx = d[0]; arrasto.p.ty = d[1];
      acorda();
      ev.preventDefault();
    });
    function largar(ev) {
      if (!arrasto || (ev && ev.pointerId !== arrasto.id)) return;
      if (arrasto.moveu) {
        arrasto.el.setAttribute("data-puxado", "1");
        setTimeout(function (el) { return function () { el.removeAttribute("data-puxado"); }; }(arrasto.el), 400);
        arrasto.p.preso = false;
        arrasto.p.vx = arrasto.p.vy = 0;
        svg.classList.remove("puxando");
        acorda();
      }
      arrasto = null;
    }
    window.addEventListener("pointerup", largar);
    window.addEventListener("pointercancel", largar);

    /* ---- foco num ponto: as estradas que saem dele */
    function focar(id) {
      svg.classList.add("foco");
      vias.forEach(function (v) { v.el.classList.toggle("on", v.a.id === id || v.b.id === id); });
    }
    function soltar() {
      svg.classList.remove("foco");
      vias.forEach(function (v) { v.el.classList.remove("on"); });
    }
    svg.querySelectorAll("a.m-no").forEach(function (el) {
      var id = el.getAttribute("data-no");
      var ano = parseInt(el.getAttribute("data-ano"), 10) || 2010;
      var freq = 260 + (ano - 2000) * 85;   /* obras mais recentes soam mais agudas */
      function entrar() { focar(id); if (window.FRSom && !arrasto) window.FRSom.escapar(freq); }
      el.addEventListener("mouseenter", entrar);
      el.addEventListener("focus", entrar);
      el.addEventListener("mouseleave", function () { if (!arrasto) soltar(); });
      el.addEventListener("blur", soltar);
    });
  });
});
