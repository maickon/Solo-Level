# Schema de Conteúdo (pacotes)

Pacotes ficam em `public/data/packs/<id>/`. A lista de pacotes ativos está em
`public/data/packs/index.json` (`["core", ...]`). Pacotes posteriores **estendem**
os anteriores: arrays com `id` são mesclados por id (o último vence); tabelas de
gramática e listas de nomes são concatenadas.

Validar sempre com: `npm run validate` (verifica referências, sintaxe de templates e chaves).

## manifest.json
```json
{ "id": "core", "nome": "Núcleo", "versao": "0.1.0",
  "arquivos": ["classes","traits","biomes","locations","enemies","items","events","threads","grammar","names"] }
```
Cada arquivo é `<nome>.json`. Arquivos ausentes no manifesto são ignorados.

## Texto: gramática procedural
Todo campo `texto`/`rotulo` é um **template**:

| Sintaxe | Efeito |
|---|---|
| `{tabela}` | sorteia uma entrada de `grammar.json[tabela]` (expande recursivamente) |
| `{tabela\|cap}` | idem, com primeira letra maiúscula |
| `{tabela@heroi}` | escolhe a forma `m`/`f` da entrada conforme o gênero da variável |
| `{$heroi.nome}` | variável de contexto |
| `{=cansado/cansada@heroi}` | concordância inline (masc/fem) |

Variáveis: `heroi`, `local`, `bioma`, `inimigo`, `item`, `destino`, `fio`.
Toda variável com gênero expõe: `nome`, `Nome` (capitalizado), `genero` (`m`/`f`),
`o` (o/a), `O` (O/A), `um` (um/uma), `do` (do/da), `no` (no/na), `ao` (ao/à).

Entradas de tabela em `grammar.json`:
```json
{
  "clima_frase": [
    "O vento corta a pele.",
    { "t": "A chuva tamborila nas folhas.", "tags": ["chuva"], "peso": 3 },
    { "m": "Ele parece exausto.", "f": "Ela parece exausta." }
  ]
}
```
- `tags`: a entrada só aparece se **todas** as tags estiverem no contexto. Se
  nenhuma entrada com tag servir, usa as entradas sem tag.
- Tags de contexto disponíveis: id do bioma, tags do local, período
  (`manha`,`tarde`,`noite`,`madrugada`), clima (`limpo`,`chuva`,`nevoa`,`vento`,`neve`),
  modo (`combate`), `ferido` (HP ≤ 50%), `exausto` (exaustão ≥ 3).
- O motor evita repetir entradas usadas recentemente.

Tabelas usadas pelo motor (devem existir): `local_desc`, `local_retorno`,
`chegada`, `viagem_sem_evento`, `descanso_curto`, `acampamento`, `estalagem`,
`emboscada`, `combate_inicio`, `ataque_acerto`, `ataque_parcial`, `ataque_falha`,
`vitoria`, `fuga_sucesso`, `fuga_falha`, `negociar_sucesso`, `negociar_falha`,
`epitafio`, `subir_nivel`, `item_encontrado`, `novo_dia`.

## classes.json
```json
[{ "id": "guerreiro", "nome": {"m":"Guerreiro","f":"Guerreira"},
   "descricao": "Aço, cicatrizes e teimosia.",
   "atributos": {"forca":2,"agilidade":1,"mente":0,"presenca":0},
   "hp": 14, "energia": 6,
   "inicial": [ {"base":"espada"}, {"base":"racao","qtd":2} ],
   "tracos": ["veterano"] }]
```
Atributos: `forca`, `agilidade`, `mente`, `presenca` (valores de -1 a 3).

## biomes.json
```json
[{ "id": "floresta", "nome": "Floresta", "perigo": 2,
   "tags": ["natureza"], "audio": "floresta",
   "clima": {"limpo":3,"chuva":2,"nevoa":2},
   "inimigos": ["lobo","bandido"] }]
```
- `perigo` 0–5: escala chance de emboscada e tier dos itens.
- `audio`: `vila` | `floresta` | `mar` | `caverna` | `pantano` | `montanha` | `estrada` | `ruinas`.
- `inimigos`: ids usados em emboscadas.

