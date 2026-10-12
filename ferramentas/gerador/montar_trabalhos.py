"""Monta trabalhos.json (lista de imagens para o gerar.py da Tenda Cigana) com as imagens realistas do Bem Dito:
as 22 cartas, o verso, a casinha por fora e por dentro, os ingredientes do caldeirão, os gatos e os animais do oráculo."""
import json
from pathlib import Path

NEG = ("cartoon, anime, childish, 3d render, cgi, flat colors, lowres, blurry, deformed, bad anatomy, extra fingers, extra limbs, "
       "watermark, signature, logo, text, letters, words, numbers, caption, title")
CARTA = ("tarot card art of {}, ornate gilded art nouveau frame with stars, realistic oil painting, cinematic candle-warm lighting, "
         "deep purple, gold and magenta palette, highly detailed, masterpiece")
ARCANOS = [
    "The Fool, a young wanderer in flowing clothes holding a white rose, a small white dog at his feet, standing at the edge of a cliff under a starry violet night sky with a glowing crescent moon",
    "The Magician, a young man in a red and violet robe raising a glowing wand to the sky, on the table before him a golden cup, a sword, a pentacle coin and a wand, a glowing infinity sign above his head, roses and lilies",
    "The High Priestess, a serene woman in blue and white robes with a crescent moon at her feet, seated between a black pillar and a white pillar, holding a scroll, a veil embroidered with pomegranates behind her",
    "The Empress, a radiant woman crowned with twelve stars seated on velvet cushions in a golden wheat field by a forest and a waterfall",
    "The Emperor, a bearded king in armor and a red robe on a stone throne carved with ram heads, holding a golden scepter, barren mountains behind",
    "The Hierophant, a high priest with a triple golden crown raising his hand in blessing, seated between two stone pillars, two crossed golden keys at his feet",
    "The Lovers, a man and a woman standing in a blooming garden under a radiant angel with spread wings in the sky, a tree of life and an apple tree with a serpent",
    "The Chariot, a young warrior prince in a chariot with a starry canopy pulled by a black sphinx and a white sphinx, castle walls behind",
    "Strength, a gentle woman in white with a crown of flowers calmly holding the mouth of a lion, a glowing infinity sign above her head, a meadow with mountains",
    "The Hermit, an old bearded man in a grey hooded cloak holding a lantern with a glowing six-pointed star on a snowy mountain peak at night",
    "Wheel of Fortune, a giant golden wheel engraved with mystic symbols turning among the clouds, a sphinx on top, a serpent on one side, an angel, an eagle, a bull and a lion in the four corners",
    "Justice, a crowned woman in a red robe seated between two pillars holding an upright sword and golden scales",
    "The Hanged Man, a serene young man hanging upside down by one foot from a living wooden tree, a glowing golden halo around his head",
    "Death, a skeleton knight in black armor riding a white horse and carrying a black banner with a white rose, the sun rising between two towers",
    "Temperance, a winged angel in white with one foot in a pool and one on land pouring glowing water between two golden cups, a path to the mountains and a rising sun, irises",
    "The Devil, a horned goat-headed figure with dark bat wings on a black pedestal under a torch, a chained man and woman in rags below",
    "The Tower, a tall stone tower on a rocky peak struck by lightning, the crown blown off its top, flames and falling stones, stormy night",
    "The Star, a woman in a sheer white dress kneeling by a pool under a night sky with one large eight-pointed star and seven small stars, pouring water from two jugs",
    "The Moon, a large full moon with a serene face between two stone towers, a dog and a wolf howling at it, a crayfish rising from a pool, a winding path",
    "The Sun, a radiant smiling sun over a field of tall sunflowers, a joyful child riding a white horse and holding a red banner",
    "Judgement, a great angel blowing a golden trumpet from the clouds, people rising with open arms from stone tombs, mountains behind",
    "The World, a dancing woman wrapped in a violet sash inside a large laurel wreath holding two wands, an angel, an eagle, a bull and a lion in the four corners of the sky",
]
FOTO = "realistic photograph, cinematic, highly detailed"
ISOLADO = "isolated on a plain light grey background, studio product photograph, soft light, realistic, highly detailed, sharp focus"
INGREDIENTES = {
    "rosa": "a small bundle of dried red roses tied with twine, hanging upside down",
    "lavanda": "a bundle of dried lavender tied with twine, hanging upside down",
    "alecrim": "a bundle of fresh rosemary sprigs tied with twine, hanging upside down",
    "arruda": "a bundle of fresh rue herb sprigs with small blue-green leaves tied with twine, hanging upside down",
    "louro": "a bundle of dried bay laurel leaf branches tied with twine, hanging upside down",
    "mel": "a small round glass jar of golden honey with a wooden honey dipper",
    "canela": "a bundle of cinnamon sticks tied with twine, standing upright",
    "sal": "a small glass jar filled with coarse white sea salt with a cork lid",
    "camomila": "a small glass jar filled with dried chamomile flowers with a cork lid",
    "lua": "a small round glass potion bottle with glowing pale blue moon water and a cork",
}
ANIMAIS = [
    ("aguia", "a golden eagle with spread wings"), ("lobo", "a grey wolf"), ("urso", "a brown bear"), ("coruja", "a great horned owl"),
    ("serpente", "a coiled emerald green snake"), ("borboleta", "a blue morpho butterfly"), ("cervo", "a red deer stag with large antlers"),
    ("raposa", "a red fox"), ("corvo", "a black raven"), ("cavalo", "a white horse with a flowing mane"), ("tartaruga", "an old sea turtle"),
    ("baleia", "a humpback whale underwater with rays of light"), ("leao", "a lion with a golden mane"), ("onca", "a jaguar"),
    ("beija-flor", "a hummingbird drinking from a flower"), ("arara", "a scarlet macaw"), ("boto", "a pink amazon river dolphin in dark water"),
    ("lontra", "a river otter"), ("coelho", "a wild brown rabbit"), ("gato", "a black cat with golden eyes"),
    ("aranha", "a spider on a web covered with dew drops"), ("sapo", "a green tree frog on a leaf"), ("abelha", "a honeybee on a flower"),
    ("elefante", "an elephant"),
]

