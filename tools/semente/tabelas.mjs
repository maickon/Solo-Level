// Tabelas de base do gerador da Semente do Mundo: povos, culturas (com estilo de nomes próprio), governos,
// lugares por bioma, linha do tempo, facções, panteão e modelos de Grande Crise. Tudo em dados.

// Vocabulário geográfico da Semente (independente dos biomas do jogo; o mapeamento fica em BIOMA_JOGO).
export const BIOMAS = {
  mar:            { nome: 'Mar',              cor: '#2a4a6b' },
  costa:          { nome: 'Costa',            cor: '#c9b98a' },
  planicie:       { nome: 'Planície',         cor: '#8fa65a' },
  colinas:        { nome: 'Colinas',          cor: '#7d8f4f' },
  floresta:       { nome: 'Floresta',         cor: '#3f6b3a' },
  floresta_antiga:{ nome: 'Floresta Antiga',  cor: '#2c5232' },
  selva:          { nome: 'Selva',            cor: '#2f7a3e' },
  pantano:        { nome: 'Pântano',          cor: '#5d6b45' },
  savana:         { nome: 'Savana',           cor: '#b5a45a' },
  deserto:        { nome: 'Deserto',          cor: '#d9c08a' },
  tundra:         { nome: 'Tundra',           cor: '#a7b3a8' },
  geleira:        { nome: 'Geleira',          cor: '#e4ecf2' },
  montanha:       { nome: 'Montanha',         cor: '#8a7f73' },
  vulcanico:      { nome: 'Terras Vulcânicas',cor: '#6b3a2e' },
};
// Bioma correspondente do jogo atual (usado na Fase B).
export const BIOMA_JOGO = {
  costa: 'costa', planicie: 'estrada', colinas: 'estrada', floresta: 'floresta', floresta_antiga: 'floresta_elfica',
  selva: 'selva', pantano: 'pantano', savana: 'savana', deserto: 'deserto', tundra: 'tundra', geleira: 'geleira',
  montanha: 'montanha', vulcanico: 'vulcanico', mar: 'mar_aberto',
};

export const POVOS = {
  humanos:   { nome: 'Humanos',          biomas: ['planicie', 'colinas', 'costa', 'floresta', 'deserto', 'savana', 'tundra', 'pantano', 'selva'] },
  anoes:     { nome: 'Anões',            biomas: ['montanha', 'colinas', 'vulcanico'] },
  elfos:     { nome: 'Elfos',            biomas: ['floresta_antiga', 'floresta'] },
  halflings: { nome: 'Halflings',        biomas: ['planicie', 'colinas'] },
  orcs:      { nome: 'Orcs',             biomas: ['savana', 'deserto', 'vulcanico', 'montanha'] },
  gigantes:  { nome: 'Gigantes',         biomas: ['geleira', 'tundra', 'montanha'] },
  marinos:   { nome: 'Povo das Marés',   biomas: ['costa'] },
};

