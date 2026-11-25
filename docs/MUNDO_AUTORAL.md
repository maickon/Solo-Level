# Mundo Autoral — documento de design

> Status: **aprovado em linhas gerais** (decisões na seção 21). **Fase A entregue**: gerador, mapa, validador e
> primeiro rascunho em `mundo/` (formato em `docs/SEMENTE.md`), aguardando curadoria. Substitui a ideia de "mundo infinito procedural" (seção A de
> `PROXIMAS_FASES.md`) como direção principal do jogo. **Fase B mínima**: o jogo carrega Vandor (partida em
> Cornvale). **Fase C (fatia vertical)**: bíblias, sub-lugares, pessoas fixas com conversas e eventos por lugar;
> Aldwick construído (Cornvale nível 3), vizinhos em nível 1. Pendentes: legado, fatos/rumores, calendário, rotas de barco, editor.

## 1. Visão
Um mundo de fantasia medieval **finito, vivo e coerente**, com centenas de lugares conhecidos: cidades,
ilhas, ruínas, masmorras, florestas, mares, outros planos. Cada lugar tem identidade própria, pessoas,
segredos e histórias que se interligam. O jogador explora, mede o quanto já conhece (% de exploração) e
sente que o mundo reage ao que ele faz.

O mundo nasce de uma **Semente do Mundo**: um documento-base que descreve o mundo inteiro em linhas
gerais. A partir dela, os lugares são escritos aos poucos, cada um com o nível de detalhe que já recebeu,
e o jogo funciona desde que existam algumas cidades prontas.

## 2. Por que mudar
O texto atual parece "sem contexto" por três causas de arquitetura:
1. **Frases montadas por peças independentes.** Abertura, detalhe e gancho são sorteados sem saber
   qual história está sendo contada. As regras `diz`/`nao` evitam contradições explícitas, mas a
   coerência fica restrita à frase, nunca chega à narrativa.
2. **Eventos são vinhetas soltas.** Premissa → escolha → resultado, com pouca ligação entre um evento e outro.
3. **Lugares gerados não têm identidade.** Para servir a qualquer região, o texto precisa ser genérico.

A proposta troca *composição aleatória* por **conteúdo autoral com variação controlada**: alguém
escreve o fluxo (então ele faz sentido) e o motor só varia o que é seguro variar.

## 3. Princípios
1. **A Semente é a verdade.** Todo texto obedece aos fatos da Semente; nada contradiz o que já foi escrito.
2. **Escrito, não montado.** Cada trecho narrativo é escrito inteiro, com lacunas (hora, nome, clima,
   fatos do lugar). As lacunas variam; o sentido não.
3. **Escala por arquétipos + fatos.** Centenas de lugares se apoiam em dezenas de arquétipos bem
   escritos ("biblioteca", "estrada de montanha"), preenchidos pela bíblia de cada lugar. Peças
   exclusivas só onde importa.
