# Bem Dito Tarot (Tryv Tuath)

Site publicado em https://tryvtuath.github.io/tryvtuath/

## Estrutura

- `index.html`: o site inteiro (layout, animações e cálculos dos portais).
- `conteudo.json`: textos, fotos, vídeos e as traduções feitas à mão (`ingles`). O texto que ainda
  aparece no HTML é só reserva para o instante antes de o conteúdo carregar: o que vale é o `conteudo.json`.
- `configuracoes.html` + `configuracoes/`: tela Configurações, onde a Tryv edita o conteúdo e publica.
- `assets/`: logo, fotos originais do site e `og.jpg` (prévia ao compartilhar). Fotos enviadas pela
  tela Configurações vão para `assets/fotos/`.

## Tela Configurações (edição pela Tryv)

Link discreto "Configurações" no rodapé do site (ou `/configuracoes.html`). Lá dá para mudar todos os
textos (cartas, portais, anjos, signos, Roda do Ano, casinha, panteões, consultas, livro, contato…),
trocar e enviar fotos do espelho e a capa do livro (o navegador converte para WebP, sem metadados) e
colar links do YouTube. "Ver prévia" mostra o site com as mudanças só naquele aparelho; "Publicar" faz
um commit na `main` com o `conteudo.json` e as fotos novas, e o GitHub Pages atualiza em cerca de um
minuto. O rascunho fica guardado no navegador até publicar. No aparelho que já entrou na tela, o site
mostra um botão "✎ Editar".

Inglês: marcando "Mostrar inglês", cada texto ganha um campo em inglês. Vazio, o site usa o tradutor
do Google, como antes. Listas com quantidade fixa (os 22 arcanos, 72 anjos, signos, kin, horóscopo
chinês, totens e sabbats) não deixam acrescentar, apagar nem mudar a ordem, porque os cálculos do site
dependem da posição.

Chave de acesso (uma por pessoa, você gera):

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Repository access: **Only select repositories** → `tryvtuath`.
3. Permissions → Repository permissions → **Contents: Read and write** (o resto fica sem acesso).
4. Escolha a validade (ex.: 1 ano), gere e mande o token para a Tryv colar na tela de entrada.

Para cortar o acesso, apague o token no GitHub. Os commits saem no seu nome, com a mensagem
"Configurações: …". Para desfazer uma publicação: `git revert <commit>`.

Antes de editar o `conteudo.json` à mão, faça `git pull`: a Tryv pode ter publicado mudanças.

## Preview local

```
python -m http.server 8080
```

Abra http://localhost:8080 (abrir o `index.html` direto do disco não funciona: o site precisa
carregar o `conteudo.json`).
