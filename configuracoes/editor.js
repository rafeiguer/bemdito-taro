/* Tela Configurações: edita conteudo.json por formulários, prepara fotos novas no navegador e publica
   tudo num commit (github.js). O rascunho fica no IndexedDB (rascunho.js) a cada mudança, então dá para
   fechar a aba e continuar depois, e a prévia (index.html?previa) mostra o site com ele.
   Inglês: cada texto pode ter uma tradução escrita à mão em conteudo.ingles[texto em português];
   sem ela, o site usa o tradutor do Google. */
import { lerRascunho, gravarRascunho, apagarRascunho } from "./rascunho.js";
import { cliente, ErroGitHub, REPO, RAMO, ARQUIVO, PASTA_FOTOS } from "./github.js";
import { prepararFoto } from "./imagens.js";

const CHAVE_LOCAL = "bemdito-chave", VER_INGLES = "bemdito-ver-ingles";
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const est = {
  gh: null, conteudo: null, publicado: null, base: null,
  fotos: {},          // fotos novas: { "assets/fotos/tryv-01.webp": Blob }
  urls: {},           // miniaturas das fotos novas (continuam valendo depois de publicar)
  nomes: new Set(),   // nomes (sem extensão) que já existem em assets/fotos
  listou: false, alterado: false, aba: "inicio", partes: {}, verIngles: false
};
try { est.verIngles = localStorage.getItem(VER_INGLES) === "1"; } catch {}

/* ---------- Montar elementos ---------- */
function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value" || k === "checked") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...filhos.flat(Infinity).filter(f => f != null && f !== false));
  return el;
}
const clonar = o => JSON.parse(JSON.stringify(o));
const semMarcas = s => String(s ?? "").replace(/\*/g, "");
let idCampo = 0;
const novoIdCampo = () => `c${++idCampo}`;

/* ---------- Rascunho e estado ---------- */
let tempoGuardar, porGuardar = false;
function mudou({ redesenhar = false } = {}) {
  est.alterado = porGuardar = true;
  barra();
  clearTimeout(tempoGuardar);
  tempoGuardar = setTimeout(guardar, 400);
  if (redesenhar) desenharAba();
}
const guardar = () => {
  clearTimeout(tempoGuardar);
  porGuardar = false;
  return gravarRascunho({ conteudo: est.conteudo, fotos: est.fotos, base: est.base, alterado: est.alterado })
    .catch(e => { porGuardar = true; console.warn("Rascunho não gravado", e); });
};
// Sair da aba ou trocar de app no celular: grava o que ainda estava esperando os 400 ms.
document.addEventListener("visibilitychange", () => { if (document.hidden && porGuardar) guardar(); });

/* ---------- Avisos e progresso ---------- */
function aviso(texto, tipo = "info") {
  const caixa = $("#avisos");
  const el = h("div", { class: `aviso aviso--${tipo}`, role: tipo === "erro" ? "alert" : "status" }, texto,
    h("button", { class: "aviso__fechar", "aria-label": "Fechar aviso", onclick: () => el.remove() }, "×"));
  caixa.append(el);
  if (tipo !== "erro") setTimeout(() => el.remove(), 6000);
}
function progresso(texto) {
  const el = $("#progresso");
  el.hidden = !texto;
  $(".progresso__texto", el).textContent = texto || "";
}
function mensagemErro(e) {
  if (e instanceof ErroGitHub) {
    if (e.status === 401) return "A chave de acesso não vale mais (venceu ou foi apagada). Peça uma nova ao Rafa e entre de novo.";
    if (e.status === 403 || e.status === 404) return "Esta chave não tem permissão para gravar no site. Peça ao Rafa para conferir.";
    return `O GitHub respondeu com um erro (${e.status}): ${e.message}`;
  }
  if (e instanceof TypeError) return "Sem conexão com a internet. Suas mudanças estão guardadas neste aparelho; tente de novo daqui a pouco.";
  return e.message || String(e);
}

/* ---------- Fotos ---------- */
const RAW = `https://raw.githubusercontent.com/${REPO}/${RAMO}/`;
function urlFoto(caminho) {
  if (est.urls[caminho]) return est.urls[caminho];
  if (est.fotos[caminho]) return (est.urls[caminho] = URL.createObjectURL(est.fotos[caminho]));
  return `./${caminho}`;
}
// Foto recém-publicada ainda não está no site (o Pages leva um minuto): busca direto no GitHub.
const miniatura = (caminho, alt = "", estilo) => h("img", {
  src: urlFoto(caminho), alt, loading: "lazy", decoding: "async", style: estilo,
  onerror: ev => { const i = ev.currentTarget; if (!i.dataset.raw) { i.dataset.raw = "1"; i.src = RAW + caminho; } }
});