## locations.json
```json
[{ "id": "vila_bruma", "nome": "Vila de Bruma", "bioma": "vila", "genero": "f",
   "tags": ["seguro","estalagem","mercado"],
   "conexoes": [ {"para":"estrada_norte","tempo":1} ] }]
```
- Conexões devem ser **recíprocas** (validador avisa).
- `tempo`: períodos gastos na viagem (cada período custa 1 de energia).
- Trocar de bioma numa viagem sorteia um evento `viagem`. É assim que o mundo
  impede saltos absurdos: só se viaja por conexões.
- Tags especiais: `seguro` (sem emboscada), `estalagem` (dormir pagando),
  `mercado` (loja).

## enemies.json
```json
[{ "id": "lobo", "nome": "lobo", "genero": "m", "hp": 6, "dano": "1d4",
   "defesa": 0, "tier": 1, "xp": 2, "ouro": "0",
   "tags": ["fera"], "saque": 0.2 }]
```
- `inteligente` em `tags` habilita a opção Negociar.
- `saque`: chance (0–1) de dropar item gerado no tier do inimigo.

## items.json (sistema gerador)
```json
{
  "raridades": [
    {"id":"comum","nome":"Comum","peso":60,"afixos":0,"mult":1},
    {"id":"incomum","nome":"Incomum","peso":28,"afixos":1,"mult":2},
    {"id":"raro","nome":"Raro","peso":10,"afixos":2,"mult":4},
    {"id":"lendario","nome":"Lendário","peso":2,"afixos":3,"mult":10}
  ],
  "bases": [
    {"id":"espada","nome":"espada","genero":"f","slot":"arma","tier":1,
     "atributo":"forca","dano":"1d6","valor":10,"tags":["lamina"]},
    {"id":"gibao","nome":"gibão de couro","genero":"m","slot":"armadura","tier":1,"defesa":1,"valor":8},
    {"id":"pocao","nome":"poção de cura","genero":"f","slot":"consumivel","tier":1,
     "efeitos":[{"cura":"2d4+2"}],"valor":8},
    {"id":"corda","nome":"corda","genero":"f","slot":"ferramenta","tier":1,"valor":3,"tags":["corda"]},
    {"id":"racao","nome":"ração de viagem","genero":"f","slot":"consumivel","tier":1,"valor":2,"tags":["racao"],
     "efeitos":[{"energia":1}]}
  ],
  "qualidades": [
    {"m":"enferrujado","f":"enferrujada","slots":["arma"],"mods":{"dano":-1},"peso":3},
    {"m":"robusto","f":"robusta","slots":["arma","armadura"],"mods":{"defesa":1},"peso":2,"tier":2}
  ],
  "afixos": [
    {"texto":"do Lobo","slots":["arma","amuleto"],"mods":{"agilidade":1},"peso":3},
    {"texto":"da Aurora","slots":["amuleto","armadura"],"mods":{"hpMax":3},"peso":2,"tier":2}
  ]
}
```
- `slot`: `arma` | `armadura` | `amuleto` | `consumivel` | `ferramenta`.
- `mods`: `forca`,`agilidade`,`mente`,`presenca` (bônus em testes), `dano`, `defesa`, `hpMax`, `energiaMax`.
- Consumíveis e ferramentas não recebem qualidade nem afixos.
- Itens lendários recebem um nome próprio gerado por Markov (`names.json` → `itens`).
- `tier` (opcional) em qualidades/afixos/bases: só aparecem a partir daquele tier.
- Nome final: `Base qualidade afixo` → "Espada enferrujada do Lobo".