4. **Interligação por fatos, nunca por fio direto.** Eventos registram fatos ("a guarda de Kholar te
   procura"); outros eventos, em qualquer lugar, reagem a eles.
5. **O mundo lembra.** Eventos se esgotam ou mudam depois de vistos; lugares mudam de estado.
6. **No máximo 4 opções** por tela.
7. **Jogável cedo, completo depois.** Um lugar fica visitável antes de estar totalmente escrito.
8. **Identificadores eternos.** Um lugar pode ser reescrito à vontade; seu id nunca muda (saves continuam valendo).

## 4. A Semente do Mundo
### 4.1 O que ela descreve
| Camada | Conteúdo |
|---|---|
| **Mundo** | nome, era atual, linha do tempo curta (5–10 marcos), regras da magia, o que é comum e o que é lendário, mistérios em aberto |
| **Continentes e oceanos** | forma aproximada, clima por latitude, mares, correntes, ilhas e arquipélagos |
| **Reinos e territórios** | governo, capital, cultura, religião, economia, aliados e rivais, tensão atual, fronteiras |
| **Culturas** | estilo de nomes, arquitetura, vestimenta, comida, festas, valores, medos; perfil de cenário e de música |
| **Facções** | guildas, ordens, cultos, bandos: objetivo, onde atuam, com quem disputam |
| **Lugares** | cidades, vilas, castelos, mosteiros, ruínas, masmorras, florestas, montanhas, vulcões, ilhas, planos; cada um com tipo, bioma, reino, posição e uma linha de conceito |
| **Rotas** | estradas, trilhas, rios, rotas marítimas, passagens de montanha, portais; tipo, duração, perigo, meio de transporte exigido |
| **Economia** | o que cada região produz e precisa; rotas comerciais (definem o que se vende onde) |

### 4.2 Níveis de detalhe (status de construção)
| Nível | Existe | No jogo |
|---|---|---|
| **0 · Esboço** | nome, tipo, bioma, reino, posição, ligações, conceito em uma linha | aparece no mapa como "terras ainda não mapeadas"; acesso bloqueado por motivo de história (passo nevado, fronteira fechada, nenhum barco faz a rota) |
| **1 · Bíblia** | fatos do lugar (seção 6) | visitável; eventos de **arquétipo** alimentados pela bíblia |
| **2 · Sub-lugares** | sub-lugares nomeados com seus personagens | "Ir a…" dentro do lugar; eventos de arquétipo por sub-lugar |
| **3 · Autoral** | eventos exclusivos, cadeias, ganchos com outros lugares, estados especiais | experiência completa |

Cada entrada guarda seu nível, a data em que subiu e quem revisou. Um **relatório de construção** mostra
o progresso: "Mundo 9% construído · Reino de Valdor 60% · Kholar nível 3".
O **% construído** (autoria) é diferente do **% explorado** (jogador).

### 4.3 Organização em arquivos
- Um **índice geral** do mundo (camadas Mundo, Continentes, Reinos, Culturas, Facções, rotas principais).
- **Uma pasta por reino/território**, com um arquivo por lugar (bíblia, sub-lugares, eventos).
- Assim o mundo cresce sem um arquivo gigante, e cada etapa de escrita lê só o necessário
  (o lugar, seus vizinhos e os fatos do reino), o que também economiza tokens.

### 4.4 Detalhe perto, vago longe
A região inicial é detalhada; as bordas ficam em esboço ("um reino de mercadores ao sul, em guerra
fria com o norte"). Isso evita fatos que depois contradigam o que se quer escrever e deixa as grandes
decisões em aberto até sentirmos o que funciona.

## 5. Gerador da Semente
- Gera um **rascunho reproduzível** (mesma semente numérica → mesmo rascunho): geografia
  (continentes, cordilheiras, rios, costas, ilhas), clima por latitude, reinos e fronteiras, culturas,
  distribuição de lugares por tipo e bioma, rotas e economia básica.
- **Curadoria obrigatória**: você revisa nomes, culturas, tensões e cortes. Depois de aprovado, o
  arquivo curado é a verdade e **nunca é regerado por cima**; o gerador só propõe acréscimos.
- O atual gerador de regiões (`regioes.js`) muda de papel: deixa de criar lugares durante o jogo e
  passa a propor esboços para a Semente.
- Escala do primeiro mundo (decisão: **mais reinos**):
  - 3 continentes, 2 arquipélagos e mares com ilhas isoladas;
  - **14–18 reinos e territórios**: reinos humanos de vários perfis, reinos de outras raças (anões,
    elfos, povos das marés, orcs/tribos, halflings, gigantes…), cidades-estado, teocracias, impérios
    em decadência, terras sem lei e territórios selvagens sem governo;
  - ~80 povoados (capitais, cidades, vilas, aldeias, fortes, mosteiros, portos);
  - ~250 lugares de natureza, ruína e masmorra; 5–7 planos de existência (acessíveis só por magia).
- Nem tudo precisa nascer escrito: a maior parte começa no **nível 0** e só a região inicial sobe cedo.

## 6. Bíblia de um lugar
Campos de fatos (nem todos obrigatórios):
- **Identidade**: nome, tipo, reino, cultura, população (ordem de grandeza), aparência em 2–3 frases, cheiros e sons.
- **Poder**: quem manda, como, quem contesta.
- **Situação atual**: problema do momento, boato que corre, medo do povo, esperança do povo.
- **Vida**: festa local, comida típica, ofícios, o que produz e o que importa.
- **Segredo**: algo que poucos sabem (gancho para eventos).
- **Estados possíveis**: em festa, sitiado, em luto, sob peste, em eleição… cada um ativa outros eventos.
- **Sub-lugares**: lista com função e personagem fixo (ex.: Biblioteca — guardada por Irmã Veyra).
- **Pessoas notáveis**: 3–8 personagens com rotina por período do dia.
- **Ligações**: rotas para fora e o que é preciso para usá-las.

As lacunas dos textos de arquétipo puxam desses campos: o mesmo evento de "biblioteca" fala da peste
em uma cidade e da sucessão do trono em outra.

## 7. Eventos autorais
### 7.1 Forma
- Árvores **curtas** (1–4 nós), cada nó com: texto principal escrito inteiro, 2–6 versões equivalentes,
  lacunas (hora, nome, clima, fatos do lugar), até 4 opções, resultados, efeitos, fatos registrados.
- **Arquétipos**: eventos escritos uma vez por tipo de sub-lugar/ambiente, parametrizados pela bíblia.
- **Exclusivos**: eventos de um lugar específico, que só fazem sentido ali.
- **Cadeias**: sequências que atravessam lugares (seguem pelos fatos, não por ligação fixa).

### 7.2 Condições
Hora do dia, clima, estação, estado do lugar, fatos do mundo e do herói, reputação, itens, nível,
presença de um personagem (pela rotina dele). Exemplo: o contrabandista só está no cais de madrugada.

### 7.3 Esgotamento e memória
- Eventos têm **uso**: único, por visita, com recarga ou repetível.
- Depois de visto, um evento pode **trocar de versão** (o taberneiro lembra de você).
- O jogador percebe repetição de **situações**, não de palavras: esgotamento e estados importam mais
  que variantes de frase.

### 7.4 O texto curto que liga as cenas
Chegada, retorno, passagem do tempo e descanso continuam usando a gramática por partes, mas só como
**acabamento**, presa aos fatos do lugar e ao contexto (nunca para contar a história).

## 8. Interligação: fatos, rumores e ganchos
- **Fatos** (qualidades): o que o herói fez, sabe e é ("aliado da Guilda", "procurado em Valdor",
  "sabe do túnel sob o farol"). Eventos pedem e mudam fatos.
- **Rumores**: tavernas, praças e viajantes contam rumores que apontam para eventos em outros
  lugares. É a cola natural entre lugares e o motivo para viajar.
- **Quadro de avisos**: missões que nascem dos problemas registrados na bíblia de cada lugar.
- **Mistérios da Semente**: ganchos globais em aberto, resolvidos aos poucos por cadeias em vários lugares.

## 9. Mundo vivo
- **Calendário**: dias da semana, estações, festas por cultura (feira no dia 7, procissão de inverno).
- **Rotinas**: personagens em lugares diferentes conforme a hora; quem você encontra depende de quando vai.
- **Estados de lugar**: mudam por eventos, pelo calendário ou por ações do jogador, e trocam o
  conjunto de eventos disponíveis.
- **Consequências persistentes**: o que você faz altera bíblias (o mercado queimado continua queimado).

## 10. Viagem
- **Rotas tipadas**: estrada, trilha, rio, mar, passagem de montanha, túnel, portal.
- **Meios**: a pé, montaria, barco de rio, navio (passagem paga no porto, horários), meios mágicos
  (dragão, barco voador, portal) obtidos por cadeias de missões.
- **Isolamento real**: ilhas só por mar; lugares só por magia.
- **Trechos**: rotas longas têm paradas e eventos de estrada próprios, coerentes com o bioma e o perigo.

## 11. Interface
- **Máximo de 4 opções** por tela, em níveis. No lugar: *Andar por [lugar] · Ir a… · Viajar · Descansar*;
  em "Ir a…": os 3 sub-lugares mais relevantes do momento e "Voltar".
- **Mapa desenhado a partir da Semente**: costas, rios, cordilheiras, rotas; névoa onde o jogador
  não foi; tom diferente para o que ainda não foi construído (nível 0).
- **Códice**: cada lugar visitado, pessoa conhecida e segredo descoberto vira uma entrada de lore.
- **% de exploração** por lugar, reino e mundo, alimentado pelo códice.

## 12. Economia regional
O que se vende em cada lugar vem da economia da Semente: a cidade anã vende machados e cotas, o porto
vende cordas e passagens, o oásis vende odres. Preços variam com a distância das fontes e com estados
(cerco encarece comida).

## 13. Clima, cultura e apresentação
- **Clima por latitude** e estação: neve no norte, monções no sul, sem escrever clima à mão.
- **Cultura define apresentação**: estilo de nomes (gerador de nomes por cultura), perfil de cenário
  (silhuetas, cores), escala musical do ambiente, vocabulário de saudações.

## 14. O que acontece com o que já existe
| Peça atual | Destino |
|---|---|
| Motor de lacunas, concordância, artigos, `diz`/`nao` | **Mantém**: preenche as lacunas dos textos autorais |
| Condições, efeitos, testes 2d6, críticos | **Mantém** |
| Seleção de eventos por contexto (storylets) | **Mantém**, ganha fatos, estados e rotinas |
| NPCs recorrentes e disposição | **Mantém**, NPCs fixos passam a vir da bíblia |
| Missões geradas | **Muda**: nascem dos problemas das bíblias |
| Estabelecimentos sorteados | **Muda**: viram sub-lugares fixos da bíblia |
| Molduras de frases por partes | **Muda**: só acabamento de transições |
| Gerador infinito de regiões | **Muda de papel**: ferramenta de esboço para a Semente |
| Cenário e som por bioma | **Mantém**, ganha perfil por cultura |
| Validador, playtest, revisor de texto | **Mantém e cresce** (seção 16) |
| Conteúdo atual (eventos, biomas, inimigos) | **Aproveitado** como base de arquétipos e bestiário; o que for genérico demais é reescrito |

Saves atuais não migram para o mundo novo (novo formato de estado).

## 15. Fluxo de autoria
1. Gerar o rascunho da Semente → curadoria sua → Semente oficial.
2. Escolher a **região inicial** (um reino, 2–3 cidades e arredores) e levá-la ao nível 3.
3. Para cada lugar: ler a entrada na Semente, os vizinhos e os fatos do reino → escrever bíblia →
   sub-lugares → eventos → validar (validador, playtest, revisor) → subir o nível.
4. Cada etapa termina com o relatório de construção atualizado e uma rodada de testes.
5. Você joga as partes prontas e aprova (ou pede ajustes) antes de expandir.

## 16. Qualidade
Além do que já existe (`npm run qa`, `npm run ui`, revisor de texto):
- **Consistência com a Semente**: nenhum texto cita lugar, pessoa, facção ou fato inexistente; nomes
  seguem o estilo da cultura.
- **Cobertura por lugar**: todo lugar de nível ≥ 1 tem eventos suficientes para cada período do dia;
  todo sub-lugar tem saída; nenhum lugar visitável sem rota.
- **Alcance**: rotas permitem chegar a tudo o que está construído (com os meios previstos).
- **Esgotamento**: o playtest mede quantas visitas até um lugar "ficar sem novidade".
- **Limite de 4 opções** verificado em toda cena.
- **Relatório de construção** gerado junto com o playtest.

## 17. Plano em fases
| Fase | Entrega | Você valida |
|---|---|---|
| **A · Semente** | formato da Semente, gerador de rascunho (com 14–18 reinos, culturas, Grande Crise e linha do tempo), relatório de construção, mapa desenhado | o mundo gerado e curado; escolha do reino e da cidade iniciais |
| **B · Motor autoral** | lugares por níveis, bíblias, sub-lugares, eventos com esgotamento, fatos, rumores, calendário, rotinas, menus de 4 opções, viagem por rotas e meios, estado separado em mundo e herói (legado), atos da Grande Crise | o funcionamento com um lugar de teste |
| **C · Fatia vertical** | região inicial completa: Kholar + 1–2 cidades vizinhas + arredores, ~10 sub-lugares e ~30 eventos autorais por cidade | se ainda parece repetitivo ou desconexo |
| **D · Expansão** | reino a reino, subindo níveis com o fluxo da seção 15 | cada reino |
| **E · Editor** | painel para criar e editar lugares e eventos com validação ao vivo | o uso do editor |

## 18. Fio principal: a Grande Crise
O mundo tem uma **crise de escala mundial**, descrita na Semente e **opcional** para o jogador:
- Nasce de um mistério da linha do tempo (algo que despertou, voltou ou está ruindo).
- Avança **em atos** com o passar do tempo e com o que o jogador fizer (ou deixar de fazer):
  sinais em rumores → regiões mudam de estado → reinos reagem → confronto final.
- Pistas espalhadas por vários reinos: resolver a crise exige explorar o mundo.
- Quem ignora a crise continua vivendo histórias locais; o mundo, porém, segue mudando ao redor.
- A crise tem um ou mais desfechos que **mudam o mundo** de forma permanente (ver seção 19, legado).

## 19. Morte, legado e mundo persistente
Decisão: **a morte do herói é permanente, o mundo não.**
- O estado se divide em **mundo** (persiste entre heróis: lugares, estados, crise, fatos públicos,
  % explorado) e **herói** (morre com ele: ficha, inventário, fatos pessoais).
- O novo herói começa no mesmo mundo, **tempo depois**: encontra o túmulo ou a lenda do anterior,
  pessoas que lembram dele, consequências do que ele fez, talvez o equipamento que ficou para trás.
- Feitos de heróis anteriores viram fatos do mundo ("a ponte que Ilsa derrubou", "o culto que Doran
  expulsou") e entram no códice como **Crônica**.
- O % explorado é do mundo; o códice registra quem descobriu cada coisa.
- Isso prepara a ideia futura de mundo compartilhado (os feitos já ficam separados do herói).

## 20. Riscos
- **Volume de escrita**: mitigado por arquétipos + bíblias e pelos níveis (jogável no nível 1).
- **Contradições entre lugares**: mitigadas pela Semente, pelo validador de consistência e pelo revisor.
- **Escopo**: a fatia vertical (fase C) existe para descobrir problemas antes de escrever centenas de lugares.
- **Mundo finito "acaba"**: compensado por eventos repetíveis bem escritos, estados de lugar, calendário
  e pela expansão contínua da Semente.

## 21. Decisões tomadas
| # | Pergunta | Decisão |
|---|---|---|
| 1 | Mundo infinito | **Substituído por completo** pelo mundo autoral finito; o gerador de regiões vira ferramenta de esboço |
| 2 | Tom | **Fantasia medieval com magia, poderes e um mundo fantástico** (raças, criaturas, planos, relíquias) |
| 3 | Cidade inicial | "Kholar" era só exemplo. A cidade e o reino iniciais são escolhidos na **curadoria da Semente** |
| 4 | Escala | **Mais reinos**: 14–18 reinos/territórios (seção 5) |
| 5 | Fio principal | **Sim**: Grande Crise opcional, em atos (seção 18) |
| 6 | Morte | **Permanente para o herói; o mundo continua** com marcas do anterior (seção 19) |
| 7 | Saves | **Saves atuais são zerados** quando o mundo novo entrar (nova versão do estado) |