// Culturas: estilo de nomes (sementes para Markov), governos típicos, valores e costumes.
export const CULTURAS = [
  { id: 'aldorana', povo: 'humanos', nome: 'Aldorana', adj: ['aldorano', 'aldorana'], biomas: ['planicie', 'colinas', 'floresta'],
    pessoas: ['Aldric', 'Bertrand', 'Celeste', 'Doran', 'Elara', 'Gerard', 'Helena', 'Isolde', 'Lucan', 'Mirela', 'Osric', 'Rowena', 'Tristan', 'Viviane', 'Edmund', 'Aveline'],
    lugares: ['Valdor', 'Aldmere', 'Brennar', 'Caldwick', 'Dunmor', 'Everholt', 'Hartmoor', 'Lindar', 'Marrow', 'Roswell', 'Thornvale', 'Wexford', 'Galmont', 'Corvane'],
    governos: ['Reino', 'Ducado', 'Principado'], valores: ['honra', 'linhagem', 'juramentos'], arquitetura: 'castelos de pedra cinzenta e vilas de enxaimel',
    comida: 'pão escuro, cerveja e carne assada', festa: 'o Torneio da Colheita', religiao: 'sol' },
  { id: 'vashari', povo: 'humanos', nome: 'Vashari', adj: ['vashari', 'vashari'], biomas: ['deserto', 'savana'],
    pessoas: ['Zahir', 'Amira', 'Kasim', 'Layla', 'Rashid', 'Samira', 'Tariq', 'Yasmin', 'Farid', 'Nadira', 'Hakim', 'Soraya', 'Idris', 'Zaina'],
    lugares: ['Vashar', 'Qaresh', 'Zamir', 'Al-Kabir', 'Sahrim', 'Bazrah', 'Tamarat', 'Iskaral', 'Nahrem', 'Dhuran', 'Khemet', 'Rashan'],
    governos: ['Sultanato', 'Emirado', 'Confederação de Oásis'], valores: ['hospitalidade', 'palavra dada', 'astúcia comercial'], arquitetura: 'cúpulas brancas, pátios com fontes e torres de vento',
    comida: 'pão chato, tâmaras, café de especiarias', festa: 'a Noite das Mil Lanternas', religiao: 'estrelas' },
  { id: 'norvik', povo: 'humanos', nome: 'Norvik', adj: ['norvik', 'norvik'], biomas: ['tundra', 'costa', 'floresta'],
    pessoas: ['Bjorn', 'Astrid', 'Eirik', 'Freya', 'Gunnar', 'Ingrid', 'Leif', 'Sigrun', 'Torvald', 'Yrsa', 'Ragna', 'Halvard', 'Solveig', 'Ulf'],
    lugares: ['Norvik', 'Skaldheim', 'Frostvik', 'Hrafnsey', 'Isgard', 'Kaldmar', 'Ulfholt', 'Vargheim', 'Stormvik', 'Brimsund', 'Jarnholm', 'Sjovar'],
    governos: ['Jarlado', 'Confederação de Clãs', 'Reino'], valores: ['coragem', 'clã', 'memória dos ancestrais'], arquitetura: 'salões longos de madeira com telhados de turfa',
    comida: 'peixe defumado, hidromel e caldo de raízes', festa: 'a Vigília da Longa Noite', religiao: 'ancestrais' },
  { id: 'lyssana', povo: 'humanos', nome: 'Lyssana', adj: ['lyssano', 'lyssana'], biomas: ['costa', 'planicie', 'colinas'],
    pessoas: ['Lorenzo', 'Serafina', 'Dario', 'Livia', 'Matteo', 'Oriana', 'Cassio', 'Fiora', 'Valerio', 'Bianca', 'Alessio', 'Ilaria', 'Ottavio', 'Marzia'],
    lugares: ['Lyssa', 'Porto Veralto', 'Mirabel', 'Castellane', 'Solvenna', 'Arcadia', 'Belmara', 'Corvenza', 'Tirena', 'Valmira', 'Ostria', 'Pelagra'],
    governos: ['República Mercante', 'Cidade-Estado', 'Liga dos Portos'], valores: ['comércio', 'arte', 'influência'], arquitetura: 'palácios de mármore, canais e cúpulas douradas',
    comida: 'azeite, vinho e frutos do mar', festa: 'o Carnaval das Máscaras', religiao: 'mar' },
  { id: 'heliar', povo: 'humanos', nome: 'Heliar', adj: ['heliarano', 'heliarana'], biomas: ['planicie', 'savana', 'colinas'],
    pessoas: ['Aurelio', 'Solenne', 'Castor', 'Lumena', 'Hadrian', 'Celestia', 'Ignatius', 'Aurora', 'Benedikt', 'Clara', 'Severin', 'Luzia'],
    lugares: ['Heliar', 'Solaris', 'Aurion', 'Lumeval', 'Sanctara', 'Dawnmere', 'Clarion', 'Radiant', 'Orvalle', 'Sollum', 'Albaterra'],
    governos: ['Teocracia', 'Sacro Império', 'Principado Sagrado'], valores: ['fé', 'ordem', 'pureza'], arquitetura: 'catedrais altíssimas e praças de pedra branca',
    comida: 'pão ázimo, mel e vinho doce', festa: 'o Jubileu da Aurora', religiao: 'sol' },
  { id: 'morvain', povo: 'humanos', nome: 'Morvain', adj: ['morvanio', 'morvania'], biomas: ['pantano', 'floresta', 'colinas'],
    pessoas: ['Morgan', 'Vesna', 'Corvin', 'Lilith', 'Dimitri', 'Raven', 'Silas', 'Ysolde', 'Vlad', 'Mirna', 'Caspian', 'Nyx', 'Ambrose', 'Sabine'],
    lugares: ['Morvain', 'Gravenmoor', 'Duskwater', 'Blackfen', 'Vesperia', 'Corvath', 'Nocturn', 'Ashgrave', 'Mirefall', 'Velmora', 'Sablemere'],
    governos: ['Baronato', 'Conselho das Sombras', 'Reino'], valores: ['segredo', 'sobrevivência', 'pactos'], arquitetura: 'casas sobre estacas e torres negras na névoa',
    comida: 'enguias, cogumelos e vinho escuro', festa: 'a Noite das Velas Mortas', religiao: 'lua' },
  { id: 'sylvar', povo: 'humanos', nome: 'Sylvar', adj: ['sylvarano', 'sylvarana'], biomas: ['selva', 'pantano', 'savana'],
    pessoas: ['Tauri', 'Nayeli', 'Koa', 'Itzel', 'Amaru', 'Yara', 'Tupac', 'Nahua', 'Ximena', 'Ikal', 'Ayra', 'Kuri'],
    lugares: ['Itzara', 'Tlaxun', 'Kauana', 'Yacaré', 'Mitlan', 'Ocelán', 'Xalapa', 'Huitzan', 'Coatl', 'Anahuel', 'Tziran'],
    governos: ['Cidade-Templo', 'Federação Tribal', 'Reino'], valores: ['equilíbrio', 'sacrifício', 'a voz da selva'], arquitetura: 'pirâmides em degraus cobertas de cipó',
    comida: 'milho, cacau amargo e frutas da mata', festa: 'o Festival das Serpentes Emplumadas', religiao: 'natureza' },
  { id: 'cinzar', povo: 'humanos', nome: 'Cinzar', adj: ['cinzarano', 'cinzarana'], biomas: ['vulcanico', 'montanha', 'deserto'],
    pessoas: ['Ignar', 'Pyra', 'Brasko', 'Ember', 'Kaldor', 'Sirocca', 'Vulkan', 'Aska', 'Toran', 'Calda', 'Ferron', 'Ashka'],
    lugares: ['Cinzara', 'Pyrhos', 'Brasa Rubra', 'Obsidar', 'Fornalha', 'Calderra', 'Escória', 'Vulkaris', 'Tisnar', 'Fumarra'],
    governos: ['Forja-Reino', 'Oligarquia dos Mestres', 'Reino'], valores: ['trabalho', 'resistência', 'fogo que purifica'], arquitetura: 'cidades escavadas em basalto, iluminadas por lava canalizada',
    comida: 'pão de cinzas, carne curada e licor ardente', festa: 'a Noite da Grande Fornalha', religiao: 'fogo' },
  { id: 'khazrim', povo: 'anoes', nome: 'Khazrim', adj: ['khazrim', 'khazrim'], biomas: ['montanha', 'colinas', 'vulcanico'],
    pessoas: ['Thorin', 'Dagna', 'Balin', 'Helga', 'Durgan', 'Brunhild', 'Gimrak', 'Thora', 'Borin', 'Kelda', 'Orrin', 'Magna', 'Dwalin', 'Rurik'],
    lugares: ['Khazrim', 'Karak-Dun', 'Barak-Zul', 'Kazad-Mor', 'Durnhold', 'Grimforge', 'Thundarak', 'Ironhall', 'Zhul-Karak', 'Deepmoot', 'Morgrim'],
    governos: ['Reino sob a Montanha', 'Conselho dos Clãs', 'Forja-Reino'], valores: ['ofício', 'dívida honrada', 'rancor que não esquece'], arquitetura: 'salões colossais esculpidos na rocha',
    comida: 'cerveja escura, pão de pedra e cogumelos', festa: 'o Dia do Primeiro Martelo', religiao: 'forja' },
  { id: 'aelindor', povo: 'elfos', nome: 'Aelindor', adj: ['aelindoriano', 'aelindoriana'], biomas: ['floresta_antiga', 'floresta'],
    pessoas: ['Aelar', 'Lirien', 'Thalion', 'Elowen', 'Faelan', 'Isilme', 'Galathil', 'Nimue', 'Erevan', 'Sylvanna', 'Caelum', 'Arwen', 'Ithil', 'Miriel'],
    lugares: ['Aelindor', 'Silvarion', 'Lothmere', 'Elarion', 'Caras Ithil', 'Thalanor', 'Ilmarë', 'Nenwë', 'Faelith', 'Mithrandel', 'Sirion'],
    governos: ['Reino Élfico', 'Conselho das Estrelas', 'Corte da Lua'], valores: ['memória', 'harmonia', 'paciência de séculos'], arquitetura: 'salões entre copas de árvores ancestrais e pontes de luz',
    comida: 'pães de mel, frutas raras e vinho de orvalho', festa: 'o Canto das Estrelas Caídas', religiao: 'natureza' },
  { id: 'tolvin', povo: 'halflings', nome: 'Tolvin', adj: ['tolvino', 'tolvina'], biomas: ['planicie', 'colinas'],
    pessoas: ['Bilbo', 'Rosie', 'Milo', 'Poppy', 'Tobias', 'Daisy', 'Merry', 'Lily', 'Fosco', 'Pervinca', 'Hamfast', 'Marigold'],
    lugares: ['Tolvin', 'Brandel', 'Hobsete', 'Pomarel', 'Mirandil', 'Fendril', 'Bolsanda', 'Grumvel', 'Tilmor', 'Rosalda', 'Canolva', 'Bramel', 'Mosquel', 'Felpudo'],
    governos: ['Condado', 'Conselho dos Prefeitos', 'Liga das Aldeias'], valores: ['comunidade', 'conforto', 'boa mesa'], arquitetura: 'tocas redondas em colinas, jardins e moinhos',
    comida: 'tortas, cogumelos e cerveja leve', festa: 'a Feira das Abóboras', religiao: 'colheita' },
  { id: 'grukhar', povo: 'orcs', nome: 'Grukhar', adj: ['grukhar', 'grukhar'], biomas: ['savana', 'deserto', 'vulcanico', 'montanha'],
    pessoas: ['Grosh', 'Urka', 'Thrak', 'Gasha', 'Mog', 'Shagra', 'Durz', 'Bolga', 'Kragg', 'Yaza', 'Ruk', 'Ghora'],
    lugares: ['Grukhar', 'Ul-Gorak', 'Morgash', 'Dar-Kul', 'Krazzak', 'Gul-Thar', 'Shagrath', 'Bor-Dash', 'Ugrak', 'Zul-Mor'],
    governos: ['Horda', 'Domínio do Chefe-de-Guerra', 'Clãs de Sangue'], valores: ['força', 'honra em batalha', 'o clã acima de tudo'], arquitetura: 'fortalezas de troncos e ossos sobre colinas',
    comida: 'carne crua temperada e leite fermentado', festa: 'a Caçada do Grande Javali', religiao: 'ancestrais' },
  { id: 'jotunar', povo: 'gigantes', nome: 'Jotunar', adj: ['jotunar', 'jotunar'], biomas: ['geleira', 'tundra', 'montanha'],
    pessoas: ['Ymir', 'Skadi', 'Thrym', 'Gerda', 'Hrungnir', 'Angrboda', 'Surtr', 'Jarnsaxa', 'Bergelmir', 'Hel'],
    lugares: ['Jotunar', 'Utgard', 'Hrimfell', 'Glacius', 'Thrymheim', 'Isvall', 'Kaldrun', 'Stormgard'],
    governos: ['Reino dos Gigantes', 'Assembleia de Pedra', 'Trono de Gelo'], valores: ['antiguidade', 'força', 'promessas eternas'], arquitetura: 'fortalezas de gelo e pedra em escala descomunal',
    comida: 'mamutes assados e hidromel em barris', festa: 'o Grande Degelo', religiao: 'ancestrais' },
  { id: 'thalassi', povo: 'marinos', nome: 'Thalassi', adj: ['thalassi', 'thalassi'], biomas: ['costa'],
    pessoas: ['Nerissa', 'Kaius', 'Marina', 'Triton', 'Coralie', 'Nereu', 'Ondina', 'Pelagos', 'Thetis', 'Galen', 'Ione', 'Aegir'],
    lugares: ['Thalassa', 'Coralis', 'Abissia', 'Maremor', 'Nerith', 'Pérola Funda', 'Salmara', 'Ondaval', 'Recife Real', 'Tidemar'],
    governos: ['Corte das Marés', 'Talassocracia', 'Reino Submerso'], valores: ['fluidez', 'pactos com o mar', 'memória das correntes'], arquitetura: 'cidades de coral e pérola meio submersas',
    comida: 'algas, peixes crus e vinho de coral', festa: 'a Maré das Luzes', religiao: 'mar' },
];

