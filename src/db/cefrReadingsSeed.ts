import type { ReadingText } from '../types';

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type LineSpec = [original: string, translated: string, highlights?: string[]];

/**
 * Constrói um texto de leitura a partir de pares (original, tradução), derivando o texto
 * completo das linhas. Reduz a repetição do formato antigo, que exigia escrever o texto
 * inteiro duas vezes (em `fullText*` e de novo em `lines`).
 */
const buildReading = (
  id: string,
  title: string,
  description: string,
  cefrLevel: CefrLevel,
  lines: LineSpec[]
): ReadingText => {
  const mapped = lines.map(([original, translated, highlights = []]) => ({
    original,
    translated,
    highlights,
    mastered: false
  }));
  return {
    id,
    title,
    description,
    type: 'reading',
    showInReadings: true,
    cefrLevel,
    fullTextOriginal: mapped.map(l => l.original).join('\n'),
    fullTextTranslated: mapped.map(l => l.translated).join('\n'),
    createdAt: 1780243809000,
    updatedAt: 1780243809000,
    lines: mapped
  };
};

export const cefrReadingsSeedData: ReadingText[] = [
  {
    id: 'seed-reading-a1-friend',
    title: '📖 Meeting a New Friend (A1)',
    description: 'Um diálogo básico de apresentação pessoal e saudações.',
    type: 'reading',
    showInReadings: true,
    cefrLevel: 'A1',
    fullTextOriginal: 'Hello! My name is Sarah. What is your name?\nHi Sarah! My name is John. Nice to meet you.\nNice to meet you too, John. Where are you from?\nI am from Canada, and you?\nI am from Brazil. Do you speak Portuguese?\nNo, I only speak English and a little Spanish.\nNo problem! We can practice English together.\nThat is great! Thank you, Sarah.',
    fullTextTranslated: 'Olá! Meu nome é Sarah. Qual é o seu nome?\nOi Sarah! Meu nome é John. Prazer em conhecer você.\nPrazer em conhecer você também, John. De onde você é?\nEu sou do Canadá, e você?\nEu sou do Brasil. Você fala português?\nNão, eu só falo inglês e um pouco de espanhol.\nSem problemas! Nós podemos praticar inglês juntos.\nIsso é ótimo! Obrigado, Sarah.',
    createdAt: 1780243809000,
    updatedAt: 1780243809000,
    lines: [
      {
        original: 'Hello! My name is Sarah. What is your name?',
        translated: 'Olá! Meu nome é Sarah. Qual é o seu nome?',
        highlights: ['Hello', 'name', 'What'],
        mastered: false
      },
      {
        original: 'Hi Sarah! My name is John. Nice to meet you.',
        translated: 'Oi Sarah! Meu nome é John. Prazer em conhecer você.',
        highlights: ['Hi', 'Nice to meet you'],
        mastered: false
      },
      {
        original: 'Nice to meet you too, John. Where are you from?',
        translated: 'Prazer em conhecer você também, John. De onde você é?',
        highlights: ['Where', 'from'],
        mastered: false
      },
      {
        original: 'I am from Canada, and you?',
        translated: 'Eu sou do Canadá, e você?',
        highlights: ['from', 'Canada'],
        mastered: false
      },
      {
        original: 'I am from Brazil. Do you speak Portuguese?',
        translated: 'Eu sou do Brasil. Você fala português?',
        highlights: ['Brazil', 'speak', 'Portuguese'],
        mastered: false
      },
      {
        original: 'No, I only speak English and a little Spanish.',
        translated: 'Não, eu só falo inglês e um pouco de espanhol.',
        highlights: ['only', 'English', 'Spanish'],
        mastered: false
      },
      {
        original: 'No problem! We can practice English together.',
        translated: 'Sem problemas! Nós podemos praticar inglês juntos.',
        highlights: ['problem', 'practice', 'together'],
        mastered: false
      },
      {
        original: 'That is great! Thank you, Sarah.',
        translated: 'Isso é ótimo! Obrigado, Sarah.',
        highlights: ['great', 'Thank you'],
        mastered: false
      }
    ]
  },
  {
    id: 'seed-reading-a1-routine',
    title: '📖 My Daily Routine (A1)',
    description: 'Uma descrição simples da rotina diária no presente simples.',
    type: 'reading',
    showInReadings: true,
    cefrLevel: 'A1',
    fullTextOriginal: 'I wake up at seven o\'clock every morning.\nFirst, I wash my face and brush my teeth.\nThen, I eat a simple breakfast with bread, fruit, and coffee.\nI go to work at eight o\'clock by bus.\nI work in an office from nine in the morning to five in the afternoon.\nIn the evening, I cook dinner for my family.\nWe watch a movie together on television.\nI go to bed at ten o\'clock because I am tired.',
    fullTextTranslated: 'Eu acordo às sete horas todas as manhãs.\nPrimeiro, eu lavo meu rosto e escovo meus dentes.\nDepois, eu como um café da manhã simples com pão, fruta e café.\nEu vou para o trabalho às oito horas de ônibus.\nEu trabalho em um escritório das nove da manhã às cinco da tarde.\nÀ noite, eu cozinho o jantar para a minha família.\nNós assistimos a um filme juntos na televisão.\nEu vou para a cama às dez horas porque estou cansado.',
    createdAt: 1780243809001,
    updatedAt: 1780243809001,
    lines: [
      {
        original: 'I wake up at seven o\'clock every morning.',
        translated: 'Eu acordo às sete horas todas as manhãs.',
        highlights: ['wake up', 'morning'],
        mastered: false
      },
      {
        original: 'First, I wash my face and brush my teeth.',
        translated: 'Primeiro, eu lavo meu rosto e escovo meus dentes.',
        highlights: ['First', 'wash', 'brush'],
        mastered: false
      },
      {
        original: 'Then, I eat a simple breakfast with bread, fruit, and coffee.',
        translated: 'Depois, eu como um café da manhã simples com pão, fruta e café.',
        highlights: ['Then', 'eat', 'breakfast'],
        mastered: false
      },
      {
        original: 'I go to work at eight o\'clock by bus.',
        translated: 'Eu vou para o trabalho às oito horas de ônibus.',
        highlights: ['work', 'bus'],
        mastered: false
      },
      {
        original: 'I work in an office from nine in the morning to five in the afternoon.',
        translated: 'Eu trabalho em um escritório das nove da manhã às cinco da tarde.',
        highlights: ['office', 'morning', 'afternoon'],
        mastered: false
      },
      {
        original: 'In the evening, I cook dinner for my family.',
        translated: 'À noite, eu cozinho o jantar para a minha família.',
        highlights: ['evening', 'cook', 'dinner'],
        mastered: false
      },
      {
        original: 'We watch a movie together on television.',
        translated: 'Nós assistimos a um filme juntos na televisão.',
        highlights: ['watch', 'together', 'television'],
        mastered: false
      },
      {
        original: 'I go to bed at ten o\'clock because I am tired.',
        translated: 'Eu vou para a cama às dez horas porque estou cansado.',
        highlights: ['go to bed', 'tired'],
        mastered: false
      }
    ]
  },
  {
    id: 'seed-reading-a1-family',
    title: '📖 The Smith Family (A1)',
    description: 'Aprenda sobre membros da família e profissões básicas.',
    type: 'reading',
    showInReadings: true,
    cefrLevel: 'A1',
    fullTextOriginal: 'Mr. Smith lives in a big house with his family.\nHe is a doctor, and his wife is a teacher.\nThey have two children, a son and a daughter.\nTheir son, Leo, is ten years old, and he loves soccer.\nTheir daughter, Lily, is seven years old, and she plays the piano.\nThey also have a small dog named Max.\nMax is very friendly and likes to play in the garden.\nOn Sundays, the family goes to the park to have a picnic.',
    fullTextTranslated: 'O Sr. Smith mora em uma casa grande com sua família.\nEle é médico, e sua esposa é professora.\nEles têm dois filhos, um filho e uma filha.\nO filho deles, Leo, tem dez anos e adora futebol.\nA filha deles, Lily, tem sete anos e toca piano.\nEles também têm um cachorro pequeno chamado Max.\nMax é muito amigável e gosta de brincar no jardim.\nAos domingos, a família vai ao parque fazer um piquenique.',
    createdAt: 1780243809002,
    updatedAt: 1780243809002,
    lines: [
      {
        original: 'Mr. Smith lives in a big house with his family.',
        translated: 'O Sr. Smith mora em uma casa grande com sua família.',
        highlights: ['lives', 'big house', 'family'],
        mastered: false
      },
      {
        original: 'He is a doctor, and his wife is a teacher.',
        translated: 'Ele é médico, e sua esposa é professora.',
        highlights: ['doctor', 'wife', 'teacher'],
        mastered: false
      },
      {
        original: 'They have two children, a son and a daughter.',
        translated: 'Eles têm dois filhos, um filho e uma filha.',
        highlights: ['children', 'son', 'daughter'],
        mastered: false
      },
      {
        original: 'Their son, Leo, is ten years old, and he loves soccer.',
        translated: 'O filho deles, Leo, tem dez anos e adora futebol.',
        highlights: ['years old', 'loves', 'soccer'],
        mastered: false
      },
      {
        original: 'Their daughter, Lily, is seven years old, and she plays the piano.',
        translated: 'A filha deles, Lily, tem sete anos e toca piano.',
        highlights: ['plays', 'piano'],
        mastered: false
      },
      {
        original: 'They also have a small dog named Max.',
        translated: 'Eles também têm um cachorro pequeno chamado Max.',
        highlights: ['also', 'small dog', 'named'],
        mastered: false
      },
      {
        original: 'Max is very friendly and likes to play in the garden.',
        translated: 'Max é muito amigável e gosta de brincar no jardim.',
        highlights: ['friendly', 'garden'],
        mastered: false
      },
      {
        original: 'On Sundays, the family goes to the park to have a picnic.',
        translated: 'Aos domingos, a família vai ao parque fazer um piquenique.',
        highlights: ['Sundays', 'goes', 'picnic'],
        mastered: false
      }
    ]
  },
  {
    id: 'seed-reading-a2-trip',
    title: '📖 A Weekend Trip to London (A2)',
    description: 'Um relato simples de viagem no passado usando verbos regulares e irregulares.',
    type: 'reading',
    showInReadings: true,
    cefrLevel: 'A2',
    fullTextOriginal: 'Last weekend, my brother and I traveled to London.\nWe stayed in a small hotel near the city center.\nOn Saturday morning, we visited the famous Big Ben.\nIt was beautiful, but the weather was very cold and rainy.\nFor lunch, we ate traditional fish and chips in a local pub.\nIn the afternoon, we went to a museum and saw ancient things.\nOn Sunday, we bought some souvenirs for our parents.\nWe returned home by train in the evening, feeling very happy.',
    fullTextTranslated: 'No último fim de semana, meu irmão e eu viajamos para Londres.\nNós ficamos em um pequeno hotel perto do centro da cidade.\nNo sábado de manhã, nós visitamos o famoso Big Ben.\nEra bonito, mas o tempo estava muito frio e chuvoso.\nNo almoço, nós comemos peixe com batatas tradicionais em um pub local.\nÀ tarde, nós fomos a um museu e vimos coisas antigas.\nNo domingo, nós compramos algumas lembranças para os nossos pais.\nNós voltamos para casa de trem à noite, nos sentindo muito felizes.',
    createdAt: 1780243809003,
    updatedAt: 1780243809003,
    lines: [
      {
        original: 'Last weekend, my brother and I traveled to London.',
        translated: 'No último fim de semana, meu irmão e eu viajamos para Londres.',
        highlights: ['Last weekend', 'traveled'],
        mastered: false
      },
      {
        original: 'We stayed in a small hotel near the city center.',
        translated: 'Nós ficamos em um pequeno hotel perto do centro da cidade.',
        highlights: ['stayed', 'near', 'city center'],
        mastered: false
      },
      {
        original: 'On Saturday morning, we visited the famous Big Ben.',
        translated: 'No sábado de manhã, nós visitamos o famoso Big Ben.',
        highlights: ['Saturday morning', 'visited', 'famous'],
        mastered: false
      },
      {
        original: 'It was beautiful, but the weather was very cold and rainy.',
        translated: 'Era bonito, mas o tempo estava muito frio e chuvoso.',
        highlights: ['beautiful', 'weather', 'rainy'],
        mastered: false
      },
      {
        original: 'For lunch, we ate traditional fish and chips in a local pub.',
        translated: 'No almoço, nós comemos peixe com batatas tradicionais em um pub local.',
        highlights: ['lunch', 'ate', 'traditional'],
        mastered: false
      },
      {
        original: 'In the afternoon, we went to a museum and saw ancient things.',
        translated: 'À tarde, nós fomos a um museu e vimos coisas antigas.',
        highlights: ['went', 'museum', 'saw', 'ancient'],
        mastered: false
      },
      {
        original: 'On Sunday, we bought some souvenirs for our parents.',
        translated: 'No domingo, nós compramos algumas lembranças para os nossos pais.',
        highlights: ['bought', 'souvenirs', 'parents'],
        mastered: false
      },
      {
        original: 'We returned home by train in the evening, feeling very happy.',
        translated: 'Nós voltamos para casa de trem à noite, nos sentindo muito felizes.',
        highlights: ['returned', 'by train', 'feeling', 'happy'],
        mastered: false
      }
    ]
  },

  // ————— Conjunto inicial ampliado (buildReading) —————
  // Textos curados por nível para dar ao aluno o que estudar sem precisar buscar material.
  // É um ponto de partida de qualidade, pensado para ser expandido até ~20-30 por nível.

  buildReading(
    'seed-reading-a1-morning',
    '📖 My Morning Routine (A1)',
    'Rotina diária simples no presente.',
    'A1',
    [
      ['I wake up at seven o\'clock every day.', 'Eu acordo às sete horas todos os dias.', ['wake up', 'every day']],
      ['First, I drink a glass of water.', 'Primeiro, eu bebo um copo de água.', ['drink', 'water']],
      ['Then I take a shower and get dressed.', 'Depois eu tomo banho e me visto.', ['take a shower', 'get dressed']],
      ['I eat bread and fruit for breakfast.', 'Eu como pão e fruta no café da manhã.', ['eat', 'breakfast']],
      ['At eight o\'clock, I go to work by bus.', 'Às oito horas, eu vou para o trabalho de ônibus.', ['go to work', 'by bus']]
    ]
  ),
  buildReading(
    'seed-reading-a1-my-family',
    '📖 My Family (A1)',
    'Vocabulário de família e descrições básicas.',
    'A1',
    [
      ['My family is small but very happy.', 'Minha família é pequena, mas muito feliz.', ['family', 'happy']],
      ['My father is a doctor and my mother is a teacher.', 'Meu pai é médico e minha mãe é professora.', ['father', 'mother']],
      ['I have one brother. His name is Lucas.', 'Eu tenho um irmão. O nome dele é Lucas.', ['brother']],
      ['We have a dog and two cats at home.', 'Nós temos um cachorro e dois gatos em casa.', ['dog', 'cats']],
      ['On Sundays, we eat lunch together.', 'Aos domingos, nós almoçamos juntos.', ['Sundays', 'together']]
    ]
  ),
  buildReading(
    'seed-reading-a2-restaurant',
    '📖 At the Restaurant (A2)',
    'Diálogo de pedido em restaurante com passado e futuro simples.',
    'A2',
    [
      ['Good evening. Do you have a table for two?', 'Boa noite. Vocês têm uma mesa para dois?', ['table for two']],
      ['Yes, of course. Please follow me.', 'Sim, claro. Por favor, me acompanhe.', ['follow me']],
      ['Could I see the menu, please?', 'Eu poderia ver o cardápio, por favor?', ['menu']],
      ['I would like the grilled chicken with salad.', 'Eu gostaria do frango grelhado com salada.', ['would like', 'grilled']],
      ['Would you like something to drink?', 'Você gostaria de algo para beber?', ['to drink']],
      ['Just water, thank you. And the bill later.', 'Só água, obrigado. E a conta depois.', ['bill']]
    ]
  ),
  buildReading(
    'seed-reading-a2-weekend',
    '📖 Last Weekend (A2)',
    'Narrativa no passado simples sobre atividades de lazer.',
    'A2',
    [
      ['Last weekend, I visited my grandparents in the countryside.', 'No último fim de semana, eu visitei meus avós no campo.', ['visited', 'countryside']],
      ['We walked in the fields and picked fresh vegetables.', 'Nós caminhamos pelos campos e colhemos vegetais frescos.', ['walked', 'picked']],
      ['My grandmother cooked a delicious soup for lunch.', 'Minha avó cozinhou uma sopa deliciosa no almoço.', ['cooked', 'delicious']],
      ['In the afternoon, we played cards and told stories.', 'À tarde, nós jogamos cartas e contamos histórias.', ['played cards', 'told stories']],
      ['I felt relaxed and happy the whole time.', 'Eu me senti relaxado e feliz o tempo todo.', ['relaxed']]
    ]
  ),
  buildReading(
    'seed-reading-b1-remote-work',
    '📖 Working from Home (B1)',
    'Texto de opinião com vantagens e desvantagens.',
    'B1',
    [
      ['Working from home has become common in recent years.', 'Trabalhar de casa se tornou comum nos últimos anos.', ['become common']],
      ['One clear advantage is that you save time on commuting.', 'Uma vantagem clara é que você economiza tempo no deslocamento.', ['advantage', 'commuting']],
      ['However, some people find it hard to stay focused at home.', 'No entanto, algumas pessoas acham difícil manter o foco em casa.', ['stay focused']],
      ['It also becomes difficult to separate work from personal life.', 'Também fica difícil separar o trabalho da vida pessoal.', ['separate']],
      ['In my opinion, a balance between office and home works best.', 'Na minha opinião, um equilíbrio entre escritório e casa funciona melhor.', ['balance', 'in my opinion']]
    ]
  ),
  buildReading(
    'seed-reading-b1-travel-plan',
    '📖 Planning a Trip (B1)',
    'Planos futuros e condicionais simples.',
    'B1',
    [
      ['Next summer, I am planning to travel across Europe by train.', 'No próximo verão, estou planejando viajar pela Europa de trem.', ['planning', 'across']],
      ['If I save enough money, I will visit at least five countries.', 'Se eu economizar dinheiro suficiente, visitarei pelo menos cinco países.', ['if', 'at least']],
      ['I would rather stay in small towns than in big cities.', 'Eu preferiria ficar em cidades pequenas do que em grandes.', ['would rather']],
      ['Before I leave, I need to learn a few useful phrases.', 'Antes de partir, preciso aprender algumas frases úteis.', ['before', 'useful']],
      ['Travelling on my own will help me become more confident.', 'Viajar sozinho vai me ajudar a ficar mais confiante.', ['on my own', 'confident']]
    ]
  ),
  buildReading(
    'seed-reading-b2-technology',
    '📖 Technology and Society (B2)',
    'Texto argumentativo sobre o impacto da tecnologia.',
    'B2',
    [
      ['Smartphones have transformed the way we communicate and work.', 'Os smartphones transformaram a maneira como nos comunicamos e trabalhamos.', ['transformed']],
      ['While they connect us instantly, they can also isolate us.', 'Embora nos conectem instantaneamente, eles também podem nos isolar.', ['while', 'isolate']],
      ['Many argue that constant notifications harm our concentration.', 'Muitos argumentam que as notificações constantes prejudicam nossa concentração.', ['argue', 'harm']],
      ['Nevertheless, the benefits are difficult to ignore.', 'Ainda assim, os benefícios são difíceis de ignorar.', ['nevertheless']],
      ['The challenge is learning to use these tools with moderation.', 'O desafio é aprender a usar essas ferramentas com moderação.', ['challenge', 'moderation']]
    ]
  ),
  buildReading(
    'seed-reading-c1-environment',
    '📖 The Cost of Convenience (C1)',
    'Texto avançado sobre consumo e meio ambiente.',
    'C1',
    [
      ['Our appetite for convenience comes at a considerable environmental cost.', 'Nosso apetite por conveniência tem um custo ambiental considerável.', ['appetite', 'considerable']],
      ['Single-use packaging, though practical, accumulates in landfills for centuries.', 'Embalagens descartáveis, embora práticas, se acumulam em aterros por séculos.', ['single-use', 'accumulates']],
      ['Shifting these habits requires more than individual goodwill.', 'Mudar esses hábitos exige mais do que boa vontade individual.', ['shifting', 'goodwill']],
      ['It demands coordinated policy and genuine corporate accountability.', 'Exige políticas coordenadas e responsabilização corporativa genuína.', ['accountability']],
      ['Otherwise, awareness alone will amount to little.', 'Do contrário, a consciência por si só resultará em pouco.', ['otherwise', 'amount to']]
    ]
  ),
  buildReading(
    'seed-reading-c2-language',
    '📖 The Nature of Fluency (C2)',
    'Texto sofisticado sobre aprendizado de idiomas.',
    'C2',
    [
      ['Fluency is often mistaken for the mere absence of hesitation.', 'A fluência é frequentemente confundida com a mera ausência de hesitação.', ['mistaken', 'hesitation']],
      ['In truth, it lies in the effortless retrieval of nuance.', 'Na verdade, ela reside na recuperação sem esforço da nuance.', ['retrieval', 'nuance']],
      ['A fluent speaker navigates register, irony and implication with ease.', 'Um falante fluente navega registro, ironia e implicação com facilidade.', ['register', 'implication']],
      ['Such command is seldom achieved through memorisation alone.', 'Tal domínio raramente é alcançado apenas por memorização.', ['seldom', 'command']],
      ['It is forged, rather, in sustained and meaningful exposure.', 'Ele é forjado, antes, em exposição sustentada e significativa.', ['forged', 'sustained']]
    ]
  )
];
