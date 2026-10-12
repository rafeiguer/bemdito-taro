#!/bin/sh
# Gera todas as imagens pendentes de trabalhos.json, 6 por vez (o gerar.py sai depois de cada lote).
V=/c/Users/Rafa/Projetos/tenda-cigana/ferramentas/gerador/.venv/Scripts/python.exe
G=/c/Users/Rafa/Projetos/tenda-cigana/ferramentas/gerador/gerar.py
cd "$(dirname "$0")"
while :; do
  out=$($V $G trabalhos.json saida 6 2>&1 | grep -aE "^(lote|ok|usando)")
  echo "$out"
  echo "$out" | grep -q "lote de 0" && break
  echo "$out" | grep -q "^ok" || { echo "parou sem gerar"; break; }
done
echo FIM
