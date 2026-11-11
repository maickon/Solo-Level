# Solo-Level

RPG solo procedural, infinito e só de escolhas, em português. Um mundo de fantasia medieval que se escreve
enquanto você caminha: regiões geradas sem fim, masmorras, outros planos, pessoas que lembram de você,
missões, atividades que mudam com o lugar e a hora, cenário animado, som procedural e narração por voz.

**Jogar:** https://maickon.github.io/Solo-Level/

## Como funciona
- Sem IA em tempo de jogo e sem servidor: JavaScript puro (ES modules), conteúdo em JSON.
- Texto procedural com gramática própria (coerência por fatos da cena, concordância, referência).
- Regras próprias (2d6 + atributo), gerador de itens, vida escassa e morte permanente.
- Cenário e som gerados por código; narração neural opcional (Piper, roda no navegador).

## Desenvolvimento
```bash
npm run dev       # servidor local em http://127.0.0.1:5173
npm run check     # validação de conteúdo + simulação + testes
npm run playtest  # 120 partidas com robôs; relatório em reports/
npm run ui        # teste no navegador real (com o servidor rodando)
```
O site publicado é a pasta `public/`. Cada push na branch `master` roda os testes e publica no GitHub Pages
(`.github/workflows/pages.yml`). Contrato de conteúdo: `docs/CONTENT_SCHEMA.md`; arquitetura: `docs/ARCHITECTURE.md`.