## events.json
```json
[{
  "id": "ponte_podre", "tipo": "perigo", "peso": 2,
  "requer": {"bioma": ["floresta","pantano"]},
  "texto": "{ponte_intro} {ponte_detalhe}",
  "opcoes": [
    { "rotulo": "Atravessar com cuidado", "teste": "agilidade", "dificuldade": 0,
      "sucesso": {"texto": "Você chega ao outro lado sem um arranhão.", "efeitos": [{"xp":1}]},
      "parcial": {"texto": "Uma tábua cede; você se agarra.", "efeitos": [{"energia":-1}]},
      "falha":   {"texto": "A ponte desaba sob seus pés.", "efeitos": [{"dano":"1d6"}]} },
    { "rotulo": "Amarrar a corda e descer", "requer": {"item_tag":"corda"},
      "resultado": {"texto": "Lento, mas seguro.", "efeitos": [{"tempo":1}]} },
    { "rotulo": "Voltar e contornar",
      "resultado": {"texto": "Horas perdidas no mato.", "efeitos": [{"tempo":1},{"energia":-1}]} }
  ]
}]
```
- `tipo`: `exploracao` (sorteado ao Explorar), `viagem` (sorteado entre biomas),
  `fio` (só disparado por um fio solto; nunca sorteado).
  Campo `tipo` é obrigatório; `perigo`, `descoberta`, `encontro`, `atmosfera`
  podem ir em `tags` para organização.
- Opção com `teste` usa `sucesso`/`parcial`/`falha`; sem teste usa `resultado`.
- `dificuldade`: soma ao alvo (positivo = mais difícil).
- `bonus_tag`: `{"corda":2}` bônus no teste se tiver item com a tag.
- Toda opção pode ter `requer` (só aparece se a condição passar).
- Opções sem teste e sem requer garantem que o jogador nunca fique preso:
  **todo evento precisa de ao menos 1 opção sem `requer`**.

### Efeitos (lista executada em ordem)
| Efeito | Exemplo |
|---|---|
| dano | `{"dano":"1d6"}` (reduzido pela defesa só em combate) |
| cura | `{"cura":"1d4"}` |
| energia | `{"energia":-1}` |
| exaustao | `{"exaustao":1}` |
| ouro | `{"ouro":"2d6"}` ou `{"ouro":-5}` |
| xp | `{"xp":2}` |
| item | `{"item":{}}`, `{"item":{"slot":"arma","raridade":"raro"}}`, `{"item":{"base":"pocao"}}` |
| perder_item_tag | `{"perder_item_tag":"racao"}` |
| combate | `{"combate":"lobo"}` (inicia combate após o texto) |
| fio | `{"fio":"lobo_alfa"}` (abre fio solto) |
| resolver_fio | `{"resolver_fio":"lobo_alfa"}` |
| tempo | `{"tempo":1}` |
| flag / remover_flag | `{"flag":"viu_altar"}` |
| traco | `{"traco":"marcado"}` |
| diario | `{"diario":"Encontrei o altar."}` (template) |

### Condições (`requer`, todas precisam passar)
`bioma: [ids]`, `local: [ids]`, `local_tags: [todas]`, `sem_local_tags: [nenhuma]`,
`periodo: [..]`, `clima: [..]`, `item_tag: "x"`, `sem_item_tag: "x"`,
`ouro_min: n`, `ferido: true`, `traco: "x"`, `sem_traco: "x"`, `flag: "x"`,
`sem_flag: "x"`, `fio: "x"`, `sem_fio: "x"`, `nivel_min: n`, `perigo_min: n`, `perigo_max: n`.

## threads.json (fios soltos)
```json
[{ "id": "lobo_alfa", "texto": "Uivos seguem seus passos.",
   "pressao": 1, "incremento": 1,
   "requer": {"bioma": ["floresta"]}, "evento": "lobo_alfa_confronto" }]
```
- A cada Explorar/Viajar a pressão sobe `incremento`. Chance de emergir =
  pressão × 10% (máx. 80%) quando `requer` passa. Ao emergir, dispara o evento
  `evento` (que deve ter `tipo: "fio"` e conter `resolver_fio` em alguma saída).

## traits.json (traços)
```json
[{ "id": "veterano", "nome": "Veterano", "descricao": "+1 em testes de força.",
   "mods": {"forca": 1} }]
```
Traços vêm da classe (`tracos`) ou do efeito `{"traco":"id"}`. Os `mods` somam
como itens equipados (podem ser negativos, ex.: cicatriz `{"agilidade":-1}`).

## names.json
```json
{ "pessoas": ["Aldric","Brenna", "..."], "lugares": ["Valdoria","..."], "itens": ["Gram","..."] }
```
Listas-semente para o gerador de Markov (mín. 20 por lista).

---
# Sistemas de profundidade (v0.2)

