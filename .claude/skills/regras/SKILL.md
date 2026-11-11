---
name: regras
description: Alterar mecânicas do motor do SoloLevel — sistema de testes 2d6, vida/energia/exaustão, descanso, combate, progressão, gerador de itens, novos efeitos ou condições declarativas, fluxo de cenas. Use ao mexer em public/src/engine.
---

# Mudar regras do motor

Mapa (`public/src/engine/`): `rules.js` (testes, efeitos `EFFECTS`, combate, descanso, tempo, XP)
· `conditions.js` (`CHECKS`) · `game.js` (cenas e ações `act_<tipo>`) · `items.js` · `hero.js` (stats derivados)
· `grammar.js` · `content.js` (carga e `validate`) · `world.js` (POIs, `conexoes()`, `loc()`, distâncias)
· `npcs.js` (vincular, disposição) · `quests.js` (ofertas e geração). Visão geral: `docs/ARCHITECTURE.md`.
Locais podem ser dinâmicos: use sempre `loc(g, id)` e `conexoes(g, id)`, nunca `content.locations[id]` direto.

Invariantes:
- Motor sem DOM; UI só chama `game.choose(i)`, `usarItem`, `equiparItem`, `descartarItem`.
- Todo acaso via `g.rng` (nunca `Math.random`). Estado 100% serializável.
- Feedback ao jogador: `g.say(template)` para narração, `g.note(txt, classe)` para números, `g.diary(txt)` para o diário.
- HP ≤ 0 → `morrer(g)`. Após qualquer dano, verifique `g.s.morto` antes de continuar.

Receitas:
- **Novo efeito**: função em `EFFECTS` (rules.js) → aparece em `EFFECT_KEYS` e o validador aceita.
  Documente na tabela de efeitos do `docs/CONTENT_SCHEMA.md`.
- **Nova condição**: entrada em `CHECKS` (conditions.js) + doc no schema.
- **Nova ação/cena**: opção via `this.opt(rotulo, {tipo})` + método `act_<tipo>` em `game.js`; termine com `hub()`, `afterResolve()` ou `commit()`.
- **Nova tabela de gramática exigida pelo motor**: adicione em `REQUIRED_TABLES` (content.js) e no conteúdo.
- **Formato do estado mudou**: incremente `SAVE_VERSION` (game.js).
- **Balanceamento**: prefira mudar números nos dados (JSON) antes de mudar código.

Sempre: adicione ou ajuste o teste em `tests/engine.test.mjs` (a fixture mínima fica no topo) e rode `npm run check`.
