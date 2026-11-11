---
name: verificar
description: Verificar o SoloLevel após mudanças — validação de conteúdo, simulação por bot, testes unitários e checagem visual no navegador. Use antes de concluir qualquer tarefa ou de fazer deploy.
---

# Verificar

1. `npm run check`: validador (referências, tabelas, condições, efeitos) + simulação
   (40 partidas, ~4000 turnos) + `node:test`. Tudo precisa passar.
   - "PROBLEMA: tabela ausente / token não expandido" → corrija o template no JSON.
   - "sem opções no modo evento" → evento sem opção livre de `requer`.
   - Antes de concluir mudanças grandes de motor ou conteúdo, rode a skill `/playtest`
     (`npm run qa` + revisão semântica + `npm run ui`).
2. Mudou UI ou CSS? Suba `npm run dev` em segundo plano e confira no navegador
   (desktop e largura de 390px) com `npm run ui` (Chrome/Edge headless, capturas em `reports/ui/`);
   console sem erros é obrigatório.
3. Deploy só quando o usuário pedir: `npm run deploy` (Firebase Hosting, pasta `public/`).