// Panteão: domínios usados pelas culturas (religiao) e nomes gerados.
export const DOMINIOS = {
  sol: 'o Sol e a Ordem', lua: 'a Lua e os Segredos', estrelas: 'as Estrelas e o Destino', mar: 'o Mar e as Viagens',
  ancestrais: 'os Ancestrais e a Memória', natureza: 'a Natureza e os Ciclos', forja: 'a Forja e o Ofício',
  fogo: 'o Fogo e a Renovação', colheita: 'a Colheita e o Lar',
};
export const DEUSES_RAIZ = ['Aurel', 'Selun', 'Astar', 'Thalor', 'Veyra', 'Morrigan', 'Kael', 'Ignis', 'Demara', 'Oskar', 'Ylva', 'Noct', 'Brann', 'Sira'];

// Povoados: tipos e pesos por posição.
export const TIPOS_POVOADO = {
  capital: { nome: 'Capital', genero: 'f' }, cidade: { nome: 'Cidade', genero: 'f' }, vila: { nome: 'Vila', genero: 'f' },
  aldeia: { nome: 'Aldeia', genero: 'f' }, porto: { nome: 'Porto', genero: 'm' }, forte: { nome: 'Forte', genero: 'm' },
  mosteiro: { nome: 'Mosteiro', genero: 'm' },
};

