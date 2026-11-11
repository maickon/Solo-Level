---
name: conteudo
description: Criar ou expandir conteúdo do SoloLevel (eventos, biomas, locais, inimigos, itens, fios soltos, gramática, classes, traços) nos pacotes JSON. Use ao adicionar ou editar qualquer dado em public/data/packs.
---

# Criar conteúdo

1. Leia `docs/CONTENT_SCHEMA.md` (o contrato). **Não** leia os JSON inteiros: use Grep por id
   (ex.: `"id": "lobo"`) ou pela chave da tabela de gramática.
2. Decida o local: conteúdo novo e temático vai num **pacote novo** `public/data/packs/<tema>/`
   (com `manifest.json`) adicionado a `packs/index.json`. Ajustes no núcleo vão em `core/`.
   Pacotes posteriores mesclam por `id` e concatenam gramática e nomes.
3. Checklist por tipo:
   - **Evento**: `tipo` obrigatório; ≥1 opção sem `requer`; opções com `teste` têm
     `sucesso`/`parcial`/`falha`; use `requer.item_tag` ou `bonus_tag` para o inventário importar.
   - **Local**: conexões recíprocas; `genero` para artigos; o bioma precisa existir.
   - **Fio**: evento `tipo: "fio"` com `resolver_fio` em todas as saídas finais; algum evento abre o fio com `{"fio": id}`.
   - **Gramática**: toda `{tabela}` usada precisa existir; use `tags` (bioma, período, clima) para variar.
     Textos frequentes = molduras por partes (`{parte_a} {parte_b}`) com `diz`/`nao` contra contradições.
     Lugares sempre com artigo pronto (`{$local.no_nome}`, nunca "em {$local.o} …"); entidades com
     `{$inimigo.Ref}`/`{$npc.Ref}` (nunca "Ele" solto).
   - **Cura é escassa**: evite `cura` em eventos; prefira dropar `erva`/`pocao_menor`.
4. Texto: 1–2 frases, 2ª pessoa, atmosférico, PT-BR com acentos. Concordância com o herói: `{=cansado/cansada@heroi}`.
5. Rode `npm run validate` e corrija **todos** os erros e PROBLEMAS (a simulação acusa textos e tokens quebrados).
   Acompanhe a linha **Variedade** (% de textos distintos) e os avisos de estilo (`--estilo` lista todos).

Para grande volume (mais de 10 eventos), delegue ao agente `escritor-conteudo` com o tema e as quantidades.
