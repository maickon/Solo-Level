# Semente do Mundo — formato e fluxo

A Semente é a **fonte da verdade** do mundo autoral (ver `docs/MUNDO_AUTORAL.md`). Ela nasce de um gerador
(rascunho reproduzível), passa por **curadoria** e, a partir daí, é editada à mão — nunca regerada por cima.

## Comandos
```bash
npm run mundo:gerar -- --semente valdoria          # rascunho em mundo/ (recusa sobrescrever sem --forcar)
npm run mundo:gerar -- --semente outra --saida rascunhos/outra   # testar outras sementes sem tocar na oficial
npm run mundo:mapa                                 # mundo/mapa.svg e mundo/revisao.html (abrir no navegador)
npm run mundo:validar                              # consistência (referências, alcance, níveis)
npm run mundo:relatorio                            # mundo/CONSTRUCAO.md (% construído por reino)
npm run mundo:exportar                             # copia a Semente para o jogo (public/data/mundo/)
```

## Arquivos (`mundo/`)
| Arquivo | Conteúdo |
|---|---|
| `indice.json` | mundo (nome, era, magia, linha do tempo, mistérios, panteão), continentes, mares, culturas usadas, facções, Grande Crise, planos, pontos de partida, lista de reinos, lugares sem reino (`ermos`), rotas entre reinos, biomas |
| `terreno.json` | grade do mapa (uma letra de bioma por célula), grade de territórios (uma letra por reino), rios |
| `reinos/<id>.json` | um reino ou território: governo, cultura, povo, capital, descrição, tensão, relações, economia, **lugares** e **rotas internas** |
| `mapa.svg`, `revisao.html`, `CONSTRUCAO.md` | gerados para revisão; podem ser refeitos a qualquer momento |

### Lugar (dentro de `reinos/<id>.json` → `lugares`)
`id` (eterno), `nome`, `genero`, `plural`, `tipo` (capital, cidade, vila, aldeia, porto, forte, mosteiro, bosque,
cripta…), `categoria` (`povoado` | `natureza` | `ruina` | `masmorra`), `reino`, `x`, `y`, `bioma`, `cultura`,
`porto`, `ilha`, `conceito` (uma linha), `perigo` (0–5), `historia`/`fama` (marco da linha do tempo), `crise`
(pista ou origem da Grande Crise), **`nivel`** (0–3) e **`revisado`**. A partir do nível 1 ganha `biblia`.

### Rota
`de`, `para`, `tipo` (`estrada`, `trilha`, `passo`, `mar`, `magia`), `tempo` (períodos). `mar` exige barco/navio;
`magia` exige meio mágico (dragão, barco voador, portal).

## Curadoria (o que revisar no rascunho)
1. Abra `mundo/revisao.html`. Confira mapa, reinos, culturas, tensões, linha do tempo, Grande Crise e facções.
2. Escolha o **ponto de partida** (ou indique outro lugar).
3. Peça as mudanças (nomes, relações, cultura de um reino, crise…): elas são feitas direto nos JSON.
4. Ao aprovar, `indice.json` → `"status": "curado"`. Daí em diante o gerador só propõe acréscimos.

## No jogo (Fase B mínima)
`npm run mundo:exportar` grava a Semente em `public/data/mundo/` com `partida` (ponto de partida, definido em
`mundo/indice.json`) e `regiaoInicial` (reino da partida + reinos ligados a ele por terra). O motor
(`public/src/engine/mundo.js`) transforma cada lugar em local do jogo: bioma do jogo, tags pelo tipo de povoado e
de lugar, conexões pelas rotas. Lugares da região inicial e de nível ≥ 1 são **jogáveis**; os outros aparecem no
mapa como "terras ainda não mapeadas" e a viagem até eles fica bloqueada com um motivo pelo tipo de rota.
Sem `public/data/mundo/`, o jogo volta ao modo clássico (usado pelos testes de motor).

## Construção (níveis)
| Nível | O que se acrescenta ao lugar |
|---|---|
| 0 · Esboço | só o que o gerador criou |
| 1 · Bíblia | `biblia`: aparência, poder, situação atual, segredo, vida, estados, pessoas notáveis |
| 2 · Sub-lugares | `sublugares` com função e personagem fixo |
| 3 · Autoral | eventos exclusivos (`requer.local`), conversas e ganchos |

`npm run mundo:relatorio` mostra o avanço; `npm run mundo:validar` acusa lugar de nível ≥ 1 sem bíblia.

## Formato da construção (Fase C)
Tudo vai no próprio lugar em `mundo/reinos/<id>.json`; depois `npm run mundo:exportar`.

```jsonc
"nivel": 2,
"biblia": {
  "aparencia": "…", "poder": "quem manda e como", "situacao": "o problema de agora", "segredo": "…",
  "vida": "rotina, cheiros, sons", "estados": ["normal", "festival", "cerco"],
  "descricoes": ["2ª pessoa, 1–3 frases, lida ao chegar (uma é sorteada)"],
  "fatos": { "problema": "…", "governante": "…", "rumor": "…" },   // viram {$lugar.chave} nos textos
  "pessoas": [{ "id": "irma", "nome": "Irmã Veyra", "genero": "f", "oficio": "sacerdote", "temperamento": "taciturno",
                "papel": "dica no menu", "sublugar": "templo", "rotina": ["manha", "tarde"], "evento": "cornvale_irma" }]
},
"sublugares": [{ "id": "templo", "nome": "Templo da Aurora", "genero": "m", "ao": "ao", "estab": "templo",
                 "descricoes": ["…"], "vazio": "texto quando não há nada a fazer", "dica": "…" }]
```
- `estab` liga o sub-lugar a um estabelecimento de `estabelecimentos.json` (atividades com `requer.estab` aparecem dentro dele).
- `oficio`/`temperamento` usam os ids de `npcs.json`; `evento` é o id de um evento (`tipo: "cadeia"`) aberto por
  "Falar com…", com a pessoa como `$npc`.
- Eventos exclusivos de um lugar ficam no pacote `vandor` com `requer.local` (id do lugar). Atividades
  (`tipo: "atividade"`) aparecem no menu; eventos comuns sorteiam ao explorar.
- O validador acusa ofício, temperamento, sub-lugar, estabelecimento e evento inexistentes.

## Vocabulário de biomas da Semente
`mar`, `costa`, `planicie`, `colinas`, `floresta`, `floresta_antiga`, `selva`, `pantano`, `savana`, `deserto`,
`tundra`, `geleira`, `montanha`, `vulcanico`. O mapeamento para os biomas do jogo está em `indice.json` →
`biomaNoJogo` (usado na Fase B).