// Lugares de natureza, ruína e masmorra por bioma: [tipo, base do nome, gênero, categoria].
export const LUGARES_BIOMA = {
  planicie: [['campo', 'Campos', 'm', 'natureza', true], ['colina', 'Colina', 'f', 'natureza'], ['ruina', 'Ruínas', 'f', 'ruina', true], ['circulo', 'Círculo de Pedras', 'm', 'ruina'], ['torre', 'Torre', 'f', 'masmorra']],
  colinas: [['colina', 'Colina', 'f', 'natureza'], ['vale', 'Vale', 'm', 'natureza'], ['tumulo', 'Túmulo', 'm', 'masmorra'], ['ruina', 'Ruínas', 'f', 'ruina', true], ['mina', 'Mina', 'f', 'masmorra']],
  floresta: [['bosque', 'Bosque', 'm', 'natureza'], ['clareira', 'Clareira', 'f', 'natureza'], ['lago', 'Lago', 'm', 'natureza'], ['cripta', 'Cripta', 'f', 'masmorra'], ['santuario', 'Santuário', 'm', 'ruina']],
  floresta_antiga: [['arvore', 'Árvore Ancestral', 'f', 'natureza'], ['clareira', 'Clareira', 'f', 'natureza'], ['circulo', 'Círculo Feérico', 'm', 'ruina'], ['santuario', 'Santuário', 'm', 'ruina'], ['labirinto', 'Labirinto de Raízes', 'm', 'masmorra']],
  selva: [['templo', 'Templo', 'm', 'ruina'], ['cachoeira', 'Cachoeira', 'f', 'natureza'], ['rio', 'Rio', 'm', 'natureza'], ['piramide', 'Pirâmide', 'f', 'masmorra'], ['ninho', 'Ninho', 'm', 'masmorra']],
  pantano: [['brejo', 'Brejo', 'm', 'natureza'], ['ilhota', 'Ilhota', 'f', 'natureza'], ['torre', 'Torre Afundada', 'f', 'masmorra'], ['altar', 'Altar', 'm', 'ruina'], ['cemiterio', 'Cemitério', 'm', 'ruina']],
  savana: [['planalto', 'Planalto', 'm', 'natureza'], ['poco', 'Poço', 'm', 'natureza'], ['totem', 'Totens', 'm', 'ruina', true], ['covil', 'Covil', 'm', 'masmorra'], ['ossario', 'Ossário', 'm', 'masmorra']],
  deserto: [['oasis', 'Oásis', 'm', 'natureza'], ['dunas', 'Dunas', 'f', 'natureza', true], ['cidade_enterrada', 'Cidade Enterrada', 'f', 'ruina'], ['tumba', 'Tumba', 'f', 'masmorra'], ['canion', 'Cânion', 'm', 'natureza']],
  tundra: [['planicie_gelada', 'Planície Gelada', 'f', 'natureza'], ['lago', 'Lago Congelado', 'm', 'natureza'], ['tumulo', 'Túmulo', 'm', 'masmorra'], ['monolito', 'Monólitos', 'm', 'ruina', true]],
  geleira: [['fenda', 'Fenda', 'f', 'natureza'], ['caverna', 'Caverna de Gelo', 'f', 'masmorra'], ['fortaleza', 'Fortaleza Congelada', 'f', 'masmorra'], ['pico', 'Pico', 'm', 'natureza']],
  montanha: [['pico', 'Pico', 'm', 'natureza'], ['passo', 'Passo', 'm', 'natureza'], ['mina', 'Mina', 'f', 'masmorra'], ['caverna', 'Caverna', 'f', 'masmorra'], ['fortaleza', 'Fortaleza Caída', 'f', 'ruina']],
  vulcanico: [['cratera', 'Cratera', 'f', 'natureza'], ['campo', 'Campos de Lava', 'm', 'natureza', true], ['forja', 'Forja Ancestral', 'f', 'ruina'], ['covil', 'Covil', 'm', 'masmorra']],
  costa: [['enseada', 'Enseada', 'f', 'natureza'], ['farol', 'Farol', 'm', 'ruina'], ['naufragio', 'Naufrágio', 'm', 'ruina'], ['gruta', 'Gruta Marinha', 'f', 'masmorra'], ['falesia', 'Falésias', 'f', 'natureza', true]],
};
// Lugares do mar (em ilhas isoladas ou no mar aberto).
export const LUGARES_MAR = [['ilha', 'Ilha', 'f', 'natureza'], ['recife', 'Recife', 'm', 'natureza'], ['naufragio', 'Naufrágio', 'm', 'ruina'], ['templo_submerso', 'Templo Submerso', 'm', 'masmorra'], ['farol', 'Farol', 'm', 'ruina']];

