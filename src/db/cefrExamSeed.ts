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
        section: 'reading',
        questionText: 'Complete the sentence: "I live in a small house ______ my family."',
        options: ['with', 'at', 'on', 'for'],
        correctAnswer: 'with'
      },
      {
        id: 'a1-q4',
        section: 'reading',
        questionText: 'Complete the sentence: "She ______ to school every day at 8:00 AM."',
        options: ['go', 'goes', 'going', 'went'],
        correctAnswer: 'goes'
      },
      {
        id: 'a1-q5',
        section: 'reading',
        questionText: 'Choose the correct article: "What is this? It is ______ orange book."',
        options: ['a', 'an', 'the', 'some'],
        correctAnswer: 'an'
      },
      {
        id: 'a1-q6',
        section: 'listening',
        audioText: 'Hello! Can you help me? I am looking for the library. It is next to the park.',
        questionText: 'Listen to the audio text. Where is the library?',
        options: ['Next to the school', 'Next to the park', 'Inside the supermarket', 'Behind the hospital'],
        correctAnswer: 'Next to the park'
      },
      {
        id: 'a1-q7',
        section: 'listening',
        audioText: 'I usually wake up at seven o\'clock, but on weekends I sleep until nine.',
        questionText: 'Listen to the audio text. What time does the speaker wake up on Sunday?',
        options: ['7:00', '8:00', '9:00', '10:00'],
        correctAnswer: '9:00'
      },
      {
        id: 'a1-q8',
        section: 'listening',
        audioText: 'My car is red, and my sister has a beautiful blue car.',
        questionText: 'Listen to the audio text. What color is the speaker\'s sister\'s car?',
        options: ['Red', 'Blue', 'Green', 'Yellow'],
        correctAnswer: 'Blue'
      },
      {
        id: 'a1-q9',
        section: 'listening',
        audioText: 'What is Mary\'s job? She teaches English to children at the local school.',
        questionText: 'Listen to the audio text. What does Mary do?',
        options: ['She is a doctor', 'She is a student', 'She is a teacher', 'She is a nurse'],
        correctAnswer: 'She is a teacher'
      },
      {
        id: 'a1-q10',
        section: 'listening',
        audioText: 'How old is Peter? He was born in 2002, so he is twenty-four years old.',
        questionText: 'Listen to the audio text. How old is Peter?',
        options: ['20', '22', '24', '26'],
        correctAnswer: '24'
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
        section: 'reading',
        questionText: 'Complete the sentence: "I ______ to Europe twice in my life."',
        options: ['am going', 'went', 'have been', 'was'],
        correctAnswer: 'have been'
      },
      {
        id: 'a2-q4',
        section: 'reading',
        questionText: 'Choose the correct pronoun: "He doesn\'t like coffee, and ______ do I."',
        options: ['neither', 'so', 'either', 'too'],
        correctAnswer: 'neither'
      },
      {
        id: 'a2-q5',
        section: 'reading',
        questionText: 'Complete the sentence: "You should wash your hands ______ eating your lunch."',
        options: ['before', 'after', 'while', 'during'],
        correctAnswer: 'before'
      },
      {
        id: 'a2-q6',
        section: 'listening',
        audioText: 'Welcome to our department store. The shoes are on the second floor, right next to the clothing section.',
        questionText: 'Listen to the audio text. Where can the customer find the shoes?',
        options: ['First floor', 'Second floor', 'Third floor', 'Basement'],
        correctAnswer: 'Second floor'
      },
      {
        id: 'a2-q7',
        section: 'listening',
        audioText: 'I wanted to play tennis, but it started raining heavily, so I stayed home and read a book instead.',
        questionText: 'Listen to the audio text. What did the speaker do?',
        options: ['Played tennis', 'Went for a walk', 'Read a book', 'Bought an umbrella'],
        correctAnswer: 'Read a book'
      },
      {
        id: 'a2-q8',
        section: 'listening',
        audioText: 'I have a large family: two brothers and one younger sister.',
        questionText: 'Listen to the audio text. How many siblings does the speaker have?',
        options: ['Two siblings', 'Three siblings', 'Four siblings', 'No siblings'],
        correctAnswer: 'Three siblings'
      },
      {
        id: 'a2-q9',
        section: 'listening',
        audioText: 'The bank is on Green Street, right next to the local post office.',
        questionText: 'Listen to the audio text. Where is the bank located?',
        options: ['Next to the post office', 'Behind the school', 'Across the street from the park', 'Near the supermarket'],
        correctAnswer: 'Next to the post office'
      },
      {
        id: 'a2-q10',
        section: 'listening',
        audioText: 'Jack went to bed early last night because he had a very long workday and was exhausted.',
        questionText: 'Listen to the audio text. Why did Jack go to bed early?',
        options: ['He was sick', 'He had a long workday', 'He wanted to read', 'He had an exam today'],
        correctAnswer: 'He had a long workday'
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
        section: 'reading',
        questionText: 'Choose the correct form: "I don\'t know the answer, and I wish I ______ it."',
        options: ['know', 'knew', 'have known', 'will know'],
        correctAnswer: 'knew'
      },
      {
        id: 'b1-q4',
        section: 'reading',
        questionText: 'Choose the correct form: "The manager suggested ______ the weekly meeting until next Monday."',
        options: ['postpone', 'postponing', 'to postpone', 'postponed'],
        correctAnswer: 'postponing'
      },
      {
        id: 'b1-q5',
        section: 'reading',
        questionText: 'Complete the sentence: "This is the beautiful town ______ I grew up when I was a child."',
        options: ['which', 'where', 'that', 'who'],
        correctAnswer: 'where'
      },
      {
        id: 'b1-q6',
        section: 'listening',
        audioText: 'Our flight was delayed by two hours because of heavy snow at the departure airport. We had to wait in the terminal, but the airline gave us food vouchers.',
        questionText: 'Listen to the audio text. Why was the flight delayed?',
        options: ['Technical issues', 'Bad weather', 'Pilot was late', 'Air traffic control strike'],
        correctAnswer: 'Bad weather'
      },
      {
        id: 'b1-q7',
        section: 'listening',
        audioText: 'I prefer working in the morning because the office is quiet and I can concentrate much better before everyone arrives.',
        questionText: 'Listen to the audio text. Why does the speaker prefer working early?',
        options: ['To leave early', 'Because it is quiet', 'To meet clients', 'Free coffee is served'],
        correctAnswer: 'Because it is quiet'
      },
      {
        id: 'b1-q8',
        section: 'listening',
        audioText: 'Our sales team is visiting Berlin next Monday to negotiate a new distribution contract with local retailers.',
        questionText: 'Listen to the audio text. What is the sales team doing next Monday?',
        options: ['Visiting a museum', 'Negotiating a new contract', 'Attending a workshop', 'Hiring new employees'],
        correctAnswer: 'Negotiating a new contract'
      },
      {
        id: 'b1-q9',
        section: 'listening',
        audioText: 'Due to the storm, the outdoor sightseeing tour is canceled, so the tour group will visit the National Art Museum instead.',
        questionText: 'Listen to the audio text. Where will the tour group go?',
        options: ['To the beach', 'To the National Art Museum', 'To the local park', 'Back to the hotel'],
        correctAnswer: 'To the National Art Museum'
      },
      {
        id: 'b1-q10',
        section: 'listening',
        audioText: 'I wanted to sign up for the photography class, but the registration fee was far beyond my budget, so I skipped it.',
        questionText: 'Listen to the audio text. Why didn\'t the speaker join the class?',
        options: ['It was too far', 'It was too expensive', 'It was fully booked', 'The schedule clashed with work'],
        correctAnswer: 'It was too expensive'
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
        section: 'reading',
        questionText: 'Choose the correct option: "Despite ______ hard for the exam, he failed to achieve the minimum grade."',
        options: ['studying', 'he studied', 'study', 'of studying'],
        correctAnswer: 'studying'
      },
      {
        id: 'b2-q4',
        section: 'reading',
        questionText: 'Choose the correct form: "She was accused of ______ corporate secrets to the main competitor."',
        options: ['leaking', 'leaked', 'leak', 'to leak'],
        correctAnswer: 'leaking'
      },
      {
        id: 'b2-q5',
        section: 'reading',
        questionText: 'Complete the sentence: "Unless you ______ harder, you will not pass this certification exam."',
        options: ['study', 'will study', 'studied', 'don\'t study'],
        correctAnswer: 'study'
      },
      {
        id: 'b2-q6',
        section: 'listening',
        audioText: 'The project was initially met with skepticism from the board of directors. They feared that the transition to renewable energy would incur excessive costs. However, our financial model proved that within three years, the efficiency gains would fully offset the capital expenditure.',
        questionText: 'Listen to the audio text. What did the board originally fear?',
        options: ['Technical failures', 'Excessive setup costs', 'Lack of staff training', 'Public opposition'],
        correctAnswer: 'Excessive setup costs'
      },
      {
        id: 'b2-q7',
        section: 'listening',
        audioText: 'I used to think that working from home was the perfect solution, but over time I started feeling isolated. I missed the casual chats in the breakroom and the separation between work life and home life.',
        questionText: 'Listen to the audio. What did the speaker find difficult about working from home?',
        options: ['Poor internet connection', 'Distractions from family', 'A sense of isolation', 'Increased working hours'],
        correctAnswer: 'A sense of isolation'
      },
      {
        id: 'b2-q8',
        section: 'listening',
        audioText: 'Our quarterly revenue has surged by fifteen percent, exceeding our initial forecast of eight percent growth.',
        questionText: 'Listen to the audio text. By how much did the quarterly revenue grow?',
        options: ['5 percent', '8 percent', '15 percent', '23 percent'],
        correctAnswer: '15 percent'
      },
      {
        id: 'b2-q9',
        section: 'listening',
        audioText: 'The product launch failed primarily due to insufficient market research, which led to a mismatch with consumer needs.',
        questionText: 'Listen to the audio text. What was the main reason the product launch failed?',
        options: ['Poor product quality', 'High manufacturing cost', 'Insufficient market research', 'Competitor copycats'],
        correctAnswer: 'Insufficient market research'
      },
      {
        id: 'b2-q10',
        section: 'listening',
        audioText: 'The network will be offline this Sunday from 2 AM to 5 AM to perform tests on our new security protocol.',
        questionText: 'Listen to the audio text. Why is the network going offline?',
        options: ['Routine backup maintenance', 'To install hardware', 'To test a new security protocol', 'Due to a power outage'],
        correctAnswer: 'To test a new security protocol'
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
        section: 'reading',
        questionText: 'Complete the sentence: "The software firm went bankrupt unexpectedly, ______ dozens of employees jobless overnight."',
        options: ['leaving', 'left', 'had left', 'to leave'],
        correctAnswer: 'leaving'
      },
      {
        id: 'c1-q4',
        section: 'reading',
        questionText: 'Choose the correct form: "He acted as if he ______ the sole owner of this multi-million dollar building."',
        options: ['was', 'were', 'had been', 'would be'],
        correctAnswer: 'were'
      },
      {
        id: 'c1-q5',
        section: 'reading',
        questionText: 'Choose the correct structure: "No sooner had I closed the front door ______ the phone started ringing."',
        options: ['when', 'than', 'before', 'then'],
        correctAnswer: 'than'
      },
      {
        id: 'c1-q6',
        section: 'listening',
        audioText: 'The company\'s expansion into Asian markets was heralded as a triumph. But in hindsight, it was a classic case of overextension. They failed to grasp the cultural nuances of negotiation, relying instead on aggressive marketing strategies that fell flat.',
        questionText: 'Listen to the audio. What mistake did the company make in their expansion?',
        options: ['They underestimated local competitors.', 'They misjudged cultural negotiation styles.', 'They faced supply chain issues.', 'They priced products too high.'],
        correctAnswer: 'They misjudged cultural negotiation styles.'
      },
      {
        id: 'c1-q7',
        section: 'listening',
        audioText: 'The argument for structural reform is compelling, yet it hinges on a flawed premise: that all departments possess equal resources. In reality, the disparities are so pronounced that standardizing procedures is bound to exacerbate the current inefficiency.',
        questionText: 'Listen to the audio. What is the speaker\'s main concern about structural reform?',
        options: ['It is too expensive.', 'Departments will refuse to cooperate.', 'Equal standardization will worsen inefficiency due to resource disparities.', 'It will take too long to implement.'],
        correctAnswer: 'Equal standardization will worsen inefficiency due to resource disparities.'
      },
      {
        id: 'c1-q8',
        section: 'listening',
        audioText: 'The implementation of decentralized ledger technology is not merely a superficial upgrade; it represents a paradigm shift in data integrity.',
        questionText: 'Listen to the audio text. What does the speaker say about the technology?',
        options: ['It is a costly mistake', 'It is a superficial update', 'It represents a paradigm shift in data integrity', 'It has failed testing phases'],
        correctAnswer: 'It represents a paradigm shift in data integrity'
      },
      {
        id: 'c1-q9',
        section: 'listening',
        audioText: 'A critical review of the research paper reveals that the author overlooked a key confounding variable, rendering the conclusion about correlation invalid.',
        questionText: 'Listen to the audio text. What was the issue with the research paper?',
        options: ['It lacked citations', 'It overlooked a key confounding variable', 'It was written too quickly', 'It had mathematical typos'],
        correctAnswer: 'It overlooked a key confounding variable'
      },
      {
        id: 'c1-q10',
        section: 'listening',
        audioText: 'The decision to migrate our database infrastructure to a hybrid cloud architecture was made primarily to mitigate potential security vulnerabilities.',
        questionText: 'Listen to the audio text. Why did the company migrate their database?',
        options: ['To lower monthly costs', 'To test a new cloud supplier', 'To mitigate potential security vulnerabilities', 'To speed up loading queries'],
        correctAnswer: 'To mitigate potential security vulnerabilities'
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
        section: 'reading',
        questionText: 'Complete the sentence: "She is a force to be ______ with in the international corporate world."',
        options: ['reckoned', 'dealt', 'thought', 'faced'],
        correctAnswer: 'reckoned'
      },
      {
        id: 'c2-q4',
        section: 'reading',
        questionText: 'Choose the correct form: "It is absolutely essential that the CEO ______ present at the general assembly meeting."',
        options: ['is', 'be', 'should be', 'was'],
        correctAnswer: 'be'
      },
      {
        id: 'c2-q5',
        section: 'reading',
        questionText: 'Complete the sentence: "He has an uncanny ability to read between the lines, ______ his competitors\' real intentions."',
        options: ['discerning', 'discerned', 'to discern', 'discern'],
        correctAnswer: 'discerning'
      },
      {
        id: 'c2-q6',
        section: 'listening',
        audioText: 'Linguistic relativity, the notion that language shapes thought, has enjoyed a renaissance. Critics argue it\'s deterministic nonsense. However, empirical studies tracking color perception show that speakers of languages with separate terms for light and dark blue distinguish shades marginally faster. Language doesn\'t imprison us, but it undeniably primes our cognitive processing.',
        questionText: 'Listen to the audio. What does the speaker conclude about linguistic relativity?',
        options: ['It is entirely outdated and deterministic.', 'It primes cognitive processing rather than restricting it.', 'It is only valid for color perception.', 'It determines exactly what we can think.'],
        correctAnswer: 'It primes cognitive processing rather than restricting it.'
      },
      {
        id: 'c2-q7',
        section: 'listening',
        audioText: 'The author\'s latest novel is a stylistic tour de force, but intellectually, it\'s somewhat of a lightweight. It relies on superficial wordplay and convoluted sentence structures to mask a plot that is, at best, derivative. It\'s a shiny wrapping paper on an empty box.',
        questionText: 'Listen to the audio. What is the speaker\'s opinion of the novel?',
        options: ['Stylistically weak but intellectually deep.', 'Excellent plot with bad wordplay.', 'Superficial intellectually, despite brilliant style.', 'A groundbreaking literary masterpiece.'],
        correctAnswer: 'Superficial intellectually, despite brilliant style.'
      },
      {
        id: 'c2-q8',
        section: 'listening',
        audioText: 'The global supply chain operates on a just-in-time philosophy that maximizes short-term profits but renders the entire system inherently fragile to unexpected shocks.',
        questionText: 'Listen to the audio text. What is the speaker\'s main criticism of the just-in-time philosophy?',
        options: ['It decreases employee morale', 'It increases short-term losses', 'It makes the global supply chain inherently fragile', 'It requires too much physical warehouse storage'],
        correctAnswer: 'It makes the global supply chain inherently fragile'
      },
      {
        id: 'c2-q9',
        section: 'listening',
        audioText: 'Instead of a dry academic text, the scholar has delivered a nuanced exploration of post-industrial economies, though it remains somewhat inaccessible to laypersons.',
        questionText: 'Listen to the audio text. What is the speaker\'s assessment of the text?',
        options: ['It is dry and uninformative', 'It is a nuanced exploration, but inaccessible to laypersons', 'It is targeted entirely at children', 'It lacks academic rigor and sources'],
        correctAnswer: 'It is a nuanced exploration, but inaccessible to laypersons'
      },
      {
        id: 'c2-q10',
        section: 'listening',
        audioText: 'The engineering team rewrote the database query engine in Rust, not for the sake of novelty, but to optimize memory footprint under heavy loads.',
        questionText: 'Listen to the audio text. Why was the query engine rewritten in Rust?',
        options: ['To learn a new language', 'To optimize memory footprint under heavy loads', 'To hire new engineers', 'To integrate web APIs'],
        correctAnswer: 'To optimize memory footprint under heavy loads'
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
