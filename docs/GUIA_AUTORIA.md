# Guia de autoria — como construir Vandor de pouco em pouco

O mundo inteiro já existe como **esboço** (a Semente em `mundo/`): 23 reinos e territórios, 346 lugares,
12 facções, 5 planos, 6 mistérios e a Grande Crise (A Maré Morta). Construir é levar cada lugar do nível 0
ao nível 3, sempre amarrado ao que já existe. `npm run mundo:painel` gera `mundo/painel.html` com o progresso.

## Os níveis de um lugar
| Nível | O que ganha | Para quê |
|---|---|---|
| 0 · Esboço | nome, tipo, posição, rotas, conceito | aparece no mapa |
| 1 · Bíblia | aparência, poder, situação, segredo, descrições, fatos, pessoas | dá para visitar com texto próprio |
| 2 · Sub-lugares | lugares internos com nome, pessoas fixas com rotina | a cidade fica viva |
| 3 · Autoral | conversas, atividades e eventos exclusivos, ganchos | histórias de verdade |

## Como pedir (um pedaço por vez)
Diga **o quê**, **onde**, **até que nível** e **com o que se liga**. Exemplos prontos:

- **Um lugar a fundo:** "Construa Valmont até o nível 3: sub-lugares com nome, 4 pessoas com rotina e conversa,
  12 eventos exclusivos. Ligue pelo menos 3 ganchos a lugares que já existem."
- **Uma região nova:** "Abra o Condado de Tolva: bíblia do reino, nível 1 em todos os lugares, capital no nível 2.
  Rotas e tensões coerentes com Aldwick e Lindartmor."
- **Um arco de facção:** "Escreva o arco da facção X em 5 capítulos espalhados por Aldwick e Lindartmor, com uma
  escolha que muda o fim, flags que outros eventos possam ler e uma recompensa única."
- **A Grande Crise:** "Escreva o ato 1 da Maré Morta: 10 cenas nos portos e na costa, pistas que se confirmam
  em lugares diferentes, e uma virada no fim que abre o ato 2."
- **Mais variação:** "Dê 4 versões a cada texto dos eventos de Forte Tholt e crie tabelas por período e clima."
- **Costura e revisão:** "Revise as ligações entre Cornvale, Valmont e Forte Tholt: liste contradições, fatos
  soltos e pistas sem resposta, e corrija."
- **Mudança de cânone:** "Na Semente, o Duque Oswin morreu no inverno passado; atualize Lindartmor e todo texto
  que cite ele." (fatos mudam primeiro na bíblia; depois, os eventos.)

Bom tamanho de pedido: **um lugar a fundo** ou **um reino no nível 1** ou **um arco** por vez. Pedidos maiores
perdem coerência.

## O que eu faço a cada pedido
1. Leio a bíblia do lugar e dos vizinhos (fatos, pessoas, segredos) e a Grande Crise.
2. Escrevo na Semente (`mundo/reinos/<reino>.json`) e no pacote `public/data/packs/vandor/`.
3. Costuro: cada segredo novo ganha pelo menos 2 pistas em lugares diferentes; cada pessoa sabe algo de outro lugar.
4. Multiplico: cada texto com 3–4 versões; tabelas de gramática por hora e clima.
5. Verifico: `npm run mundo:exportar`, `npm run check`, `npm run playtest`, revisão de texto por agente.
6. Atualizo o painel (`npm run mundo:painel`).

## Regras de coerência (o "cânone")
- **A Semente manda.** Fato que não está na bíblia não existe; evento não inventa governante, data ou morte.
- **Fatos em forma de frase completa** (`problema`, `rumor`) para encaixar em "{$lugar.problema}".
- **Nomes únicos e distintos** (nada de Valmont e Valmord).
- **Escolhas com custo.** Vida é preciosa; cura é rara; ouro é modesto.
- **No máximo 4 opções por cena**, sempre uma sem requisito; nunca uma opção só.
- **Flags com nome claro** (`pista_salnegro`, `tholt_patrulha_achada`) para outros eventos lerem.

## Ideias de ordem de construção
1. Aldwick a fundo (feito: Cornvale 3; Valmont e Forte Tholt 2).
2. Valmont e Forte Tholt ao nível 3; os 7 lugares selvagens com 4 eventos cada.
3. Ato 1 da Maré Morta (portos de Deepmorge e Lindartmor).
4. Capitais vizinhas (Morge, Valdmor, Cinzarra) ao nível 2.
5. Uma facção por região; depois, o resto do continente.