// Complementos de nome (neutros quanto ao gênero da base) e adjetivos com gênero.
export const COMPLEMENTOS = ['dos Enforcados', 'das Lanternas', 'do Corvo', 'das Cinzas', 'da Lua Partida', 'dos Ossos', 'do Eco', 'das Mil Vozes',
  'do Rei Esquecido', 'do Lobo Branco', 'das Sombras', 'dos Juramentos', 'da Serpente', 'do Último Farol', 'das Bruxas', 'dos Gigantes',
  'do Dragão Adormecido', 'das Almas', 'do Sol Negro', 'das Correntes', 'da Rainha Afogada', 'dos Heróis', 'das Névoas', 'do Silêncio',
  'dos Mil Degraus', 'da Coroa Partida', 'do Velho Deus', 'das Estrelas Caídas', 'dos Sussurros', 'da Aurora', 'do Trovão', 'das Feras'];
export const ADJETIVOS = [['Sombrio', 'Sombria'], ['Esquecido', 'Esquecida'], ['Partido', 'Partida'], ['Silencioso', 'Silenciosa'], ['Rubro', 'Rubra'],
  ['Profundo', 'Profunda'], ['Gelado', 'Gelada'], ['Antigo', 'Antiga'], ['Assombrado', 'Assombrada'], ['Dourado', 'Dourada'], ['Negro', 'Negra'],
  ['Sagrado', 'Sagrada'], ['Perdido', 'Perdida'], ['Uivante', 'Uivante'], ['Cinzento', 'Cinzenta'], ['Sussurrante', 'Sussurrante']];

