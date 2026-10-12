/* Prepara fotos no próprio navegador: WebP com até 1200 px de largura (sem aumentar foto pequena),
   girada como o celular tirou e sem metadados (o canvas não copia EXIF nem GPS). O Safari não grava
   WebP pelo canvas; nele, um codificador WebP em WebAssembly é baixado só na primeira foto. */
const LARGURA = 1200;
// O codec do jsquash direto (o encode.js do pacote importa um módulo pelo nome, que o navegador não resolve).
const WASM_WEBP = "https://cdn.jsdelivr.net/npm/@jsquash/webp@1.4.0/";

// Reduz pela metade até chegar perto da largura final: um passo só, de 4000 para 1200 px, serrilha.
function reduzir(fonte, largura) {
  let w = fonte.naturalWidth || fonte.width, h = fonte.naturalHeight || fonte.height, atual = fonte;
  const alvoW = Math.min(largura, w), alvoH = Math.round(h * alvoW / w);
  while (w / 2 >= alvoW * 1.5) {
    w = Math.round(w / 2); h = Math.round(h / 2);
    atual = desenhar(atual, w, h);
  }
  return desenhar(atual, alvoW, alvoH);
}
function desenhar(fonte, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);   // PNG com transparência: fundo branco
  ctx.drawImage(fonte, 0, 0, w, h);
  return c;
}

let wasm = null;
async function webp(canvas, qualidade) {
  const b = await new Promise(ok => canvas.toBlob(ok, "image/webp", qualidade));
  if (b && b.type === "image/webp") return b;
  try {
    wasm ??= Promise.all([import(WASM_WEBP + "codec/enc/webp_enc.js"), import(WASM_WEBP + "meta.js")])
      .then(async ([codec, meta]) => ({ modulo: await codec.default({ noInitialRun: true }), opcoes: meta.defaultOptions }));
    const { modulo, opcoes } = await wasm;
    const dados = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    const saida = modulo.encode(dados.data, dados.width, dados.height, { ...opcoes, quality: Math.round(qualidade * 100) });
    if (!saida) throw new Error("falha ao codificar");
    return new Blob([saida.buffer], { type: "image/webp" });
  } catch (e) {
    wasm = null;
    console.warn("WebP em WebAssembly indisponível; gravando JPEG (o navegador abre igual)", e);
    return new Promise(ok => canvas.toBlob(ok, "image/jpeg", qualidade));
  }
}

// Foto (JPG, PNG, WebP; HEIC só onde o navegador abre) -> { blob, largura, altura }
export async function prepararFoto(arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    try { await img.decode(); }
    catch { throw new Error(`Não consegui abrir “${arquivo.name}”. Envie a foto em JPG ou PNG.`); }
    const c = reduzir(img, LARGURA);
    return { blob: await webp(c, 0.82), largura: c.width, altura: c.height };
  } finally { URL.revokeObjectURL(url); }
}