## Críticos e desastres
Em testes, **6+6 = `critico`** e **1+1 = `desastre`**. Uma opção pode definir as saídas
`critico` e `desastre`. Sem elas, o crítico usa `sucesso` (+1 XP) e o desastre usa `falha`.
Em combate, o crítico dobra o dano e o desastre faz o inimigo acertar e dá +1 de exaustão.

## Eventos encadeados
- Efeito `{"cena": "id_evento"}`: depois da saída, a próxima cena é esse evento.
- Eventos de continuação usam **`tipo: "cadeia"`** (nunca são sorteados).
- Com `combate` e `cena` na mesma saída, o combate vem primeiro. A cadeia só continua
  se o herói **vencer** (fugir ou negociar encerra a cadeia).
- Cadeias devem ter 2–4 passos e terminar em recompensa ou consequência clara.

## locations.json — coordenadas
Cada local tem `x` e `y` (0–100) para o mapa. O norte fica em cima.

## npcs.json (personagens recorrentes)
```json
{ "oficios": [ {"id":"ferreiro","m":"ferreiro","f":"ferreira"} ],
  "temperamentos": [ {"id":"desconfiado","m":"desconfiado","f":"desconfiada"} ] }
```
Um evento com `"npc": {"oficios": ["ferreiro","mercador"]}` (lista opcional) **vincula um NPC**:
reaproveita um NPC conhecido daquele local com ofício compatível (70%) ou gera um novo
(nome por Markov, temperamento sorteado), que passa a morar ali.
- Variáveis: `{$npc.nome}`, `{$npc.o}`, `{$npc.um}`, `{$npc.oficio}`, `{$npc.temperamento}` (com concordância).
- Tags de contexto: `npc_novo` | `npc_conhecido`, `npc_amigo` (disposição ≥ 2), `npc_hostil` (≤ −2).
- Efeito `{"disposicao": 1}` muda a disposição (−5..5) do NPC vinculado.
- Condições: `npc_conhecido: true/false`, `npc_disposicao_min: n`, `npc_disposicao_max: n`.
Use variantes de gramática com `tags: ["npc_conhecido"]` para o NPC "lembrar" do herói.

## pois.json (pontos de interesse procedurais)
```json
[{ "id": "caverna", "nome": "{poi_nome_caverna}", "genero": "f",
   "biomas": ["montanha","floresta"], "tags": ["caverna","subterraneo"], "peso": 2 }]
```
Ao **Explorar** um local fixo e não seguro, há 15% de chance de descobrir um POI (no máximo 3 por local).
O POI vira um novo local no mapa, conectado ao local de origem (`tempo` 1), herdando o
bioma e somando as tags do modelo + `poi`. `nome` é um template expandido uma única vez.
Eventos para POIs usam `requer: {"local_tags": ["caverna"]}`.
**Todo POI precisa de ≥ 2 eventos de exploração compatíveis** (o validador avisa).

## quests.json (modelos de missão)
```json
[{ "id": "cacar", "objetivo": "vencer", "oficios": ["cacador","guarda"],
   "titulo": "Caçar {$alvo.um} {$alvo.nome}",
   "pedido": "{missao_cacar_pedido}", "conclusao": "{missao_cacar_fim}",
   "recompensa": {"ouro": "2d6+4", "xp": 4} }]
```
Missões são oferecidas em locais `seguro` ("Procurar trabalho": até 3 ofertas por dia, até 3 ativas).
O motor sorteia o NPC contratante, o destino (a 1–4 conexões de distância) e o alvo.
- `objetivo`:
  - `vencer`: no destino aparece a opção de cumprir → combate com `alvo` (inimigo do bioma do destino). Depois, volte ao contratante.
  - `explorar`: no destino aparece a opção de investigar → teste de mente (falha causa dano e permite tentar de novo). Depois, volte ao contratante.
  - `chegar`: o herói recebe um pacote; ao chegar ao destino, entrega e recebe a recompensa ali mesmo.
- Variáveis: `$npc` (contratante), `$destino`, `$alvo` (inimigo, em `vencer`).
- A recompensa escala com a distância. Ao entregar: +2 de disposição com o contratante.

Tabelas obrigatórias novas: `poi_descoberta` (usa `$poi`), `trabalho_intro`, `missao_entregue`.