// Planos de existência (acesso só por magia).
export const PLANOS = [
  { id: 'reino_feerico', nome: 'Reino Feérico', conceito: 'corte de fadas onde promessas têm peso de lei e o tempo corre torto' },
  { id: 'plano_sombras', nome: 'Plano das Sombras', conceito: 'reflexo escuro do mundo, onde moram ecos de quem morreu mal' },
  { id: 'plano_fogo', nome: 'Plano do Fogo', conceito: 'oceano de brasa governado por senhores elementais' },
  { id: 'abismo_aguas', nome: 'Abismo das Águas', conceito: 'mar sem fundo com cidades de coral e criaturas antigas' },
  { id: 'terras_mortos', nome: 'Terras dos Mortos', conceito: 'reino cinzento para onde as almas seguem; alguns tentam voltar' },
  { id: 'ceu_partido', nome: 'Céu Partido', conceito: 'ilhas flutuando entre estrelas, restos de uma guerra entre deuses' },
  { id: 'plano_sonhos', nome: 'Plano dos Sonhos', conceito: 'paisagens moldadas pelos sonhos dos vivos, perigosamente belas' },
];

// Linha do tempo: modelos de marcos ({A}/{B} = reinos, {R} = ruína criada, {P} = povo).
export const MARCOS = [
  { id: 'era_antiga', txt: 'Os {P} erguem as primeiras cidades; delas restam {R}.', ruina: true },
  { id: 'imperio_caido', txt: 'Cai o Império de {X}, que dominava meio continente. Suas ruínas mais famosas: {R}.', ruina: true },
  { id: 'guerra', txt: 'A Guerra dos {N} Anos entre {A} e {B} redesenha as fronteiras.' },
  { id: 'peste', txt: 'A Peste {C} esvazia cidades inteiras; {A} fecha suas fronteiras por uma geração.' },
  { id: 'portais', txt: 'Os primeiros portais para outros planos se abrem perto de {R}. A magia muda para sempre.', ruina: true },
  { id: 'tratado', txt: 'O Tratado de {L} encerra séculos de conflito entre {A} e {B}, mas ninguém confia nele.' },
  { id: 'fundacao', txt: 'Fundação de {A}, sob o primeiro {G}.' },
  { id: 'ordem_sumida', txt: 'A Ordem {O} desaparece numa única noite; sua fortaleza, {R}, está vazia desde então.', ruina: true },
  { id: 'dragoes', txt: 'O último grande dragão é abatido sobre {L}. Ou é o que contam.' },
  { id: 'cisma', txt: 'O Cisma {C} divide a fé de {A} em duas igrejas que se odeiam.' },
];
export const CORES_EVENTO = [['Cinzento', 'Cinzenta'], ['Rubro', 'Rubra'], ['Negro', 'Negra'], ['Pálido', 'Pálida'], ['Dourado', 'Dourada'], ['Silencioso', 'Silenciosa']];

