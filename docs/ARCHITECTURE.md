# Arquitetura

## Princípios
1. **Dados > código**: mundo, itens, eventos, textos e balanceamento vivem em pacotes JSON.
   O painel admin (futuro) só edita esses dados.
2. **Motor puro e determinístico**: `Game` recebe `(content, state)`; todo acaso vem de `Rng`
   com estado salvo. Mesma semente + mesmas escolhas = mesma história.
3. **Estado serializável**: `state` é JSON puro (save local hoje, Firestore amanhã).
4. **Coerência por escopo**: só se viaja por conexões; eventos só aparecem se `requer` passar
   (bioma, tags do local, período, clima, inventário, traços, flags, fios).

## Fluxo de uma escolha
```
UI clica opção i → game.choose(i) → act_<tipo>(acao)
  → regras (teste 2d6, efeitos, tempo, energia) → texto via gramática
  → commit(modo, opcoes) → state.cena = { modo, blocos[], opcoes[] }
UI re-renderiza a partir de state.cena e salva no localStorage.
```
Modos de cena: `local` (hub) · `evento` · `combate` · `mercado` · `morte`.

## Sistema de regras "Fio"
- Teste: `2d6 + atributo + mods (itens/traços) − exaustão − dificuldade`.
  10+ sucesso · 7–9 parcial (com custo) · 6- falha.
- **Vida**: chega a 0 → morte permanente (save apagado, entrada no Memorial).
  Recupera só por descanso e consumíveis.
- **Energia**: viajar e explorar custam 1 por período; sem energia, ganha exaustão.
- **Exaustão (0–5)**: 3+ dá −1 nos testes, 5 dá −2. Reduzida por acampar com ração ou pela estalagem.
- **Descanso**: curto (+2 energia, +1d3 vida, 1 período, risco de emboscada) · acampar
  (até a manhã; com ração cura 50% e −2 exaustão; sem ração cura 20% e +1 exaustão) ·
  estalagem (5 ouro, cura 60%, zera exaustão, sem risco).
- **Combate**: atacar (atributo da arma), fugir (agilidade), negociar (presença, se `inteligente`).
  Defesa reduz dano recebido (mínimo 1).
- **Progressão**: XP para o nível n = 8n. Cada nível dá +3 vida máx. e +1 energia máx.; níveis pares dão +1 no melhor atributo.
- **Caos (1–9)**: sobe com falhas e desce com sucessos; ajusta o oráculo interno (emboscadas).

## Gerador de itens
`base` (tier, slot, dano/defesa) × `raridade` (nº de afixos, multiplicador de valor) ×
`qualidade` (adjetivo com gênero + mods) × `afixos` ("do Lobo" + mods). Lendários
ganham nome próprio por Markov. O tier vem do perigo do bioma ou do inimigo.

## Fios soltos
Abertos por efeito `fio`. A pressão sobe a cada explorar ou viajar; quando o `requer` do fio
passa, a chance de emergir é pressão × 10% (máx. 80%). O evento `tipo: "fio"` o resolve.

## Profundidade (v0.2)
- **Críticos**: 6+6 e 1+1 nos testes (saídas `critico` e `desastre` opcionais; em combate, dano ×2 ou revés).
- **Cadeias**: efeito `cena` encadeia eventos `tipo: "cadeia"`. Um combate no meio da cadeia guarda o
  próximo passo em `state.aposCombate`, que só continua após vitória. O NPC do passo anterior é herdado.
- **NPCs**: `state.npcs`, gerados sob demanda pelo campo `npc` dos eventos. Reencontro de 70% no mesmo local.
  A disposição (−5..5) muda as opções e os textos (tags `npc_conhecido`, `npc_amigo`, `npc_hostil`).
- **POIs**: `state.locais` + `state.conexoesExtra`. 15% de chance ao explorar um local fixo, no máximo 3 por local.
  `content.location(s)` resolve primeiro os locais dinâmicos.
- **Missões**: ofertas diárias em locais seguros (`state.ofertas`) e até 3 ativas (`state.missoes`).
  Objetivos `vencer`, `explorar` e `chegar`. O contratante vira NPC persistente.
- **Mapa**: coordenadas `x,y` dos locais. A UI desenha visitados, vizinhos sob névoa e alvos de missão,
  e permite viajar clicando num vizinho.

## Som, voz e experiência (v0.3)
- **Contrato motor → som**: o motor não toca nada; ele só marca classes nos blocos da cena
  (`rolagem` com o resultado; notas `golpe`, `golpe critico`, `dano vida`, `cura vida`, `xp nivel`, `vitoria`,
  `ouro`, `item r-<raridade>`, `fio`). `audio/cues.js` (puro, testado) compara a cena anterior com a nova
  e devolve a sequência de sons; a UI toca e aplica lampejos na tela.
- **Mesa** (`audio/engine.js`): barramentos ambiente, música e efeitos com volume próprio, compressor final
  e abafamento automático enquanto a narração fala.
- **Ambiente** (`audio/ambience.js`): perfil por lugar (`bioma.audio`, ou `caverna` se o local tem tag
  `subterraneo`/`caverna`): leito de ruído + vozes esparsas (pássaros, grilos, gotas, ondas, sinos, trovão na chuva)
  + música modal com notas soltas. Muda com período, clima, multidão no mercado e tag `sagrado`.
  Em combate entra percussão e ostinato. Tudo sintetizado: sem arquivos de áudio.
- **Narração** (`voice.js`): Web Speech API, prefere vozes neurais PT-BR (Edge: Francisca/Antonio Online;
  Chrome: Google). Fala em frases curtas (o Chrome corta falas longas). Piper/WASM ficou de fora por ora:
  o modelo pesa dezenas de MB e as vozes neurais do navegador já cobrem o caso grátis.
- **UX**: atalhos 1–9 (opções), L (ouvir), F/I/M/J/D (abas), Esc; revelação escalonada do texto; janela
  de ajustes (preferências em `sololevel.prefs`); tutorial na primeira partida; comparação de equipamento
  (`compararEquip` em `hero.js`) na mochila e no mercado.

## Roadmap sugerido
1. Painel admin (editor de pacotes com validação ao vivo, usando `validate()`).
2. Firestore: autoria de pacotes pelo admin → botão "Publicar" exporta JSON para o Hosting;
   save na nuvem opcional (Auth), sincronizado só em checkpoints.
3. IndexedDB no lugar do localStorage; PWA offline.
4. Mais conteúdo: biomas (alto-mar via porto), fios encadeados, NPCs recorrentes.
