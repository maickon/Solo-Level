# Próximas fases (proposta)

## A. Mundo vasto e infinito (crítica direta: poucos tipos de lugar)
Hoje: 10 locais fixos + pontos de interesse. Proposta: **regiões procedurais sem fim**.
- **Fronteira**: locais na borda do mapa têm caminhos para "terras desconhecidas". Viajar até lá gera uma
  região nova a partir de um modelo, com nome, locais internos, conexões e posição no mapa (semente do mundo).
- **Modelos de região** (`regioes.json`), cada um com bioma, perfil visual/sonoro, inimigos, eventos,
  estabelecimentos e raridade. Exemplos (100% fantasia medieval):
  - Natureza: floresta élfica, bosque feérico, selva, tundra, geleira, deserto, oásis, savana, vulcão,
    planalto de ventos, cânion, lago de névoa, manguezal, arquipélago, ilha deserta, recife, mar aberto.
  - Civilização: cidade grande (bairros), castelo e feudo, mosteiro na montanha, cidade anã subterrânea,
    acampamento orc, vila halfling, porto pirata, cidadela arruinada, posto de fronteira, feira itinerante.
  - Profundezas: masmorra (salas encadeadas), catacumbas, minas abandonadas, cavernas de cristal, ninho de
    dragão, templo submerso, labirinto.
  - Outros planos (raros, por portais/rituais): Reino Feérico, Plano das Sombras, Planos Elementais
    (fogo, água, ar, terra), Terras dos Mortos, Céu Partido.
- **Masmorras** como sequência de salas (entrada → salas → chefe → tesouro) com recuo possível.
- Cada modelo novo exige perfis em `cenario.js` e `ambience.js`; o resto é conteúdo (agente escritor).

## B. Escolhas más e consequências (inclusive para metajogo)
- **Ações más** em eventos e atividades: furtar, mentir, trapacear, extorquir, trair, roubar oferendas,
  matar quem confiou. Sempre uma escolha, nunca obrigatória.
- **Reputação por região** (−10..10) e **infâmia/fama** globais. Efeitos: preços, quem aceita falar,
  missões oferecidas, guarda hostil, "procurado" na região, caçadores de recompensa, fios de vingança.
- **Testemunhas**: um teste decide se alguém viu; se ninguém viu, a consequência pode vir tarde (fio).
- **Anti-metajogo**: o mundo nota padrões, não clique isolado. Exemplos:
  - fugir de todo combate → boatos de covardia (traço com −1 presença até se redimir);
  - aceitar e abandonar missões em série → contratantes deixam de confiar (ofertas piores);
  - recusar toda proposta só para "rolar" outras → ninguém aparece até o dia seguinte;
  - descansar em excesso no mesmo lugar → estalajadeiro sobe o preço, rumores de ociosidade;
  - saquear quem ajudou → NPC some, aparece depois como inimigo.
- Novos efeitos/condições: `reputacao`, `infamia`, `testemunha`; condições `reputacao_min/max`,
  `infamia_min`, `procurado`. Tudo coberto por testes e pelo playtest (estilo de robô "vilão").

## C. Futuro: memory card e mundo compartilhado (não agora)
- **Memory card**: exportar/importar o save como arquivo. Um checksum (SHA-256) detecta arquivo
  corrompido, mas **não impede edição**: quem edita recalcula. Para impedir trapaça é preciso uma
  **assinatura feita no servidor** (chave secreta que o jogador não tem).
- **Mundo compartilhado**: o jogador envia só os **feitos importantes** (não o save inteiro); um servidor
  valida, assina e grava "lendas" por local ("Ilsa limpou o Pântano Negro no dia 40"). Outros jogadores
  veem essas marcas, rankings de fama e força. Firebase cabe: Auth + Firestore + Cloud Functions
  (as Functions exigem o plano Blaze, que tem cota gratuita mas pede cartão).
- Pré-requisitos já no caminho: estado determinístico com semente e eventos com ids estáveis.