// Facções: modelos ({L} = lugar sede, {X} = nome).
export const FACCOES = [
  { tipo: 'guilda', nome: 'Guilda dos Mercadores de {L}', objetivo: 'controlar as rotas de comércio' },
  { tipo: 'ordem', nome: 'Ordem dos Cavaleiros de {X}', objetivo: 'proteger os peregrinos e caçar monstros' },
  { tipo: 'culto', nome: 'Culto do {Y}', objetivo: 'despertar algo que dorme sob o mundo' },
  { tipo: 'colegio', nome: 'Colégio Arcano de {L}', objetivo: 'estudar e controlar a magia dos portais' },
  { tipo: 'ladroes', nome: 'Irmandade da Mão {Z}', objetivo: 'governar o submundo das cidades' },
  { tipo: 'cacadores', nome: 'Caçadores de Relíquias', objetivo: 'achar os tesouros dos impérios caídos' },
  { tipo: 'druidas', nome: 'Círculo de {X}', objetivo: 'manter o equilíbrio entre cidades e natureza' },
  { tipo: 'inquisicao', nome: 'Inquisição {W}', objetivo: 'purgar a magia proibida e os pactos' },
  { tipo: 'mercenarios', nome: 'Companhia {Z}', objetivo: 'lutar por quem pagar mais' },
  { tipo: 'vigilantes', nome: 'Vigilantes do Véu', objetivo: 'impedir que os outros planos invadam este' },
  { tipo: 'herdeiros', nome: 'Herdeiros de {X}', objetivo: 'restaurar o império caído' },
  { tipo: 'liga', nome: 'Liga dos Portos Livres', objetivo: 'manter os mares fora do alcance dos reis' },
];
export const NOMES_CULTO = ['Olho Fechado', 'Sol Negro', 'Rei Afogado', 'Coração de Cinza', 'Último Sussurro', 'Verme Sem Fim'];
export const CORES_FACCAO = ['Rubra', 'Cinzenta', 'Negra', 'de Ferro', 'de Prata', 'Escarlate'];
export const NOMES_INQUISICAO = ['Solar', 'Branca', 'da Chama Pura', 'do Juízo'];

