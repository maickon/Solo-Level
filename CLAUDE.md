# SoloLevel

RPG solo procedural, infinito e só de escolhas (sem digitação), em PT-BR. Sem IA em tempo de jogo, sem
servidor: ES modules puros, zero dependências, conteúdo em JSON, hospedado no Firebase Hosting.

## Comandos
- `npm run dev`: servidor local em http://127.0.0.1:5173 (`fetch` exige servidor; `file://` não funciona)
- `npm run check`: validação de conteúdo + simulação + testes. **Rode após qualquer mudança.**
- `npm run validate`: só conteúdo + simulação (bot joga ~4000 turnos procurando textos quebrados e estados inválidos)
- `npm run deploy`: Firebase Hosting (requer `firebase login` e `firebase use <projeto>`)

## Mapa
- `public/src/engine/`: motor puro, sem DOM. `game.js` orquestra; `rules.js` regras e efeitos;
  `items.js` gerador de itens; `grammar.js` texto procedural; `conditions.js` condições; `hero.js` ficha;
  `content.js` carga, mescla e validação de pacotes; `rng.js` RNG com semente; `names.js` Markov;
  `world.js` POIs, conexões dinâmicas e distâncias; `npcs.js` NPCs recorrentes; `quests.js` gerador de missões.
- `public/src/main.js`: UI (só lê `game.s.cena` e chama a API do `Game`). `storage.js` save local. `audio/` som procedural.
- `public/data/packs/<id>/`: pacotes de conteúdo. **Contrato: `docs/CONTENT_SCHEMA.md`.**
- `tools/`: validador e simulação (Node). `tests/`: `node:test`.
- `docs/ARCHITECTURE.md`: decisões e fluxo de cena.

## Regras do projeto
- Lógica de jogo **só** no motor; a UI nunca altera o estado direto.
- Todo sorteio passa por `g.rng` (determinístico, estado salvo em `state.rng`). Nunca use `Math.random` no motor.
- Novo efeito ou condição: adicionar em `rules.js` (`EFFECTS`) ou `conditions.js` (`CHECKS`), documentar
  em `docs/CONTENT_SCHEMA.md` e cobrir em `tests/`. O validador reconhece automaticamente.
- Mudou o formato do estado? Incremente `SAVE_VERSION` em `game.js`.
- Texto: enxuto, atmosférico, 2ª pessoa, PT-BR. Concordância de gênero via `{=m/f@heroi}`.
- A vida é o recurso mais precioso: cura deve ser escassa. Balanceamento vai em dados, não em código.

## Economia de tokens
- Não leia os JSON de pacote inteiros (são grandes): use Grep por id ou chave.
- Para entender o contrato de conteúdo, leia `docs/CONTENT_SCHEMA.md`, não os pacotes.
- Use as skills do projeto: `/conteudo` (criar conteúdo), `/regras` (mudar mecânica), `/verificar` (testar).
- Delegue volume de conteúdo ao agente `escritor-conteudo` (Sonnet).
