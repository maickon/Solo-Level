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

## Mundo infinito (v0.7)
- **Fronteiras** (`fronteira` nos locais) → "Desbravar": `gerarRegiao` escolhe um modelo de `regioes.json`
  compatível com o bioma/tags de origem (`de`), cria 2–5 locais (`state.locais`, `regiao`, `gerado`) para fora
  do centro do mapa e liga à origem. Regiões abertas sempre deixam ≥1 fronteira nova: o mundo não acaba.
- **Masmorras** (`tipo: "masmorra"`): reveladas ao explorar (6%, uma por local, `state.masmorras`); corredor
  entrada → salas → covil, conexões de 0 períodos.
- **Planos** (`plano: true`): só pelo efeito `portal`; se vier junto com combate, o portal espera a vitória
  (`state.aposCombate.portal`).
- **Perfis de dados**: biomas trazem `visual` (camadas, partículas, céu) e `som` (ruído, escala, vozes) sobre os
  perfis embutidos; o validador confere o vocabulário. Inimigos têm `peso` de raridade.
- **Mapa**: mundo pequeno enquadra tudo; mundo grande centra no herói com zoom ampliado.

## Atividades e lugares internos (v0.6)
Modelo de *storylets* / narrativa baseada em qualidades (como em Fallen London): um grande baralho de
pequenas cenas com pré-requisitos; o motor mostra só as que cabem no contexto.
- **Estabelecimentos** (`estabelecimentos.json`): cada povoado sorteia os seus na primeira visita
  (`state.estabs`), pelas tags de tipo (`vila`, `porto`, `aldeia`…) e `chance`; mínimo 3; ficam fixos.
- **Atividades** (`tipo: "atividade"`): eventos com `rotulo` de menu. `atividadesDoMomento` filtra por `requer`
  (inclui `estab`), tira as em recarga (`state.atvFeitas`) e sorteia até 4 (povoado) ou 2 (ermo), com peso
  maior para as mais específicas (saliência). A seleção vale para o período (`state.atvOferta`).
- Ao escolher: gasta `tempo`, entra em recarga e abre a cena com `{$estab}` no contexto (`s.evento.estab`).
- Opções fixas continuam: explorar, missões, viajar, descansar, estalagem, mercado, trabalho.

## Visual de jogo (v0.5)
- **Cenário** (`visual/cenario.js`): canvas atrás de tudo. Céu por período (com clima), silhuetas em camadas
  geradas pela semente do local (cada lugar tem visual fixo), névoa entre camadas, astros, estrelas, mar/água,
  partículas (chuva, neve, vaga-lumes, poeira, gotas, brasas no combate) e pulso vermelho em combate.
  Perfil visual = chave de áudio do lugar (`caverna` para tags subterrâneas). `area` limita a paisagem à parte
  visível acima do texto. ~30 fps, pausa com a aba oculta, quadro estático com movimento reduzido.
- **Layout** (`css/jogo.css`): moldura montada uma vez (`montarJogo`) e atualizada por partes (`renderGame`).
  HUD com vida/energia/exaustão; cartão da cena (anterior esmaecida); dados desenhados a partir dos campos
  `d1/d2/mod/total/atributo` do bloco `rolagem`; números flutuantes de dano/cura/ouro; painel de vidro fixo
  no computador; barra inferior + folha deslizante no celular (≤ 900px).
- **Mapa**: zoom (roda, pinça, botões), arrastar e centralizar; a vista fica em `mapaView` até centralizar.

## Gramática 2.0 (v0.4)
Texto procedural coerente, não só variado. Contexto por cena (`novaCena()`, zerado em `Game.begin`):
- **Fatos** (`diz`/`nao` nas entradas): o que uma parte afirma vale até o fim da cena, filtra contradições e
  libera entradas com tag nas partes seguintes.
- **Referência**: `{$x.Ref}` nomeia na 1ª menção e usa pronome depois, salvo ambiguidade de gênero.
  Variáveis trazem artigos e contrações prontos (`o_nome`, `do_nome`, `no_nome`, `ao_nome`).
- **Seleção** em `pickEntry`: coerência (nao) → especificidade (tags) → novidade entre cenas
  (memória ~60% da tabela, salva em `state.memoria`) → palavras ainda não usadas na cena → peso.
- **Acabamento** `polir()`: espaços, pontuação e maiúsculas após partes opcionais vazias.
- `label()` gera rótulos/títulos sem contaminar o contexto da cena.
- **Nomes** com gênero (`nomePessoa`), **lint** de templates no validador e **estilo/variedade** medidos
  na simulação (`tools/estilo.mjs`).

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
  Chrome: Google). Fala em frases curtas (o Chrome corta falas longas).
- **Narrador neural próprio** (`voz-neural.js`): Piper (VITS) via `@mintplex-labs/piper-tts-web` + ONNX Runtime
  Web (import map em `index.html`), carregado sob demanda. Vozes pt_BR faber/edresson (~63 MB, download único,
  guardado no OPFS, offline depois). Gera a frase seguinte enquanto a atual toca; aquece o modelo ao abrir.
- **UX**: atalhos 1–9 (opções), L (ouvir), F/I/M/J/D (abas), Esc; revelação escalonada do texto; janela
  de ajustes (preferências em `sololevel.prefs`); tutorial na primeira partida; comparação de equipamento
  (`compararEquip` em `hero.js`) na mochila e no mercado.

## Qualidade
`npm run qa` (validação + testes + playtest em massa com 6 estilos de robô) e `npm run ui` (navegador real).
Relatórios em `reports/`; skill `/playtest` e agente `revisor-texto` para revisão semântica. Ver `docs/PROXIMAS_FASES.md`.

## Roadmap sugerido
1. Painel admin (editor de pacotes com validação ao vivo, usando `validate()`).
2. Firestore: autoria de pacotes pelo admin → botão "Publicar" exporta JSON para o Hosting;
   save na nuvem opcional (Auth), sincronizado só em checkpoints.
3. IndexedDB no lugar do localStorage; PWA offline.
4. Mais conteúdo: biomas (alto-mar via porto), fios encadeados, NPCs recorrentes.