// Grande Crise: modelos em 4 atos; {O} = lugar de origem, {R} = reino mais afetado.
export const CRISES = [
  { id: 'sol_negro', nome: 'O Sol Negro', conceito: 'Um eclipse que não termina avança dia a dia sobre o mundo, e com ele vêm os mortos que não descansam.',
    origem: ['ruina', 'masmorra'], atos: ['Sinais: noites mais longas, animais inquietos, sonhos com um sol escuro.', 'Avanço: {R} mergulha numa penumbra constante; mortos-vivos rondam as estradas.', 'Reação: reinos se dividem entre lutar, fugir ou negociar com o que vem da escuridão.', 'Confronto: a fonte do eclipse está em {O}. Alguém precisa descer até lá.'] },
  { id: 'fenda', nome: 'A Fenda', conceito: 'Um rasgo entre os planos se abriu e cresce; criaturas e magia descontrolada vazam para o mundo.',
    origem: ['ruina', 'natureza'], atos: ['Sinais: magia falha ou explode, portais menores se abrem sozinhos.', 'Avanço: perto de {O}, a realidade se dobra; {R} perde aldeias inteiras.', 'Reação: magos, cultos e reis disputam o controle da Fenda.', 'Confronto: fechar a Fenda, ou atravessá-la.'] },
  { id: 'dragao_ancestral', nome: 'O Despertar do Primeiro Dragão', conceito: 'O dragão que dizem ter morrido nunca morreu: dormia. Agora acorda faminto e lembra de cada traição.',
    origem: ['masmorra', 'natureza'], atos: ['Sinais: terremotos, ninhos de dragões menores, ouro desaparecendo.', 'Avanço: cidades de {R} queimam uma a uma.', 'Reação: velhas alianças são invocadas; alguns querem um pacto com o dragão.', 'Confronto: enfrentar, enganar ou libertar o Primeiro Dragão em {O}.'] },
  { id: 'mare_morta', nome: 'A Maré Morta', conceito: 'O mar está apodrecendo a partir de um ponto no oceano; o que sobe das águas não é peixe.',
    origem: ['mar'], atos: ['Sinais: peixes mortos, navios que voltam sem tripulação.', 'Avanço: portos de {R} são abandonados; algo anda nas praias à noite.', 'Reação: o Povo das Marés pede ajuda — ou acusa os humanos.', 'Confronto: descer ao coração da Maré Morta, em {O}.'] },
  { id: 'coroa_vazia', nome: 'A Coroa Vazia', conceito: 'O herdeiro do antigo império voltou para reclamar o mundo, com um exército que não sangra.',
    origem: ['ruina'], atos: ['Sinais: estandartes antigos aparecem, nobres desaparecem.', 'Avanço: {R} se curva ao herdeiro; outros reinos tremem.', 'Reação: guerra aberta ou submissão; a verdade sobre o herdeiro começa a vazar.', 'Confronto: a fonte do poder do herdeiro está em {O}.'] },
  { id: 'praga_sonhos', nome: 'A Praga dos Sonhos', conceito: 'Pessoas adormecem e não acordam; nos sonhos, todas veem o mesmo lugar.',
    origem: ['ruina', 'masmorra', 'natureza'], atos: ['Sinais: insônia em massa, desenhos iguais feitos por crianças.', 'Avanço: metade de {R} dorme; cidades silenciam.', 'Reação: curandeiros, cultos e o Plano dos Sonhos entram na disputa.', 'Confronto: o lugar dos sonhos existe de verdade: {O}.'] },
];

// Economia: o que cada bioma produz; ofícios típicos de cada povo.
export const PRODUTOS_BIOMA = {
  planicie: ['grãos', 'cavalos', 'lã'], colinas: ['ovelhas', 'pedra', 'vinho'], floresta: ['madeira', 'caça', 'ervas'],
  floresta_antiga: ['madeira encantada', 'ervas raras', 'seda de aranha'], selva: ['cacau', 'madeiras nobres', 'venenos'],
  pantano: ['turfa', 'ervas raras', 'enguias'], savana: ['marfim', 'couro', 'gado'], deserto: ['especiarias', 'vidro', 'sal'],
  tundra: ['peles', 'âmbar', 'óleo de baleia'], geleira: ['gelo eterno', 'presas de mamute'], montanha: ['ferro', 'prata', 'gemas'],
  vulcanico: ['obsidiana', 'enxofre', 'pedras de fogo'], costa: ['peixe', 'sal', 'pérolas'],
};
export const OFICIOS_POVO = {
  humanos: ['tecidos', 'mercenários'], anoes: ['armas', 'armaduras', 'cerveja'], elfos: ['arcos', 'poções', 'tecidos finos'],
  halflings: ['comida', 'tabaco', 'cerveja'], orcs: ['montarias', 'mercenários'], gigantes: ['pedra lavrada'], marinos: ['pérolas', 'navegação'],
};

export const RELACOES = ['aliança', 'comércio', 'neutralidade', 'desconfiança', 'rivalidade', 'guerra fria', 'guerra aberta'];
