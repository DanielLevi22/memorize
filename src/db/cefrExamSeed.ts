import type { CefrExam } from '../types';

export const cefrExamsSeedData: CefrExam[] = [
  {
    id: 'exam-a1-default',
    level: 'A1',
    title: 'Simulado Oficial CEFR - A1 Iniciante',
    description: 'Avalie sua capacidade de compreender expressões cotidianas, responder perguntas simples e estruturar frases básicas.',
    questions: [
      {
        id: 'a1-q1',
        section: 'reading',
        questionText: 'Select the correct word to complete the sentence: "Hello! My name ______ John."',
        options: ['am', 'is', 'are', 'be'],
        correctAnswer: 'is'
      },
      {
        id: 'a1-q2',
        section: 'reading',
        questionText: 'Choose the correct preposition: "Where is the cat? It is ______ the table (underneath)."',
        options: ['under', 'above', 'in', 'through'],
        correctAnswer: 'under'
      },
      {
        id: 'a1-q3',
        section: 'listening',
        audioText: 'Hello! Can you help me? I am looking for the library. It is next to the park.',
        questionText: 'Listen to the audio text. Where is the library?',
        options: ['Next to the school', 'Next to the park', 'Inside the supermarket', 'Behind the hospital'],
        correctAnswer: 'Next to the park'
      },
      {
        id: 'a1-q4',
        section: 'listening',
        audioText: 'I usually wake up at seven o\'clock, but on weekends I sleep until nine.',
        questionText: 'Listen to the audio text. What time does the speaker wake up on Sunday?',
        options: ['7:00', '8:00', '9:00', '10:00'],
        correctAnswer: '9:00'
      }
    ],
    writingPrompt: {
      topic: 'Introduce yourself',
      instructions: 'Write a short message (30-50 words) introducing yourself in English. Write your name, where you are from, and what your favorite hobby is.',
      minWords: 20,
      maxWords: 60
    }
  },
  {
    id: 'exam-a2-default',
    level: 'A2',
    title: 'Simulado Oficial CEFR - A2 Básico',
    description: 'Avalie seu entendimento de frases frequentes sobre áreas de relevância direta e descrição de aspectos simples de seu passado.',
    questions: [
      {
        id: 'a2-q1',
        section: 'reading',
        questionText: 'Choose the correct verb form: "Yesterday, we ______ a movie at the cinema."',
        options: ['see', 'saw', 'seen', 'seeing'],
        correctAnswer: 'saw'
      },
      {
        id: 'a2-q2',
        section: 'reading',
        questionText: 'Complete the sentence: "She is the ______ girl in our class."',
        options: ['tall', 'taller', 'tallest', 'more tall'],
        correctAnswer: 'tallest'
      },
      {
        id: 'a2-q3',
        section: 'listening',
        audioText: 'Welcome to our department store. The shoes are on the second floor, right next to the clothing section.',
        questionText: 'Listen to the audio text. Where can the customer find the shoes?',
        options: ['First floor', 'Second floor', 'Third floor', 'Basement'],
        correctAnswer: 'Second floor'
      },
      {
        id: 'a2-q4',
        section: 'listening',
        audioText: 'I wanted to play tennis, but it started raining heavily, so I stayed home and read a book instead.',
        questionText: 'Listen to the audio text. What did the speaker do?',
        options: ['Played tennis', 'Went for a walk', 'Read a book', 'Bought an umbrella'],
        correctAnswer: 'Read a book'
      }
    ],
    writingPrompt: {
      topic: 'Your last vacation',
      instructions: 'Write a short paragraph (50-80 words) describing your last vacation. Write where you went, what you did, and who you went with.',
      minWords: 40,
      maxWords: 100
    }
  },
  {
    id: 'exam-b1-default',
    level: 'B1',
    title: 'Simulado Oficial CEFR - B1 Intermediário I',
    description: 'Avalie sua habilidade de compreender os pontos principais de assuntos familiares e produzir textos coerentes sobre seus sonhos e ambições.',
    questions: [
      {
        id: 'b1-q1',
        section: 'reading',
        questionText: 'Choose the correct tense: "I ______ English for three years now, and I really enjoy it."',
        options: ['am studying', 'have been studying', 'studied', 'study'],
        correctAnswer: 'have been studying'
      },
      {
        id: 'b1-q2',
        section: 'reading',
        questionText: 'Complete the sentence: "If it rains tomorrow, we ______ the picnic."',
        options: ['will cancel', 'would cancel', 'cancelled', 'cancel'],
        correctAnswer: 'will cancel'
      },
      {
        id: 'b1-q3',
        section: 'listening',
        audioText: 'Our flight was delayed by two hours because of heavy snow at the departure airport. We had to wait in the terminal, but the airline gave us food vouchers.',
        questionText: 'Listen to the audio text. Why was the flight delayed?',
        options: ['Technical issues', 'Bad weather', 'Pilot was late', 'Air traffic control strike'],
        correctAnswer: 'Bad weather'
      },
      {
        id: 'b1-q4',
        section: 'listening',
        audioText: 'I prefer working in the morning because the office is quiet and I can concentrate much better before everyone arrives.',
        questionText: 'Listen to the audio text. Why does the speaker prefer working early?',
        options: ['To leave early', 'Because it is quiet', 'To meet clients', 'Free coffee is served'],
        correctAnswer: 'Because it is quiet'
      }
    ],
    writingPrompt: {
      topic: 'E-mail to a friend',
      instructions: 'Write an email (80-120 words) to a friend inviting them to a birthday party next week. Explain the location, time, and ask if they can bring some snacks.',
      minWords: 60,
      maxWords: 150
    }
  },
  {
    id: 'exam-b2-default',
    level: 'B2',
    title: 'Simulado Oficial CEFR - B2 Intermediário II',
    description: 'Teste sua capacidade de compreender ideias complexas, interagir com fluência e espontaneidade com nativos e produzir redações argumentativas.',
    questions: [
      {
        id: 'b2-q1',
        section: 'reading',
        questionText: 'Choose the correct form: "By the time the police arrived, the thieves ______ already escaped."',
        options: ['have', 'did', 'had', 'would'],
        correctAnswer: 'had'
      },
      {
        id: 'b2-q2',
        section: 'reading',
        questionText: 'Complete the phrase: "He is looking forward to ______ his new job next week."',
        options: ['start', 'starting', 'started', 'be starting'],
        correctAnswer: 'starting'
      },
      {
        id: 'b2-q3',
        section: 'listening',
        audioText: 'The project was initially met with skepticism from the board of directors. They feared that the transition to renewable energy would incur excessive costs. However, our financial model proved that within three years, the efficiency gains would fully offset the capital expenditure.',
        questionText: 'Listen to the audio text. What did the board originally fear?',
        options: ['Technical failures', 'Excessive setup costs', 'Lack of staff training', 'Public opposition'],
        correctAnswer: 'Excessive setup costs'
      },
      {
        id: 'b2-q4',
        section: 'listening',
        audioText: 'I used to think that working from home was the perfect solution, but over time I started feeling isolated. I missed the casual chats in the breakroom and the separation between work life and home life.',
        questionText: 'Listen to the audio. What did the speaker find difficult about working from home?',
        options: ['Poor internet connection', 'Distractions from family', 'A sense of isolation', 'Increased working hours'],
        correctAnswer: 'A sense of isolation'
      }
    ],
    writingPrompt: {
      topic: 'Opinion essay on technology',
      instructions: 'Write an opinion essay (120-180 words) discussing whether technology has made people more or less connected. State your opinion clearly and support it with examples.',
      minWords: 100,
      maxWords: 220
    }
  },
  {
    id: 'exam-c1-default',
    level: 'C1',
    title: 'Simulado Oficial CEFR - C1 Avançado',
    description: 'Avalie sua competência em compreender textos longos e exigentes com sentidos implícitos, expressando-se de forma flexível e eficaz.',
    questions: [
      {
        id: 'c1-q1',
        section: 'reading',
        questionText: 'Choose the correct word inversion: "Seldom ______ seen such an outstanding performance by a young actor."',
        options: ['we have', 'have we', 'did we have', 'had we to'],
        correctAnswer: 'have we'
      },
      {
        id: 'c1-q2',
        section: 'reading',
        questionText: 'Complete the sentence: "I\'d rather you ______ reveal the secret to anyone else."',
        options: ['don\'t', 'didn\'t', 'not', 'shouldn\'t'],
        correctAnswer: 'didn\'t'
      },
      {
        id: 'c1-q3',
        section: 'listening',
        audioText: 'The company\'s expansion into Asian markets was heralded as a triumph. But in hindsight, it was a classic case of overextension. They failed to grasp the cultural nuances of negotiation, relying instead on aggressive marketing strategies that fell flat.',
        questionText: 'Listen to the audio. What mistake did the company make in their expansion?',
        options: ['They underestimated local competitors.', 'They misjudged cultural negotiation styles.', 'They faced supply chain issues.', 'They priced products too high.'],
        correctAnswer: 'They misjudged cultural negotiation styles.'
      },
      {
        id: 'c1-q4',
        section: 'listening',
        audioText: 'The argument for structural reform is compelling, yet it hinges on a flawed premise: that all departments possess equal resources. In reality, the disparities are so pronounced that standardizing procedures is bound to exacerbate the current inefficiency.',
        questionText: 'Listen to the audio. What is the speaker\'s main concern about structural reform?',
        options: ['It is too expensive.', 'Departments will refuse to cooperate.', 'Equal standardization will worsen inefficiency due to resource disparities.', 'It will take too long to implement.'],
        correctAnswer: 'Equal standardization will worsen inefficiency due to resource disparities.'
      }
    ],
    writingPrompt: {
      topic: 'Formal business proposal',
      instructions: 'Write a proposal (180-250 words) to your company manager suggesting the implementation of a flexible work hours policy. Detail the benefits for employee morale and productivity, and address potential challenges.',
      minWords: 150,
      maxWords: 300
    }
  },
  {
    id: 'exam-c2-default',
    level: 'C2',
    title: 'Simulado Oficial CEFR - C2 Proficiente',
    description: 'Teste seu domínio e fluência total sobre nuances de significado, capacidade de resumir informações e expressar-se espontaneamente.',
    questions: [
      {
        id: 'c2-q1',
        section: 'reading',
        questionText: 'Select the correct option: "Had it not been ______ your timely intervention, the deal would have fallen through."',
        options: ['for', 'with', 'by', 'of'],
        correctAnswer: 'for'
      },
      {
        id: 'c2-q2',
        section: 'reading',
        questionText: 'Complete the idiom structure: "The new policy came ______ for a lot of criticism from the opposition."',
        options: ['in', 'up', 'across', 'on'],
        correctAnswer: 'in'
      },
      {
        id: 'c2-q3',
        section: 'listening',
        audioText: 'Linguistic relativity, the notion that language shapes thought, has enjoyed a renaissance. Critics argue it\'s deterministic nonsense. However, empirical studies tracking color perception show that speakers of languages with separate terms for light and dark blue distinguish shades marginally faster. Language doesn\'t imprison us, but it undeniably primes our cognitive processing.',
        questionText: 'Listen to the audio. What does the speaker conclude about linguistic relativity?',
        options: ['It is entirely outdated and deterministic.', 'It primes cognitive processing rather than restricting it.', 'It is only valid for color perception.', 'It determines exactly what we can think.'],
        correctAnswer: 'It primes cognitive processing rather than restricting it.'
      },
      {
        id: 'c2-q4',
        section: 'listening',
        audioText: 'The author\'s latest novel is a stylistic tour de force, but intellectually, it\'s somewhat of a lightweight. It relies on superficial wordplay and convoluted sentence structures to mask a plot that is, at best, derivative. It\'s a shiny wrapping paper on an empty box.',
        questionText: 'Listen to the audio. What is the speaker\'s opinion of the novel?',
        options: ['Stylistically weak but intellectually deep.', 'Excellent plot with bad wordplay.', 'Superficial intellectually, despite brilliant style.', 'A groundbreaking literary masterpiece.'],
        correctAnswer: 'Superficial intellectually, despite brilliant style.'
      }
    ],
    writingPrompt: {
      topic: 'Critical essay on art',
      instructions: 'Write an essay (250-350 words) discussing the role of art in modern society. Evaluate whether art should serve a political purpose or exists solely for aesthetic pleasure.',
      minWords: 200,
      maxWords: 400
    }
  }
];