const nomeDe = caminho => caminho.split("/").pop().replace(/\.[^.]+$/, "");
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function novoNome(prefixo) {
  if (!est.listou) return `${prefixo}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const re = new RegExp(`^${escRe(prefixo)}-(\\d+)$`);
  let max = 0;
  for (const n of [...est.nomes, ...Object.keys(est.fotos).map(nomeDe)]) { const m = n.match(re); if (m) max = Math.max(max, Number(m[1])); }
  const nome = `${prefixo}-${String(max + 1).padStart(2, "0")}`;
  est.nomes.add(nome);
  return nome;
}
const caminhoNovo = (nome, blob) => `${PASTA_FOTOS}/${nome}.${blob.type === "image/jpeg" ? "jpg" : "webp"}`;

// Lê os arquivos escolhidos e devolve [{ foto, largura, altura }] das fotos novas (as que deram erro são avisadas e puladas).
async function receberFotos(arquivos, prefixo) {
  const novas = [];
  for (const [k, arq] of [...arquivos].entries()) {
    progresso(arquivos.length > 1 ? `Preparando foto ${k + 1} de ${arquivos.length}…` : "Preparando a foto…");
    try {
      const { blob, largura, altura } = await prepararFoto(arq);
      const caminho = caminhoNovo(novoNome(prefixo), blob);
      est.fotos[caminho] = blob;
      novas.push({ foto: caminho, largura, altura });
    } catch (e) { aviso(e.message, "erro"); }
  }
  progresso("");
  return novas;
}
const botaoArquivo = (rotulo, { multiplo = true, aoEscolher }) => {
  const id = novoIdCampo();
  return h("span", { class: "arquivo" },
    h("input", { type: "file", id, accept: "image/*", multiple: multiplo, class: "sr",
      onchange: async ev => { const fs = [...ev.target.files]; ev.target.value = ""; if (fs.length) await aoEscolher(fs); } }),
    h("label", { for: id, class: "botao botao--claro" }, rotulo));
};

/* ---------- Componentes de formulário ---------- */
const ING = () => est.conteudo.ingles ??= {};
function autoAltura(t) {
  const ajustar = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + 4 + "px"; };
  t.addEventListener("input", ajustar);
  requestAnimationFrame(ajustar);
}
/* Campo de texto ligado a obj[chave] (obj pode ser uma lista e chave, a posição).
   en: mostra também o campo em inglês (quando "Mostrar inglês" está marcado). */
function campo(rotulo, obj, chave, { area = false, dica, tipo = "text", placeholder, en = true, aoMudar } = {}) {
  const id = novoIdCampo();
  const entrada = area
    ? h("textarea", { id, rows: 2, value: obj[chave] ?? "", placeholder })
    : h("input", { id, type: tipo, value: obj[chave] ?? "", placeholder, autocomplete: "off", spellcheck: tipo === "text" ? "true" : "false" });
  if (!rotulo) entrada.setAttribute("aria-label", placeholder || "texto");
  const avisoEn = h("p", { class: "aviso-en", hidden: true }, "Este texto tem tradução em inglês escrita à mão: confira em “Mostrar inglês”.");
  entrada.addEventListener("input", () => {
    const antes = obj[chave], novo = entrada.value;
    obj[chave] = novo;
    // a tradução feita à mão acompanha o texto enquanto ele é corrigido
    if (en && novo.trim() && ING()[antes] && !ING()[novo]) ING()[novo] = ING()[antes];
    avisoEn.hidden = est.verIngles || !en || !ING()[novo];
    if (enEntrada) enEntrada.placeholder = placeholderEn(novo);
    aoMudar && aoMudar(novo);
    mudou();
  });
  if (area) autoAltura(entrada);
  let enEntrada = null;
  if (en && est.verIngles) {
    const valor = ING()[obj[chave]] ?? "";
    enEntrada = area ? h("textarea", { rows: 2, value: valor }) : h("input", { type: "text", value: valor, autocomplete: "off" });
    enEntrada.setAttribute("aria-label", `${rotulo || placeholder || "texto"}, em inglês`);
    enEntrada.placeholder = placeholderEn(obj[chave]);
    enEntrada.addEventListener("input", () => {
      const pt = obj[chave];
      if (!String(pt ?? "").trim()) return;
      if (enEntrada.value.trim()) ING()[pt] = enEntrada.value; else delete ING()[pt];
      mudou();
    });
    if (area) autoAltura(enEntrada);
  }
  return h("div", { class: "campo" }, rotulo && h("label", { for: id }, rotulo), dica && h("p", { class: "dica" }, dica), entrada,
    enEntrada && h("div", { class: "en" }, enEntrada), avisoEn);
}
const placeholderEn = pt => String(pt ?? "").includes("*") ? "vazio = tradução automática (use o mesmo * e ** do português)" : "vazio = tradução automática";
// Números (dia, mês, número de sorte)
function numero(rotulo, obj, chave, { min, max } = {}) {
  const id = novoIdCampo();
  return h("span", {}, h("label", { for: id }, rotulo), " ",
    h("input", { id, type: "number", min, max, value: obj[chave] ?? "", oninput: ev => { if (ev.target.value !== "") { obj[chave] = Number(ev.target.value); mudou(); } } }));
}
function escolha(rotulo, obj, chave, opcoes, { dica } = {}) {
  const id = novoIdCampo(), atual = obj[chave] ?? "";
  const lista = opcoes.some(([v]) => v === atual) ? opcoes : [...opcoes, [atual, atual]];
  return h("div", { class: "campo campo--curto" }, h("label", { for: id }, rotulo), dica && h("p", { class: "dica" }, dica),
    h("select", { id, onchange: ev => { ev.target.value ? obj[chave] = ev.target.value : delete obj[chave]; mudou(); } },
      lista.map(([v, r]) => h("option", { value: v, selected: v === atual }, r))));
}
const grupo = (rotulo, dica, ...filhos) => h("fieldset", { class: "grupo" }, h("legend", {}, rotulo), dica && h("p", { class: "dica" }, dica), filhos);

// Botões de mover e apagar um item de uma lista.
function controles(lista, k, { rotulo = "item", confirmar, min = 0 } = {}) {
  // preventDefault: dentro do título de um cartão (summary), o clique não abre nem fecha o cartão.
  const mover = (ev, d) => { ev.preventDefault(); const [x] = lista.splice(k, 1); lista.splice(k + d, 0, x); mudou({ redesenhar: true }); };
  return h("span", { class: "controles" },
    h("button", { type: "button", class: "icone", title: "Subir", "aria-label": `Subir ${rotulo}`, disabled: k === 0, onclick: ev => mover(ev, -1) }, "↑"),
    h("button", { type: "button", class: "icone", title: "Descer", "aria-label": `Descer ${rotulo}`, disabled: k === lista.length - 1, onclick: ev => mover(ev, 1) }, "↓"),
    h("button", { type: "button", class: "icone icone--apagar", title: "Apagar", "aria-label": `Apagar ${rotulo}`,
      onclick: ev => {
        ev.preventDefault();
        if (lista.length <= min) return aviso(`Precisa ficar pelo menos ${min}.`);
        if (confirmar && !confirm(confirmar)) return;
        lista.splice(k, 1); mudou({ redesenhar: true });
      } }, "✕"));
}
// Lista de textos curtos ou parágrafos em obj[chave]. Depois de "Adicionar", o cursor vai para o novo.
let focarLista = null;
function textos(rotulo, obj, chave, { dica, area = false, en = true, novo = "Adicionar", rotuloItem = "texto", fixa = false } = {}) {
  const lista = obj[chave] ??= [];
  const linhas = lista.map((_, k) => {
    const c = campo(null, lista, k, { area, en, placeholder: `${rotuloItem} ${k + 1}` });
    return h("div", { class: "linha" }, c, !fixa && controles(lista, k, { rotulo: rotuloItem }));
  });
  if (focarLista === lista && linhas.length) { focarLista = null; requestAnimationFrame(() => $("input, textarea", linhas.at(-1)).focus()); }
  return grupo(rotulo, dica, linhas,
    !fixa && h("button", { type: "button", class: "botao botao--claro", onclick: () => { lista.push(""); focarLista = lista; mudou({ redesenhar: true }); } }, `+ ${novo}`));
}

/* Cartões que abrem e fecham. O miolo só é montado ao abrir (a lista dos 72 anjos fica leve).
   chave: nome único, para o cartão continuar aberto depois de redesenhar. */
const abertos = new Set();
function cartao({ chave, titulo, marca, sub, ctrl, corpo }) {
  const miolo = h("div", { class: "cartao__corpo" });
  const montar = () => { if (!miolo.childElementCount) miolo.append(...[corpo()].flat(Infinity).filter(Boolean)); };
  const d = h("details", { class: "cartao", open: abertos.has(chave),
    ontoggle: () => { if (d.open) { abertos.add(chave); montar(); } else abertos.delete(chave); } },
    h("summary", {}, marca != null && h("span", { class: "marca-item", "aria-hidden": "true" }, marca),
      h("strong", {}, titulo || "(sem nome)", sub && h("small", {}, " · ", sub)), ctrl),
    miolo);
  if (d.open) montar();
  return d;
}
/* Lista de cartões. fixa: a quantidade e a ordem não mudam (o site calcula pela posição). */
function cartoes(lista, { chave, titulo, marca, sub, corpo, fixa = false, novo, rotuloNovo = "Adicionar", rotuloItem = "item", min = 0, confirmar }) {
  return [
    lista.map((it, k) => cartao({ chave: `${chave}-${k}`, titulo: semMarcas(titulo(it, k)), marca: marca && marca(it, k), sub: sub && sub(it, k),
      ctrl: !fixa && controles(lista, k, { rotulo: rotuloItem, min, confirmar: confirmar && confirmar(it) }), corpo: () => corpo(it, k) })),
    !fixa && h("button", { type: "button", class: "botao botao--claro", onclick: () => {
      lista.push(novo()); abertos.add(`${chave}-${lista.length - 1}`); mudou({ redesenhar: true }); focarUltimo(chave);
    } }, `+ ${rotuloNovo}`)
  ];
}
function focarUltimo() {
  requestAnimationFrame(() => {
    const d = [...document.querySelectorAll("#painel details.cartao[open]")].pop();
    if (d) { d.scrollIntoView({ block: "start", behavior: "smooth" }); const i = $(".cartao__corpo input, .cartao__corpo textarea", d); i && i.focus({ preventScroll: true }); }
  });
}
// Caixinha de ajuda (botão "?" ao lado do título)
const ajudaEd = obj => grupo("Caixinha de ajuda (botão “?” ao lado do título)", "Explica como usar esta parte do site.",
  campo("Título da caixinha", obj, "titulo"),
  textos("Passo a passo", obj, "passos", { area: true, novo: "Adicionar passo", rotuloItem: "passo" }),
  campo("Observação no fim", obj, "nota", { area: true }));

// Uma foto só (capa do livro, pintura de uma carta, foto de um animal): obj[chave] = caminho da foto.
function fotoUnica(rotulo, obj, chave, prefixo, { dica, tirar = false } = {}) {
  return grupo(rotulo, dica,
    obj[chave] ? h("div", { class: "foto foto--capa" }, h("div", { class: "foto__img" }, miniatura(obj[chave]), est.fotos[obj[chave]] && h("span", { class: "selo" }, "nova")))
      : h("p", { class: "vazio" }, "Sem foto."),
    h("div", { class: "acoes" },
      botaoArquivo(obj[chave] ? "Trocar a foto" : "+ Enviar foto", { multiplo: false, aoEscolher: async fs => {
        const [n] = await receberFotos(fs, prefixo);
        if (n) { obj[chave] = n.foto; mudou({ redesenhar: true }); }
      } }),
      tirar && obj[chave] && h("button", { type: "button", class: "botao botao--claro", onclick: () => { delete obj[chave]; mudou({ redesenhar: true }); } }, "Tirar a foto")));
}

// Sub-partes de uma aba (chips no alto)
function partes(aba, lista) {
  const atual = est.partes[aba] = lista.some(([id]) => id === est.partes[aba]) ? est.partes[aba] : lista[0][0];
  return [
    h("div", { class: "chips", role: "group", "aria-label": "Escolha a parte" },
      lista.map(([id, rotulo]) => h("button", { type: "button", class: "chip", "aria-pressed": String(id === atual),
        onclick: () => { est.partes[aba] = id; desenharAba(true); } }, rotulo))),
    lista.find(([id]) => id === atual)[2]()
  ];
}

/* ---------- Abas ---------- */
const ABAS = [
  ["inicio", "Início", "#inicio"],
  ["cartas", "Cartas", "#cartas"],
  ["descubra", "Descubra-se", "#descubra"],
  ["animais", "Animais", "#oraculo-animal"],
  ["roda", "Roda do Ano", "#roda"],
  ["casinha", "Casinha", "#casinha"],
  ["panteoes", "Panteões", "#panteoes"],
  ["consultas", "Consultas", "#consultas"],
  ["tryv", "Tryv", "#tryv"],
  ["livro", "Livro e citação", "#livro"],
  ["contato", "Contato", "#contato"]
];
const rotaPrevia = () => ABAS.find(a => a[0] === est.aba)[2];
// Campos que só aparecem no meio de uma frase do site: a frase inteira vai pelo tradutor automático.
const SEM_EN = { en: false };
const ROTULOS_ING = { rosa: "Rosa", lavanda: "Lavanda", alecrim: "Alecrim", arruda: "Arruda", louro: "Louro", mel: "Mel", canela: "Canela", sal: "Sal grosso", camomila: "Camomila", lua: "Água de lua" };
const DICA_MARCAS = "Para destacar: **negrito** ou *itálico*.";
const cabeca = s => [campo("Chamada (texto pequeno acima do título)", s, "chamada"), campo("Título", s, "titulo"), campo("Introdução", s, "intro", { area: true })];
const ZAP = { en: false, area: true, dica: "Mensagem que já aparece escrita no WhatsApp quando a pessoa toca no botão." };

const PAGINAS = {
  inicio() {
    const C = est.conteudo;
    return [
      h("p", { class: "intro" }, "Textos da abertura, do topo e do rodapé. ", DICA_MARCAS),
      grupo("Abertura (a primeira tela, com o logo)", null, campo("Frase", C.abertura, "frase"), campo("Botão", C.abertura, "botao")),
      grupo("Menu do topo", null, h("div", { class: "tres" },
        [["cartas", "Cartas"], ["descubra", "Descubra-se"], ["roda", "Roda do Ano"], ["casinha", "Casinha"], ["panteoes", "Panteões"],
          ["consultas", "Consultas"], ["tryv", "Tryv"], ["livro", "Livro"], ["contato", "Contato"]].map(([k, r]) => campo(r, C.menu, k)))),
      grupo("Começo da página", null,
        campo("Lema (acima do logo)", C.inicio, "lema", { dica: "As palavras em **negrito** ficam douradas." }),
        campo("Título grande", C.inicio, "titulo", { dica: "A palavra em *itálico* fica dourada." }),
        campo("Texto", C.inicio, "texto", { area: true }),
        h("div", { class: "duas" }, campo("Botão das cartas", C.inicio, "botaoCarta"), campo("Botão de agendar", C.inicio, "botaoAgendar")),
        campo("Mensagem do botão de agendar", C.inicio, "mensagemAgendar", ZAP)),
      grupo("Rodapé", null, campo("Frase do rodapé", C.rodape, "frase", { area: true }))
    ];
  },

  cartas() {
    const S = est.conteudo.cartas;
    return [
      h("p", { class: "intro" }, "A mesa de tarô: o baralho em leque e a mensagem de cada carta."),
      grupo("Textos", null, cabeca(S), campo("Aviso embaixo da leitura", S, "aviso", { area: true })),
      ajudaEd(S.ajuda),
      grupo("Os 22 Arcanos Maiores", "São sempre 22, na ordem do tarô (o arcano de nascimento é calculado pela posição). A mensagem também aparece no portal Arcano de nascimento.",
        cartoes(S.arcanos, { chave: "arcano", fixa: true, titulo: a => `${a.num} · ${a.nome}`, marca: a => a.glifo, corpo: a => [
          campo("Nome", a, "nome"),
          campo("Mensagem", a, "msg", { area: true }),
          fotoUnica("Pintura da carta", a, "foto", "carta", { tirar: true, dica: "Foto em pé. Sem pintura, a carta mostra o símbolo abaixo." }),
          campo("Símbolo da carta (sem pintura)", a, "glifo", { en: false, dica: "Um caractere, como ☽ ou ★." })
        ] })),
      fotoUnica("Verso das cartas", S, "verso", "verso", { tirar: true, dica: "O desenho do lado de trás, igual para todas as cartas. Sem foto, aparece o verso roxo com o coração." })
    ];
  },

  descubra() {
    const S = est.conteudo.descubra;
    const NOMES_PORTAIS = { mapa: "Mapa astral", kin: "Kin maia", anjo: "Anjo cabalístico", china: "Horóscopo chinês", arcano: "Arcano de nascimento", totem: "Animal de poder" };
    return partes("descubra", [
      ["textos", "Textos e portais", () => [
        h("p", { class: "intro" }, "Os seis portais que se abrem com a data de nascimento."),
        grupo("Textos", null, cabeca(S), campo("Aviso dentro de cada portal", S, "aviso", { area: true })),
        ajudaEd(S.ajuda),
        grupo("Nome de cada portal", "O nome e a linha pequena embaixo, na carta virada.",
          Object.keys(S.portais).map(k => h("div", { class: "duas" }, campo(NOMES_PORTAIS[k] || k, S.portais[k], "nome"), campo("Linha pequena", S.portais[k], "sub"))))
      ]],
      ["signos", "Signos (mapa astral)", () => [
        h("p", { class: "intro" }, "No mapa astral aparecem três frases: “Sol em Áries: …”, “Lua em Áries: …” e “Ascendente em Áries: …”. Escreva sem ponto final e começando com letra minúscula."),
        cartoes(S.signos, { chave: "signo", fixa: true, titulo: s => s.nome, marca: s => s.glifo, corpo: s => [
          campo("Nome", s, "nome"),
          campo("Sol (o jeito de ser)", s, "sol", { area: true }),
          campo("Lua (as emoções)", s, "lua", { area: true }),
          campo("Ascendente (como chega)", s, "asc", { area: true })
        ] })
      ]],
      ["anjos", "Anjos", () => {
        const A = S.anjos;
        return [
          h("p", { class: "intro" }, "Os 72 anjos estão na ordem do calendário (o primeiro rege 20/03): não dá para mudar a ordem nem a quantidade."),
          grupo("Textos do portal", null, campo("Sobre os 72 nomes", A, "sobre", { area: true }),
            textos("Para quem nasceu num dia dos Gênios da Humanidade", A, "genios", { area: true, fixa: true, rotuloItem: "parágrafo" })),
          grupo("Coros (cada um com 8 anjos, na ordem)", null,
            cartoes(A.coros, { chave: "coro", fixa: true, titulo: c => c.coro, sub: c => c.arcanjo, corpo: c => [campo("Coro", c, "coro", SEM_EN), campo("Arcanjo", c, "arcanjo", SEM_EN)] })),
          grupo("Os 72 anjos", "Dons: escreva com letra minúscula e sem ponto final (aparece como “Dons: …”).",
            cartoes(A.lista, { chave: "anjo", fixa: true, titulo: a => a.nome, marca: (a, k) => k + 1, sub: a => a.dias.split(" · ")[0], corpo: a => [
              campo("Nome", a, "nome", { en: false }),
              campo("Dias que protege", a, "dias", { en: false }),
              h("div", { class: "datas" }, numero("Número de sorte", a, "sorte", { min: 0 })),
              h("div", { class: "duas" }, campo("Carta do tarô", a, "carta", SEM_EN), campo("Salmo", a, "salmo", SEM_EN)),
              campo("Dons", a, "dons", { area: true })
            ] }))
        ];
      }],
      ["kin", "Kin maia", () => {
        const K = S.kin;
        return [
          h("p", { class: "intro" }, "O nome do kin junta selo, tom e cor: “Dragão Magnético Vermelho”. Por isso cada tom e cor tem a forma masculina e a feminina."),
          grupo("Os 20 selos", null, cartoes(K.selos, { chave: "selo", fixa: true, titulo: s => s.nome, marca: (s, k) => k + 1, corpo: s => [
            campo("Nome", s, "nome", SEM_EN),
            escolha("O nome do selo é", s, "g", [["m", "masculino (o Dragão)"], ["f", "feminino (a Noite)"]]),
            h("div", { class: "tres" }, campo("Ação", s, "acao", SEM_EN), campo("Essência", s, "essencia", SEM_EN), campo("Poder", s, "poder", SEM_EN))
          ] })),
          grupo("Os 13 tons", null, cartoes(K.tons, { chave: "tom", fixa: true, titulo: t => t.m, marca: (t, k) => k + 1, corpo: t => [
            h("div", { class: "duas" }, campo("Masculino", t, "m", SEM_EN), campo("Feminino", t, "f", SEM_EN)),
            campo("Tema (o tom do …)", t, "tema", SEM_EN), campo("Ações (que vem para …)", t, "acoes", SEM_EN)
          ] })),
          grupo("As 4 cores", null, cartoes(K.cores, { chave: "corkin", fixa: true, titulo: c => c.m, corpo: c => [
            h("div", { class: "duas" }, campo("Masculino", c, "m", SEM_EN), campo("Feminino", c, "f", SEM_EN)),
            campo("Papel (a cor que …)", c, "papel", SEM_EN)
          ] }))
        ];
      }],
      ["china", "Horóscopo chinês", () => [
        h("p", { class: "intro" }, "Os 12 animais e os 5 elementos seguem a ordem do calendário chinês. O texto aparece depois do nome: “Rato: esperteza, charme…”."),
        grupo("Os 12 animais", null, cartoes(S.china.animais, { chave: "animalch", fixa: true, titulo: a => a.nome, marca: a => a.han, corpo: a => [
          campo("Nome", a, "nome"), campo("Qualidades", a, "texto", { area: true })] })),
        grupo("Os 5 elementos", null, cartoes(S.china.elementos, { chave: "elemento", fixa: true, titulo: e => e.nome, marca: e => e.han, corpo: e => [
          campo("Nome", e, "nome"), campo("Qualidades", e, "texto", { area: true })] }))
      ]],
      ["totens", "Animal de poder (totem)", () => [
        h("p", { class: "intro" }, "Os 12 animais da Roda da Medicina, cada um com o seu período do ano (as datas não mudam aqui)."),
        grupo("Texto do portal", null, campo("Explicação no fim", S.totens, "nota", { area: true })),
        cartoes(S.totens.lista, { chave: "totem", fixa: true, titulo: t => t.nome, marca: t => t.emoji, sub: t => `a partir de ${String(t.dia).padStart(2, "0")}/${String(t.mes).padStart(2, "0")}`, corpo: t => [
          h("div", { class: "duas" }, campo("Nome", t, "nome"), campo("Emoji", t, "emoji", { en: false })),
          h("div", { class: "duas" }, campo("Lua", t, "lua"), campo("Clã elemental", t, "cla")),
          campo("Qualidades", t, "qualidades", { en: false, dica: "Separadas por vírgula e “e”: viram as etiquetas." }),
          campo("Mensagem", t, "mensagem", { area: true }),
          campo("Sombra a cuidar", t, "sombra", { area: true })
        ] })
      ]]
    ]);
  },

  animais() {
    const S = est.conteudo.animais;
    return [
      h("p", { class: "intro" }, "O oráculo dos animais de poder, na seção Descubra-se. A cada tiragem aparecem 9 cartas sorteadas: a lista precisa ter pelo menos 9 animais."),
      grupo("Textos", null, campo("Título", S, "titulo"), campo("Introdução", S, "intro", { area: true })),
      ajudaEd(S.ajuda),
      grupo(`As cartas (${S.cartas.length})`, null,
        cartoes(S.cartas, { chave: "animal", titulo: a => a.nome, marca: a => a.emoji, rotuloNovo: "Novo animal", rotuloItem: "animal", min: 9,
          confirmar: a => `Tirar ${a.nome || "este animal"} do oráculo?`,
          novo: () => ({ nome: "", emoji: "🐾", medicina: "", mensagem: "", pergunta: "" }), corpo: a => [
            h("div", { class: "duas" }, campo("Nome", a, "nome"), campo("Emoji", a, "emoji", { en: false })),
            campo("Medicina (o ensinamento)", a, "medicina"),
            campo("Mensagem", a, "mensagem", { area: true }),
            campo("Para refletir (pergunta)", a, "pergunta", { area: true }),
            fotoUnica("Foto do animal", a, "foto", "animal", { tirar: true, dica: "Foto em pé. Sem foto, a carta mostra o emoji." })
          ] }))
    ];
  },

  roda() {
    const S = est.conteudo.roda;
    const corpo = s => [
      h("div", { class: "duas" }, campo("Nome", s, "nome"), campo("Emoji", s, "emoji", { en: false })),
      h("div", { class: "duas" }, campo("Tipo", s, "tipo", { dica: "Ex.: Festa do fogo, Solstício de inverno." }), campo("Outros nomes", s, "outros")),
      h("div", { class: "duas" }, campo("Data no Sul (como aparece)", s, "dataS"), campo("Data no Norte (como aparece)", s, "dataN")),
      h("p", { class: "dica" }, "Lugar na roda (dia e mês). Também decide qual festa está “em vigor” hoje."),
      h("div", { class: "datas" }, "Sul:", numero("dia", s.sul, 0, { min: 1, max: 31 }), numero("mês", s.sul, 1, { min: 1, max: 12 }),
        " Norte:", numero("dia", s.norte, 0, { min: 1, max: 31 }), numero("mês", s.norte, 1, { min: 1, max: 12 })),
      campo("Tema (frase em destaque)", s, "tema", { area: true }),
      campo("Texto", s, "texto", { area: true }),
      grupo("Cores", null, s.cores.map((c, k) => h("div", { class: "cor" },
        h("input", { type: "color", value: c[1], "aria-label": `Tom da cor ${k + 1}`, oninput: ev => { c[1] = ev.target.value; mudou(); } }),
        campo(null, c, 0, { placeholder: "nome da cor", en: false }),
        controles(s.cores, k, { rotulo: "cor" }))),
        h("button", { type: "button", class: "botao botao--claro", onclick: () => { s.cores.push(["", "#f2c14e"]); mudou({ redesenhar: true }); } }, "+ Adicionar cor")),
      [["ervas", "Ervas e flores"], ["cristais", "Cristais"], ["itens", "Itens mágicos"], ["comidas", "Comidas"], ["bebidas", "Bebidas"],
        ["decoracao", "Decoração"], ["praticas", "Práticas"], ["divindades", "Divindades"]].map(([k, r]) => campo(r, s, k, { area: true }))
    ];
    return [
      h("p", { class: "intro" }, "Os oito sabbats. A ordem e a quantidade não mudam; o lugar de cada um na roda vem do dia e do mês."),
      grupo("Textos", null, cabeca(S)),
      ajudaEd(S.ajuda),
      grupo("Nota de cada roda (aparece ao escolher a roda)", null,
        campo("Hemisfério Sul", S.notas, "sul", { area: true }), campo("Hemisfério Norte", S.notas, "norte", { area: true }), campo("Mista", S.notas, "mista", { area: true })),
      grupo("Os sabbats", null, cartoes(S.sabbats, { chave: "sabbat", fixa: true, titulo: s => s.nome, marca: s => s.emoji, sub: s => s.tipo, corpo }))
    ];
  },

  casinha() {
    const S = est.conteudo.casinha;
    const canto = (c, chave, campos, novo, extra) => [
      grupo("Textos do pergaminho", null, campo("Título", c, "titulo"), campo("Subtítulo", c, "sub", { area: true }), campo("Nota no fim", c, "nota", { area: true })),
      grupo(`Itens (${c.itens.length})`, null, cartoes(c.itens, { chave, titulo: i => i.nome, marca: extra && (i => h("span", { style: `color:${i.cor}` }, "⬢")), rotuloNovo: "Novo item", rotuloItem: "item",
        confirmar: i => `Apagar ${i.nome || "este item"}?`, novo, corpo: i => [
          extra && h("div", { class: "cor" }, h("input", { type: "color", value: i.cor, "aria-label": "Cor do cristal", oninput: ev => { i.cor = ev.target.value; mudou(); } }), h("span", { class: "dica" }, "Cor do cristal")),
          campos.map(([k, r, area]) => campo(r, i, k, { area }))
        ] }))
    ];
    const INTENCOES = { amor: "Amor", prosperidade: "Prosperidade", protecao: "Proteção", calma: "Calma", limpeza: "Limpeza", alegria: "Alegria", caos: "Caos (quando mistura intenções demais)" };
    return partes("casinha", [
      ["textos", "Textos", () => [
        h("p", { class: "intro" }, "A casinha da Tryv: o texto da seção e a caixinha de ajuda. Os quatro cantos e as poções estão nos botões acima."),
        grupo("Textos", null, cabeca(S)), ajudaEd(S.ajuda)
      ]],
      ["ervas", "Ervas", () => canto(S.ervas, "erva", [["nome", "Nome"], ["para", "Para que serve"], ["dica", "Como usar", true]], () => ({ nome: "", para: "", dica: "" }))],
      ["chas", "Chás", () => canto(S.chas, "cha", [["nome", "Nome"], ["quando", "Para quando"], ["preparo", "Preparo", true]], () => ({ nome: "", quando: "", preparo: "" }))],
      ["magias", "Magias", () => canto(S.magias, "magia", [["nome", "Nome"], ["precisa", "Você vai precisar de", true], ["como", "Como fazer", true]], () => ({ nome: "", precisa: "", como: "" }))],
      ["cristais", "Cristais", () => canto(S.cristais, "cristal", [["nome", "Nome"], ["palavras", "Palavras-chave"], ["texto", "Texto", true]], () => ({ nome: "", cor: "#b9a3ff", palavras: "", texto: "" }), true)],
      ["pocoes", "Caldeirão", () => [
        h("p", { class: "intro" }, "Cada ingrediente puxa para uma ou duas intenções; a poção sai da intenção mais forte (ou das duas mais fortes juntas)."),
        grupo("Nome dos ingredientes", null, h("div", { class: "duas" }, Object.keys(S.ingredientes).map(id => campo(ROTULOS_ING[id] || id, S.ingredientes, id)))),
        grupo("Texto embaixo da poção", null, campo(null, S, "pocaoNota", { area: true, placeholder: "nota" })),
        grupo("As poções", null, cartoes(Object.keys(S.pocoes), { chave: "pocao", fixa: true,
          titulo: k => S.pocoes[k].nome, sub: k => k.split("+").map(x => INTENCOES[x] || x).join(" + "), corpo: k => [
            campo("Nome da poção", S.pocoes[k], "nome"),
            campo("O que ela faz", S.pocoes[k], "texto", { area: true }),
            campo("Magia leve para levar", S.pocoes[k], "ritual", { area: true })
          ] }))
      ]]
    ]);
  },

  panteoes() {
    const S = est.conteudo.panteoes;
    const deus = () => ({ nome: "", simbolo: "✦", dominio: "", simbolos: "", oferendas: "", texto: "" });
    return [
      h("p", { class: "intro" }, "Os povos (abas) e as divindades de cada um."),
      grupo("Textos", null, cabeca(S), campo("Aviso embaixo", S, "aviso", { area: true })),
      ajudaEd(S.ajuda),
      grupo("Os panteões", null, cartoes(S.lista, { chave: "panteao", titulo: p => p.nome, marca: p => p.emoji, rotuloNovo: "Novo panteão", rotuloItem: "panteão", min: 1,
        confirmar: p => `Apagar o panteão ${p.nome || ""} inteiro, com todas as divindades?`,
        novo: () => ({ id: `p${Date.now().toString(36)}`, nome: "", emoji: "✦", intro: "", grupos: [{ titulo: "", deuses: [deus()] }] }),
        corpo: (p, kp) => [
          h("div", { class: "duas" }, campo("Nome (na aba)", p, "nome"), campo("Emoji", p, "emoji", { en: false })),
          campo("Introdução", p, "intro", { area: true }),
          p.grupos.map((g, kg) => grupo(p.grupos.length > 1 ? `Grupo ${kg + 1}` : "Divindades", null,
            campo("Título do grupo", g, "titulo", { dica: p.grupos.length > 1 ? null : "Deixe vazio quando o panteão tem um grupo só." }),
            cartoes(g.deuses, { chave: `deus-${kp}-${kg}`, titulo: d => d.nome, marca: d => d.simbolo, sub: d => d.dominio, rotuloNovo: "Nova divindade", rotuloItem: "divindade",
              confirmar: d => `Apagar ${d.nome || "esta divindade"}?`, novo: deus, corpo: d => [
                h("div", { class: "duas" }, campo("Nome", d, "nome"), campo("Símbolo (emoji)", d, "simbolo", { en: false })),
                campo("Domínio", d, "dominio"),
                campo("Texto", d, "texto", { area: true }),
                campo("Símbolos", d, "simbolos", { area: true }),
                campo("Oferendas", d, "oferendas", { area: true })
              ] }),
            p.grupos.length > 1 && h("div", { class: "acoes" }, h("button", { type: "button", class: "botao botao--texto", onclick: () => {
              if (!confirm("Apagar este grupo e as divindades dele?")) return;
              p.grupos.splice(kg, 1); mudou({ redesenhar: true });
            } }, "Apagar este grupo")))),
          h("button", { type: "button", class: "botao botao--claro", onclick: () => { p.grupos.push({ titulo: "", deuses: [deus()] }); mudou({ redesenhar: true }); } }, "+ Novo grupo neste panteão")
        ] }))
    ];
  },

  consultas() {
    const S = est.conteudo.consultas;
    const ICONES = [["cartas", "Cartas"], ["bussola", "Bússola (4 elementos)"], ["vela", "Vela"], ["espiral", "Espiral"], ["mao", "Mão (Reiki)"], ["livro", "Livro"]];
    return [
      h("p", { class: "intro" }, "Os cartões das consultas e terapias. ", DICA_MARCAS),
      grupo("Textos", null, cabeca(S)),
      grupo("Os cartões", null, cartoes(S.servicos, { chave: "servico", titulo: s => s.titulo, rotuloNovo: "Nova consulta", rotuloItem: "cartão",
        confirmar: s => `Tirar “${semMarcas(s.titulo) || "este cartão"}” do site?`,
        novo: () => ({ icone: "cartas", titulo: "", texto: "", etiquetas: [], botao: "Quero essa", mensagem: "Olá, Tryv! Quero saber mais sobre … ✨" }), corpo: s => [
          campo("Título", s, "titulo"),
          campo("Texto", s, "texto", { area: true }),
          textos("Etiquetas", s, "etiquetas", { novo: "Adicionar etiqueta", rotuloItem: "etiqueta" }),
          h("div", { class: "duas" }, campo("Botão", s, "botao"), escolha("Desenho", s, "icone", ICONES)),
          campo("Mensagem do botão", s, "mensagem", ZAP)
        ] }))
    ];
  },

  tryv() {
    const S = est.conteudo.tryv;
    const POSICOES = [["", "Centro"], ["50% 15%", "Mostrar mais o alto"], ["50% 30%", "Um pouco para cima"], ["50% 70%", "Um pouco para baixo"], ["30% 50%", "Mais para a esquerda"], ["70% 50%", "Mais para a direita"]];
    const entrada = h("input", { type: "url", id: "novo-video", placeholder: "https://www.youtube.com/watch?v=…" });
    const adicionar = () => {
      const id = idYouTube(entrada.value);
      if (!id) return aviso("Não reconheci esse link. Copie o endereço do vídeo no YouTube (botão Compartilhar).", "erro");
      if (S.videos.some(v => v.id === id)) return aviso("Esse vídeo já está na lista.", "erro");
      S.videos.unshift({ id, titulo: "" });
      mudou({ redesenhar: true });
      aviso("Vídeo adicionado no começo da lista.");
    };
    return [
      h("p", { class: "intro" }, "A seção sobre a Tryv: o espelho com as fotos, o texto e os vídeos."),
      grupo("Fotos do espelho", "Giram no espelho redondo, na ordem da lista. A descrição é lida para quem não enxerga.",
        S.fotos.length ? h("ol", { class: "fotos" }, S.fotos.map((f, k) => h("li", { class: "foto" },
          h("div", { class: "foto__img" }, miniatura(f.foto, "", f.posicao ? `object-position:${f.posicao}` : null), est.fotos[f.foto] && h("span", { class: "selo" }, "nova")),
          campo("Descrição da foto", f, "alt", { area: true, en: false }),
          escolha("Enquadramento", f, "posicao", POSICOES, {}),
          controles(S.fotos, k, { rotulo: "foto", min: 1, confirmar: "Tirar esta foto do espelho?" }))))
        : h("p", { class: "vazio" }, "Nenhuma foto ainda."),
        h("div", { class: "acoes" }, botaoArquivo("+ Enviar fotos", { aoEscolher: async fs => {
          const novas = await receberFotos(fs, "tryv");
          if (!novas.length) return;
          S.fotos.push(...novas.map(n => ({ ...n, alt: "Tryv" })));
          mudou({ redesenhar: true });
          aviso("Foto pronta. Escreva uma descrição curta dela.");
        } }))),
      grupo("Textos", null,
        campo("Chamada (texto pequeno acima do nome)", S, "chamada"), campo("Título", S, "titulo"),
        campo("Frase em destaque", S, "destaque", { area: true }), campo("Texto", S, "texto", { area: true }),
        textos("As muitas Tryvs (etiquetas)", S, "personas", { novo: "Adicionar", rotuloItem: "etiqueta" }),
        campo("Texto depois das etiquetas", S, "fecho", { area: true }),
        campo("Botão do espelho", S, "botaoEspelho")),
      grupo("Vídeos do YouTube", "Aparecem embaixo do texto da Tryv. Sem nenhum vídeo, essa parte não aparece no site.",
        campo("Título dos vídeos", S, "videosTitulo"),
        h("div", { class: "campo novo-video" }, h("label", { for: "novo-video" }, "Link do vídeo no YouTube"),
          h("div", { class: "linha" }, entrada, h("button", { type: "button", class: "botao", onclick: adicionar }, "Adicionar"))),
        h("ol", { class: "videos" }, S.videos.map((v, k) => h("li", { class: "video" },
          h("img", { src: `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/mqdefault.jpg`, alt: "", loading: "lazy" }),
          h("div", {},
            campo("Legenda (opcional)", v, "titulo"),
            h("a", { href: `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`, target: "_blank", rel: "noopener", class: "link" }, "Abrir no YouTube")),
          controles(S.videos, k, { rotulo: "vídeo", confirmar: "Tirar este vídeo do site?" })))))
    ];
  },

  livro() {
    const S = est.conteudo.livro, Q = est.conteudo.citacao;
    return [
      h("p", { class: "intro" }, "O livro O Multiverso e a citação que aparece antes dele."),
      grupo("Citação (as palavras acendem uma a uma)", null, campo("Citação", Q, "texto", { area: true }), campo("Autor", Q, "autor", { en: false })),
      grupo("Textos ao lado do livro", null,
        campo("Chamada", S, "chamada"), campo("Título", S, "titulo"), campo("Subtítulo", S, "subtitulo"),
        campo("Texto", S, "texto", { area: true }), campo("Dica", S, "dica"),
        campo("Botão", S, "botao"), campo("Mensagem do botão", S, "mensagem", ZAP)),
      fotoUnica("Capa", S, "capa", "livro-capa", { dica: "A foto da capa do livro 3D." }),
      grupo("Dentro do livro (ao abrir)", null,
        campo("Frase da orelha", S, "orelhaFrase"), campo("Texto da orelha", S, "orelha", { area: true }),
        campo("Texto da contracapa", S, "contracapa", { area: true })),
      ajudaEd(S.ajuda)
    ];
  },

  contato() {
    const S = est.conteudo.contato, M = est.conteudo.musica;
    return [
      h("p", { class: "intro" }, "Contato, WhatsApp, redes sociais e a música."),
      grupo("Textos", null, cabeca(S)),
      grupo("Passo a passo", null, cartoes(S.passos, { chave: "passo", titulo: p => p.titulo, marca: (p, k) => k + 1, rotuloNovo: "Novo passo", rotuloItem: "passo",
        novo: () => ({ titulo: "", texto: "" }), corpo: p => [campo("Título", p, "titulo"), campo("Texto", p, "texto", { area: true })] })),
      grupo("WhatsApp e e-mail", null,
        campo("Número do WhatsApp", S, "whatsapp", { en: false, tipo: "tel", dica: "Só números, com 55 e o DDD (ex.: 5551999999999). Vale para todos os botões do site." }),
        campo("Número como aparece no botão", S, "telefone", { en: false }),
        campo("Mensagem do botão do WhatsApp", S, "mensagem", ZAP),
        campo("E-mail", S, "email", { en: false, tipo: "email" })),
      grupo("Redes sociais", "Deixe vazio para esconder o ícone.",
        [["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["spotify", "Spotify (perfil)"]].map(([k, r]) => campo(r, S, k, { en: false, tipo: "url" }))),
      grupo("Música (botão ♪ no canto da tela)", null,
        campo("Título", M, "titulo"), campo("Texto", M, "texto", { area: true }),
        campo("Link da playlist no Spotify", M, "playlist", { en: false, tipo: "url",
          dica: "No Spotify: na playlist, Compartilhar > Copiar link. Sem playlist, o botão leva ao perfil do Spotify." }))
    ];
  }
};

// Aceita youtu.be/ID, watch?v=ID, shorts/ID, embed/ID, live/ID ou o ID sozinho.
function idYouTube(texto) {
  const t = texto.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (/(^|\.)youtu\.be$/.test(u.hostname)) return u.pathname.slice(1, 12) || null;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      return m ? m[1] : null;
    }
  } catch {}
  return null;
}

/* ---------- Desenho da tela ---------- */
function desenharAba(topo = false) {
  const painel = $("#painel"), y = scrollY;
  painel.replaceChildren(...[PAGINAS[est.aba]()].flat(Infinity).filter(Boolean));
  document.querySelectorAll("[data-aba]").forEach(b => b.setAttribute("aria-current", String(b.dataset.aba === est.aba)));
  scrollTo(0, topo ? 0 : y);
}

function barra() {
  const s = $("#situacao"), pub = $("#publicar"), desc = $("#descartar");
  s.textContent = est.alterado ? "Mudanças ainda não publicadas" : "Tudo publicado";
  s.classList.toggle("situacao--pendente", est.alterado);
  pub.disabled = !est.alterado;
  desc.hidden = !est.alterado;
}

function montar() {
  app.replaceChildren(
    h("header", { class: "topo" },
      h("div", { class: "topo__linha" },
        h("a", { href: "./", class: "marca" }, "Bem Dito Tarot"),
        h("span", { class: "topo__titulo" }, "Configurações"),
        h("span", { id: "situacao", class: "situacao", role: "status" })),
      h("div", { class: "topo__acoes" },
        h("button", { type: "button", class: "botao botao--claro", onclick: previa }, "Ver prévia"),
        h("button", { type: "button", id: "publicar", class: "botao botao--publicar", onclick: publicar }, "Publicar"),
        h("button", { type: "button", id: "descartar", class: "botao botao--texto", onclick: descartar }, "Descartar mudanças"),
        h("label", { class: "marcar-en" }, h("input", { type: "checkbox", checked: est.verIngles, onchange: ev => {
          est.verIngles = ev.target.checked;
          try { localStorage.setItem(VER_INGLES, est.verIngles ? "1" : "0"); } catch {}
          desenharAba();
        } }), "Mostrar inglês")),
      h("nav", { class: "abas", "aria-label": "Partes do site" },
        ABAS.map(([id, rotulo]) => h("button", { type: "button", class: "aba", "data-aba": id, onclick: () => { est.aba = id; desenharAba(true); } }, rotulo)))),
    h("main", { id: "painel" }),
    h("footer", { class: "pe" },
      h("p", { class: "intro" }, "Com “Mostrar inglês” marcado, cada texto ganha um campo em inglês logo abaixo. Vazio, o site usa a tradução automática do Google. Alguns campos não têm inglês porque aparecem no meio de uma frase do site: ali o Google traduz a frase inteira."),
      h("button", { type: "button", class: "botao botao--texto", onclick: sair }, "Sair deste aparelho")));
  barra();
  desenharAba();
}

/* ---------- Ações ---------- */
async function previa() {
  await guardar();
  location.href = `./?previa${rotaPrevia()}`;
}

function descartar() {
  if (!confirm("Descartar tudo o que foi mudado desde a última publicação?")) return;
  est.conteudo = clonar(est.publicado);
  est.fotos = {};
  est.alterado = false;
  apagarRascunho().catch(() => {});
  barra(); desenharAba();
  aviso("Mudanças descartadas. Esta é a versão que está no site.");
}

function sair() {
  if (est.alterado && !confirm("Há mudanças não publicadas. Elas ficam guardadas neste aparelho. Sair mesmo assim?")) return;
  try { localStorage.removeItem(CHAVE_LOCAL); } catch {}
  location.href = "./";
}

const NOMES_PARTES = {
  abertura: "Abertura", menu: "Menu", inicio: "Início", cartas: "Cartas", descubra: "Descubra-se", animais: "Animais", roda: "Roda do Ano",
  casinha: "Casinha", panteoes: "Panteões", consultas: "Consultas", tryv: "Tryv", citacao: "Citação", livro: "Livro", contato: "Contato",
  rodape: "Rodapé", musica: "Música", ingles: "Inglês"
};
// Partes que mudaram, para a mensagem do commit.
function resumoMudancas() {
  return Object.keys(NOMES_PARTES).filter(k => JSON.stringify(est.conteudo[k]) !== JSON.stringify(est.publicado[k])).map(k => NOMES_PARTES[k]);
}

// Traduções de textos que não existem mais (foram corrigidos ou apagados) saem do arquivo.
function limparIngles() {
  const usados = new Set();
  const percorrer = o => {
    if (typeof o === "string") usados.add(o);
    else if (o && typeof o === "object") Object.values(o).forEach(percorrer);
  };
  for (const [k, v] of Object.entries(est.conteudo)) if (k !== "ingles") percorrer(v);
  const ing = ING();
  for (const k of Object.keys(ing)) if (!usados.has(k) || !String(ing[k]).trim()) delete ing[k];
}

// Conferências antes de publicar: o que deixaria uma parte do site quebrada.
function problemas() {
  const C = est.conteudo, p = [];
  if (C.animais.cartas.length < 9) p.push("o oráculo dos animais precisa de pelo menos 9 animais");
  if (!C.tryv.fotos.length) p.push("o espelho precisa de pelo menos uma foto");
  if (!C.panteoes.lista.length) p.push("precisa haver pelo menos um panteão");
  if (!String(C.contato.whatsapp).replace(/\D/g, "")) p.push("falta o número do WhatsApp");
  return p;
}

// Troca um caminho de foto em todo o conteúdo (quando o nome já foi usado por outra publicação).
function renomearFoto(antigo, novo) {
  const trocar = o => {
    for (const [k, v] of Object.entries(o)) {
      if (v === antigo) o[k] = novo;
      else if (v && typeof v === "object") trocar(v);
    }
  };
  trocar(est.conteudo);
  est.fotos[novo] = est.fotos[antigo]; delete est.fotos[antigo];
  if (est.urls[antigo]) { est.urls[novo] = est.urls[antigo]; delete est.urls[antigo]; }
}

async function publicar() {
  if (!est.alterado) return;
  const p = problemas();
  if (p.length) return aviso(`Antes de publicar: ${p.join("; ")}.`, "erro");
  progresso("Conferindo o site…");
  try {
    const shaAgora = await est.gh.shaConteudo();
    if (shaAgora !== est.base && !confirm("O site foi atualizado por outra pessoa depois que você começou a editar. Se publicar, as suas mudanças substituem as dela. Publicar mesmo assim?")) return;

    limparIngles();
    // Só as fotos novas que continuam em uso; se um nome já existir no site, ganha outro número.
    const json = () => JSON.stringify(est.conteudo);
    est.nomes = new Set((await est.gh.listarFotos()).map(n => n.replace(/\.[^.]+$/, ""))); est.listou = true;
    for (const caminho of Object.keys(est.fotos)) {
      if (!json().includes(JSON.stringify(caminho))) { delete est.fotos[caminho]; continue; }
      const nome = nomeDe(caminho);
      if (est.nomes.has(nome)) renomearFoto(caminho, caminhoNovo(novoNome(nome.replace(/-[^-]+$/, "")), est.fotos[caminho]));
    }
    const novas = Object.keys(est.fotos);
    const texto = JSON.stringify(est.conteudo, null, 2) + "\n";
    const arquivos = [{ caminho: ARQUIVO, texto }, ...novas.map(caminho => ({ caminho, blob: est.fotos[caminho] }))];
    const partesMudadas = resumoMudancas();
    const mensagem = `Configurações: ${partesMudadas.length ? partesMudadas.join(", ") : "ajustes"}${novas.length ? ` (${novas.length} ${novas.length > 1 ? "fotos novas" : "foto nova"})` : ""}\n\nPublicado pela tela Configurações do site.`;
    const shas = await est.gh.publicar(arquivos, mensagem, progresso);

    est.base = shas[ARQUIVO];
    est.publicado = clonar(est.conteudo);
    novas.forEach(c => est.nomes.add(nomeDe(c)));
    est.fotos = {};
    est.alterado = false;
    await apagarRascunho().catch(() => {});
    barra(); desenharAba();
    esperarNoAr(texto);
  } catch (e) {
    console.error(e);
    aviso(mensagemErro(e), "erro");
  } finally { progresso(""); }
}

// Depois de publicar, confere de 5 em 5 segundos se o site já mostra o conteúdo novo.
async function esperarNoAr(texto) {
  const el = h("div", { class: "aviso aviso--ok", role: "status" }, "Publicado! O site leva cerca de um minuto para atualizar…");
  $("#avisos").append(el);
  const limite = Date.now() + 4 * 60e3;
  while (Date.now() < limite) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const r = await fetch(`${ARQUIVO}?t=${Date.now()}`, { cache: "no-store" });
      if (r.ok && (await r.text()) === texto) {
        el.replaceChildren("Pronto, já está no ar! ", h("a", { href: `./${rotaPrevia()}`, class: "link" }, "Ver o site"),
          h("button", { class: "aviso__fechar", "aria-label": "Fechar aviso", onclick: () => el.remove() }, "×"));
        return;
      }
    } catch {}
  }
  el.textContent = "Publicado. Se o site ainda não mostrar a mudança, recarregue a página daqui a alguns minutos.";
  setTimeout(() => el.remove(), 15000);
}

/* ---------- Entrada ---------- */
function telaEntrada(erro) {
  const ent = h("input", { type: "password", id: "chave", autocomplete: "current-password", required: true, spellcheck: "false" });
  app.replaceChildren(h("main", { class: "entrada" },
    h("h1", {}, "Configurações do site"),
    h("p", {}, "Aqui você muda os textos, as fotos e os vídeos do Bem Dito Tarot. Para entrar, cole a chave de acesso que o Rafa te passou. Este aparelho vai lembrar dela."),
    erro && h("p", { class: "aviso aviso--erro", role: "alert" }, erro),
    h("form", { onsubmit: async ev => {
      ev.preventDefault();
      const chave = ent.value.trim();
      if (!chave) return;
      const gh = cliente(chave);
      progresso("Conferindo a chave…");
      try { await gh.testar(); }
      catch (e) { progresso(""); return telaEntrada(mensagemErro(e)); }
      progresso("");
      try { localStorage.setItem(CHAVE_LOCAL, chave); } catch {}
      iniciar(gh);
    } },
      h("label", { for: "chave" }, "Chave de acesso"), ent,
      h("button", { class: "botao" }, "Entrar")),
    h("p", {}, h("a", { href: "./", class: "link" }, "Voltar ao site"))));
  ent.focus();
}

async function iniciar(gh) {
  est.gh = gh;
  progresso("Abrindo o conteúdo do site…");
  try {
    const [remoto, rascunho, nomes] = await Promise.all([
      gh.lerConteudo(),
      lerRascunho().catch(() => null),
      gh.listarFotos().catch(() => null)
    ]);
    est.publicado = remoto.conteudo;
    if (nomes) { est.nomes = new Set(nomes.map(n => n.replace(/\.[^.]+$/, ""))); est.listou = true; }
    if (rascunho && rascunho.alterado) {
      Object.assign(est, { conteudo: rascunho.conteudo, fotos: rascunho.fotos || {}, base: rascunho.base, alterado: true });
      montar();
      aviso(rascunho.base !== remoto.sha
        ? "Você tem mudanças guardadas neste aparelho, mas o site foi atualizado depois. Confira antes de publicar, ou descarte para começar da versão nova."
        : "Continuando de onde você parou: há mudanças ainda não publicadas.");
    } else {
      Object.assign(est, { conteudo: clonar(remoto.conteudo), base: remoto.sha, alterado: false });
      montar();
    }
  } catch (e) {
    console.error(e);
    if (e instanceof ErroGitHub && e.status === 401) {
      try { localStorage.removeItem(CHAVE_LOCAL); } catch {}
      return telaEntrada(mensagemErro(e));
    }
    app.replaceChildren(h("main", { class: "entrada" }, h("h1", {}, "Não consegui abrir"), h("p", { class: "aviso aviso--erro" }, mensagemErro(e)),
      h("button", { class: "botao", onclick: () => location.reload() }, "Tentar de novo")));
  } finally { progresso(""); }
}

let chave = null;
try { chave = localStorage.getItem(CHAVE_LOCAL); } catch {}
chave ? iniciar(cliente(chave)) : telaEntrada();
