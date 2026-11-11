---
name: playtest
description: Testar o SoloLevel a fundo antes de concluir — playtest em massa com robôs de estilos diferentes, detecção de erros, textos estranhos, concordância, becos sem saída, laços, cobertura de conteúdo e equilíbrio; revisão semântica por agente; teste no navegador real. Use após mudanças de motor ou de conteúdo e antes de commit/deploy.
---

# Playtest

Rode na ordem e só conclua com tudo verde (ou com cada aviso explicado ao usuário).

1. `npm run qa` — validação + testes + playtest em massa (120 partidas × 400 turnos, 6 estilos de jogador:
   aleatório, cauteloso, explorador, social, guerreiro, missões; heróis masculinos e femininos).
   - Sai com erro se houver **PROBLEMAS** (exceção, token/tabela quebrada, valor inválido, beco sem saída,
     estado inválido). Corrija sempre.
   - Leia `reports/playtest.md`: avisos por código —
     `genero` (concordância com o herói), `contracao`/`artigo`, `repeticao`, `frase_dupla`, `bloco_duplo`,
     `pronome` (cena começa com Ele/Ela), `opcao_dupla`, `beco`, `laco`, `longa`, `aspas`, `maiuscula`.
     Cada aviso traz um exemplo e o `[evento: id]` de origem; corrija com Grep pelo trecho. Falsos positivos
     (ex.: "os pés … sozinhos") podem ficar, mas diga quais.
   - Confira: mortes por estilo (balanceamento), textos mais repetidos (precisam de variações), eventos
     nunca alcançados (condições restritivas demais ou conteúdo morto).
   - Mais fundo: `npm run playtest -- --partidas 400 --turnos 800 --semente outra`.
2. Revisão semântica (o robô não entende sentido): delegue ao agente `revisor-texto` a leitura de
   `reports/amostras.md` (60 cenas reais com opções). Ele devolve problemas de lógica, coerência,
   tom e escolhas sem sentido, com o id do evento. Corrija os reais.
3. Mudou UI/CSS? Com `npm run dev` rodando: `npm run ui` (Chrome/Edge headless joga ~120 turnos,
   captura computador e celular em `reports/ui/`, falha com erro de console). Olhe as capturas.
4. Novos padrões de erro que só você ou o revisor notaram viram verificação nova em `tools/estilo.mjs`
   (texto) ou no lint de templates `lintTemplate` em `public/src/engine/grammar.js`, com teste.
