"""Leva as imagens geradas (saida/*.png) para assets/ no tamanho e formato do site.

Uso (com o Python do gerador da Tenda Cigana, que tem Pillow e rembg):
  python preparar_imagens.py

ESCOLHAS diz qual semente ficou melhor quando houve mais de uma. Gatos e ingredientes perdem o fundo (rembg).
"""
from pathlib import Path
from PIL import Image

AQUI = Path(__file__).parent
SAIDA = AQUI / "saida"
ASSETS = AQUI.parent.parent / "assets"
ESCOLHAS = {"verso": "verso-22", "fora": "fora-31", "dentro": "dentro-42", "arcano-03": "arcano-03-13", "arcano-07": "arcano-07-13",
            "gato-sentado": "gato-sentado-62", "gato-andando": "gato-andando-72", "gato-dormindo": "gato-dormindo-81"}


def abrir(nome):
    return Image.open(SAIDA / f"{nome}.png").convert("RGB")


def proporcao(img, w_h):
    """Corta o excesso (no meio) para a proporção largura/altura pedida."""
    w, h = img.size
    if w / h > w_h:
        nw = round(h * w_h); x = (w - nw) // 2
        return img.crop((x, 0, x + nw, h))
    nh = round(w / w_h); y = (h - nh) // 2
    return img.crop((0, y, w, y + nh))


def gravar(img, destino, largura=None, qualidade=82):
    destino.parent.mkdir(parents=True, exist_ok=True)
    if largura and img.width != largura:
        img = img.resize((largura, round(img.height * largura / img.width)), Image.LANCZOS)
    img.save(destino, "WEBP", quality=qualidade, method=6)
    print(destino.relative_to(ASSETS.parent), img.size, f"{destino.stat().st_size // 1024} KB")


_sessao = None
def sem_fundo(img):
    """Tira o fundo cinza do estúdio e apara a sobra transparente."""
    global _sessao
    from rembg import remove, new_session
    _sessao = _sessao or new_session("isnet-general-use")
    rec = remove(img, session=_sessao)
    # apara pelo que é visível de verdade (a sombra quase transparente no chão do estúdio não conta)
    caixa = rec.getchannel("A").point(lambda a: 255 if a > 60 else 0).getbbox()
    return rec.crop(caixa)


def tem(nome):
    return (SAIDA / f"{nome}.png").exists()


if __name__ == "__main__":
    # O que ainda não foi gerado fica de fora (dá para rodar de novo depois).
    # cartas: 5 x 8,4 (como no CSS), 480 px de largura
    for i in range(22):
        nome = ESCOLHAS.get(f"arcano-{i:02d}", f"arcano-{i:02d}")
        if tem(nome):
            gravar(proporcao(abrir(nome), 5 / 8.4), ASSETS / "cartas" / f"arcano-{i:02d}.webp", 480)
    if tem(ESCOLHAS["verso"]):
        gravar(proporcao(abrir(ESCOLHAS["verso"]), 5 / 8.4), ASSETS / "cartas" / "verso.webp", 480)
    # animais do oráculo: 5 x 8, 400 px
    for p in sorted(SAIDA.glob("animal-*.png")):
        gravar(proporcao(abrir(p.stem), 5 / 8), ASSETS / "animais" / f"{p.stem[7:]}.webp", 400)
    # casinha por fora e por dentro (inteiras)
    for k in ("fora", "dentro"):
        if tem(ESCOLHAS[k]):
            gravar(abrir(ESCOLHAS[k]), ASSETS / "casinha" / f"{k}.webp", qualidade=84)
    # recortes sem fundo
    for p in sorted(SAIDA.glob("ing-*.png")):
        gravar(sem_fundo(abrir(p.stem)), ASSETS / "casinha" / f"{p.stem}.webp", 240, 86)
    if tem("caldeirao-101"):
        gravar(sem_fundo(abrir("caldeirao-101")), ASSETS / "casinha" / "caldeirao.webp", 520, 86)
    for p in sorted(SAIDA.glob("obj-*.png")):
        gravar(sem_fundo(abrir(p.stem)), ASSETS / "casinha" / f"{p.stem[4:]}.webp", 360, 86)
    for k, largura in (("sentado", 300), ("andando", 480), ("dormindo", 420)):
        if tem(ESCOLHAS[f"gato-{k}"]):
            gravar(sem_fundo(abrir(ESCOLHAS[f"gato-{k}"])), ASSETS / "gatos" / f"{k}.webp", largura, 86)