t = []
for i, a in enumerate(ARCANOS):
    t.append({"nome": f"arcano-{i:02d}", "w": 768, "h": 1344, "seed": 11, "prompt": CARTA.format(a), "neg": NEG})
t += [{"nome": f"verso-{s}", "w": 768, "h": 1344, "seed": s, "neg": NEG.replace(", title", ""),
       "prompt": "the ornate back of a tarot card, perfectly symmetrical design, a golden sun and two crescent moons, stars and a celestial mandala "
                 "on deep violet velvet, gold leaf filigree, art nouveau border, flat front view, highly detailed, masterpiece"} for s in (21, 22)]
t += [{"nome": f"fora-{s}", "w": 1152, "h": 896, "seed": s, "neg": NEG,
       "prompt": "front view of a small enchanted witch cottage in a dark forest at night, centered round wooden door half open with warm golden light, "
                 "thatched roof with moss, stone and timber walls, glowing warm windows, hanging lanterns, stone path to the door, red mushrooms, "
                 "fireflies, mist, tall pine trees, full moon and stars in a violet sky, fairytale, " + FOTO} for s in (31, 32, 33)]
t += [{"nome": f"dentro-{s}", "w": 1344, "h": 768, "seed": s, "neg": NEG,
       "prompt": "wide view of the cozy interior of a witch cottage at night, a black iron cauldron bubbling over a fire in front of a stone fireplace in the center, "
                 "wooden shelves with glass jars of herbs and potions on the left, bundles of dried herbs hanging from the wooden beams, "
                 "an old spell book open on a wooden lectern with a candle, a small round tea table with a teapot and cups on the right, "
                 "a window with amethyst crystals on the sill, many candles, warm golden light, " + FOTO} for s in (41, 42, 43)]
t += [{"nome": f"ing-{k}", "w": 1024, "h": 1024, "seed": 51, "neg": NEG, "prompt": f"{v}, {ISOLADO}"} for k, v in INGREDIENTES.items()]
t += [{"nome": f"gato-sentado-{s}", "w": 1024, "h": 1024, "seed": s, "neg": NEG,
       "prompt": "a black cat sitting upright facing the viewer, bright golden yellow eyes, sleek shiny black fur, full body with the tail curled around the paws, " + ISOLADO} for s in (61, 62, 63)]
t += [{"nome": f"gato-andando-{s}", "w": 1344, "h": 768, "seed": s, "neg": NEG,
       "prompt": "side view of a black cat walking to the right, full body, legs clearly separated mid stride, tail raised, golden eye, " + ISOLADO} for s in (71, 72, 73)]
t += [{"nome": f"gato-dormindo-{s}", "w": 1344, "h": 768, "seed": s, "neg": NEG,
       "prompt": "a black cat sleeping curled up on its side, full body, peaceful, " + ISOLADO} for s in (81, 82)]
t += [{"nome": f"animal-{k}", "w": 832, "h": 1216, "seed": 91, "neg": NEG,
       "prompt": f"mystical spirit animal portrait of {v}, magical golden light and glowing particles, enchanted night forest, deep violet and gold tones, " + FOTO}
      for k, v in ANIMAIS]
# segundas tentativas (entram na frente da fila)
EXTRAS = {3: "The Empress, a radiant pregnant woman with a crown of twelve stars sitting on velvet cushions outdoors in a golden wheat field, a waterfall and a forest behind her, a heart shaped shield at her side",
          7: "The Chariot, a young warrior prince standing in a golden chariot with a starry blue canopy, the chariot pulled by two sphinxes, one black and one white, a castle behind"}
t = [{"nome": f"arcano-{i:02d}-{s}", "w": 768, "h": 1344, "seed": s, "prompt": CARTA.format(p), "neg": NEG} for i, p in EXTRAS.items() for s in (12, 13)] + t
# caldeirão separado, para ficar na frente da lareira de dentro-42 (o líquido é desenhado por cima, na cor da poção)
t = [{"nome": f"caldeirao-{s}", "w": 1024, "h": 1024, "seed": s, "neg": NEG,
      "prompt": "a large old black cast iron witch cauldron on three short legs, seen slightly from above so the round open top is visible, "
                "dark empty inside, rough hammered iron, warm firelight reflections on the side, " + ISOLADO} for s in (101, 102)] + t
# objetos que faltam na foto de dentro-42 para os cantos da casinha (recortados e postos por cima)
OBJETOS = {"grimorio": "an old open leather spell book with yellowed handwritten pages and a red ribbon, lying open on a small wooden book stand",
           "cristais": "a large purple amethyst crystal geode cluster with a few clear quartz points and a rose quartz beside it",
           "bule": "an antique dark green cast iron teapot with two small clay cups and a sprig of mint"}
t = [{"nome": f"obj-{k}", "w": 1024, "h": 1024, "seed": 111, "neg": NEG, "prompt": f"{v}, {ISOLADO}"} for k, v in OBJETOS.items()] + t
Path(__file__).with_name("trabalhos.json").write_text(json.dumps(t, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(t), "imagens")
