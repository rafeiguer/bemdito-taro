/* Rascunho da tela Configurações, guardado no IndexedDB deste navegador: o conteúdo em edição,
   as fotos novas (ainda não publicadas, pelo caminho que vão ter no site) e o sha do conteudo.json
   de onde a edição partiu. Sobrevive a fechar a aba; a prévia (index.html?previa) lê daqui. */
const BANCO = "bemdito-configuracoes", LOJA = "rascunho", CHAVE = "atual";

function abrir() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

async function operar(modo, fazer) {
  const db = await abrir();
  try {
    return await new Promise((ok, erro) => {
      const tx = db.transaction(LOJA, modo), req = fazer(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(req.result);
      tx.onerror = tx.onabort = () => erro(tx.error);
    });
  } finally { db.close(); }
}

/* As fotos são guardadas como bytes (ArrayBuffer) e voltam como Blob: alguns WebKit recusam Blob no IndexedDB. */
const fotosEmBytes = async fotos => Object.fromEntries(await Promise.all(Object.entries(fotos || {}).map(async ([caminho, b]) =>
  [caminho, { tipo: b.type, bytes: await b.arrayBuffer() }])));
const fotosEmBlob = fotos => Object.fromEntries(Object.entries(fotos || {}).map(([caminho, f]) =>
  [caminho, new Blob([f.bytes], { type: f.tipo })]));

// { conteudo, fotos: { caminho: Blob }, base, alterado } ou null
export const lerRascunho = () => operar("readonly", loja => loja.get(CHAVE)).then(r => r ? { ...r, fotos: fotosEmBlob(r.fotos) } : null);
export async function gravarRascunho(r) {
  const fotos = await fotosEmBytes(r.fotos);
  return operar("readwrite", loja => loja.put({ ...r, fotos }, CHAVE));
}
export const apagarRascunho = () => operar("readwrite", loja => loja.delete(CHAVE));
