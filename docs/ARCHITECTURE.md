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

## Roadmap sugerido
1. Painel admin (editor de pacotes com validação ao vivo, usando `validate()`).
2. Firestore: autoria de pacotes pelo admin → botão "Publicar" exporta JSON para o Hosting;
   save na nuvem opcional (Auth), sincronizado só em checkpoints.
3. IndexedDB no lugar do localStorage; PWA offline.
4. Mais conteúdo: biomas (alto-mar via porto), fios encadeados, NPCs recorrentes.
