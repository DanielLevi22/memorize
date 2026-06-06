import type { AIService } from '../services/ai/types';

// Dictionary of representative English words classified by CEFR levels
export const cefrDict: Record<string, 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'> = {
  // A1 (Basic I)
  "apple": "A1", "book": "A1", "cat": "A1", "dog": "A1", "house": "A1", "car": "A1",
  "boy": "A1", "girl": "A1", "man": "A1", "woman": "A1", "child": "A1", "school": "A1",
  "water": "A1", "milk": "A1", "food": "A1", "bread": "A1", "fish": "A1", "sun": "A1",
  "moon": "A1", "tree": "A1", "flower": "A1", "day": "A1", "night": "A1", "morning": "A1",
  "evening": "A1", "name": "A1", "hello": "A1", "goodbye": "A1", "yes": "A1", "no": "A1",
  "please": "A1", "thanks": "A1", "family": "A1", "mother": "A1", "father": "A1",
  "brother": "A1", "sister": "A1", "friend": "A1", "city": "A1", "street": "A1",
  "room": "A1", "bed": "A1", "table": "A1", "chair": "A1", "pen": "A1", "pencil": "A1",
  "paper": "A1", "time": "A1", "year": "A1", "week": "A1", "hour": "A1", "hot": "A1",
  "cold": "A1", "big": "A1", "small": "A1", "happy": "A1", "sad": "A1", "red": "A1",
  "blue": "A1", "green": "A1", "yellow": "A1", "black": "A1", "white": "A1",
  "run": "A1", "walk": "A1", "sleep": "A1", "read": "A1", "write": "A1", "speak": "A1",
  "eat": "A1", "drink": "A1", "see": "A1", "hear": "A1", "go": "A1", "come": "A1",
  "find": "A1", "buy": "A1", "like": "A1", "love": "A1", "want": "A1", "need": "A1",
  "new": "A1", "old": "A1", "young": "A1", "easy": "A1",

  // A2 (Basic II)
  "airport": "A2", "beach": "A2", "bridge": "A2", "building": "A2", "castle": "A2",
  "church": "A2", "cinema": "A2", "country": "A2", "doctor": "A2", "driver": "A2",
  "factory": "A2", "farm": "A2", "garden": "A2", "hospital": "A2", "hotel": "A2",
  "island": "A2", "library": "A2", "market": "A2", "museum": "A2", "office": "A2",
  "station": "A2", "theater": "A2", "accident": "A2", "address": "A2", "apartment": "A2",
  "advice": "A2", "answer": "A2", "autumn": "A2", "birthday": "A2", "chocolate": "A2",
  "coffee": "A2", "computer": "A2", "concert": "A2", "cousin": "A2", "daughter": "A2",
  "dentist": "A2", "dictionary": "A2", "dinner": "A2", "exercise": "A2", "holiday": "A2",
  "journey": "A2", "kitchen": "A2", "luggage": "A2", "member": "A2", "message": "A2",
  "partner": "A2", "passport": "A2", "problem": "A2", "question": "A2", "season": "A2",
  "sentence": "A2", "subject": "A2", "tourist": "A2", "traffic": "A2", "weather": "A2",
  "website": "A2", "winter": "A2", "angry": "A2", "beautiful": "A2", "clean": "A2",
  "dirty": "A2", "difficult": "A2", "different": "A2", "excited": "A2", "expensive": "A2",
  "famous": "A2", "hungry": "A2", "important": "A2", "agree": "A2", "arrive": "A2",
  "begin": "A2", "believe": "A2", "change": "A2", "decide": "A2", "explain": "A2",
  "finish": "A2", "forget": "A2", "happen": "A2", "improve": "A2", "learn": "A2",
  "listen": "A2", "remember": "A2", "travel": "A2",

  // B1 (Intermediate I)
  "abroad": "B1", "ability": "B1", "access": "B1", "account": "B1", "action": "B1",
  "advertisement": "B1", "agency": "B1", "aim": "B1", "amount": "B1", "anxiety": "B1",
  "apology": "B1", "appearance": "B1", "argument": "B1", "article": "B1", "attention": "B1",
  "attitude": "B1", "audience": "B1", "author": "B1", "average": "B1", "behavior": "B1",
  "benefit": "B1", "business": "B1", "candidate": "B1", "career": "B1", "century": "B1",
  "challenge": "B1", "character": "B1", "charity": "B1", "citizen": "B1", "climate": "B1",
  "collection": "B1", "comfort": "B1", "committee": "B1", "community": "B1", "company": "B1",
  "comparison": "B1", "competition": "B1", "complaint": "B1", "conclusion": "B1", "condition": "B1",
  "confidence": "B1", "connection": "B1", "consequence": "B1", "consumer": "B1", "contact": "B1",
  "contest": "B1", "contract": "B1", "conversation": "B1", "culture": "B1", "customer": "B1",
  "damage": "B1", "danger": "B1", "debate": "B1", "decade": "B1", "decision": "B1",
  "degree": "B1", "department": "B1", "description": "B1", "detail": "B1", "development": "B1",
  "device": "B1", "direction": "B1", "director": "B1", "disaster": "B1", "discovery": "B1",
  "discussion": "B1", "disease": "B1", "distance": "B1", "document": "B1", "dream": "B1",
  "duty": "B1", "economy": "B1", "education": "B1", "effect": "B1", "effort": "B1",
  "election": "B1", "employee": "B1", "employer": "B1", "energy": "B1", "environment": "B1",
  "equipment": "B1", "error": "B1", "event": "B1", "evidence": "B1", "examination": "B1",
  "experience": "B1", "expert": "B1", "fear": "B1", "feature": "B1", "feeling": "B1",
  "field": "B1", "figure": "B1", "focus": "B1", "force": "B1", "freedom": "B1",
  "future": "B1",

  // B2 (Intermediate II)
  "abnormal": "B2", "abolish": "B2", "abortion": "B2", "absence": "B2", "absorb": "B2",
  "abstract": "B2", "abuse": "B2", "academic": "B2", "accent": "B2", "acceptable": "B2",
  "acceptance": "B2", "accessible": "B2", "accommodation": "B2", "accompany": "B2", "accomplish": "B2",
  "accord": "B2", "accordance": "B2", "accordingly": "B2", "accountability": "B2", "accountable": "B2",
  "accounting": "B2", "accumulate": "B2", "accumulation": "B2", "accuracy": "B2", "accurate": "B2",
  "accurately": "B2", "accusation": "B2", "accuse": "B2", "accustomed": "B2", "acid": "B2",
  "acknowledge": "B2", "acknowledgement": "B2", "acquire": "B2", "acquisition": "B2", "acre": "B2",
  "activate": "B2", "activation": "B2", "activist": "B2", "acute": "B2", "adaptation": "B2",
  "adequacy": "B2", "adequate": "B2", "adequately": "B2", "adhere": "B2", "adherence": "B2",
  "adjacent": "B2", "adjective": "B2", "adjust": "B2", "adjustment": "B2", "administer": "B2",
  "administration": "B2", "administrative": "B2", "administrator": "B2", "admirable": "B2", "admiration": "B2",
  "admission": "B2", "admitted": "B2", "adolescence": "B2", "adolescent": "B2", "adoption": "B2",
  "adorable": "B2", "adore": "B2", "adorn": "B2", "drift": "B2", "advantageous": "B2",
  "advent": "B2", "adverse": "B2", "adversely": "B2", "adversity": "B2", "advertiser": "B2",
  "advertising": "B2", "advisable": "B2", "advised": "B2", "adviser": "B2", "advisory": "B2",
  "advocacy": "B2", "advocate": "B2", "aerial": "B2", "aerospace": "B2", "aesthetic": "B2",
  "affable": "B2", "affair": "B2", "affection": "B2", "affectionate": "B2",

  // C1 (Advanced I)
  "aberration": "C1", "abhor": "C1", "abject": "C1", "abjure": "C1", "abrasive": "C1",
  "abridge": "C1", "abrogated": "C1", "abrupt": "C1", "abruptly": "C1", "abscond": "C1",
  "absolve": "C1", "abstain": "C1", "abstemious": "C1", "abstinence": "C1", "abstracted": "C1",
  "abstruse": "C1", "absurdity": "C1", "abundant": "C1", "abundantly": "C1", "abysmal": "C1",
  "abyss": "C1", "academician": "C1", "accede": "C1", "accentuate": "C1", "acclaim": "C1",
  "acclamation": "C1", "acclimatize": "C1", "acclivity": "C1", "accolade": "C1", "accommodating": "C1",
  "accomplice": "C1", "accomplished": "C1", "accordant": "C1", "accost": "C1", "accouchement": "C1",
  "accredit": "C1", "accreditation": "C1", "accretion": "C1", "accrow": "C1", "accrual": "C1",
  "accrue": "C1", "acculturate": "C1", "accumulated": "C1", "accursed": "C1", "accusatory": "C1",
  "accuser": "C1", "acerbic": "C1", "acerbity": "C1", "ache": "C1", "achievable": "C1",
  "acidic": "C1", "acidulate": "C1", "acknowledgeable": "C1", "acme": "C1", "acolyte": "C1",
  "acoustics": "C1", "acquaint": "C1", "acquaintance": "C1", "acquiescent": "C1", "acquireable": "C1",
  "acquisitive": "C1", "acquit": "C1", "acquittal": "C1", "acrid": "C1", "acrimonious": "C1",
  "acrimony": "C1", "acrobat": "C1", "acrobatic": "C1", "acromegaly": "C1", "acronym": "C1",
  "acrophobia": "C1", "acrylic": "C1", "actuate": "C1", "acuity": "C1", "acumen": "C1",
  "adage": "C1", "adamant": "C1", "adamantly": "C1", "adaptable": "C1", "adaptability": "C1",
  "adaption": "C1", "addendum": "C1", "addict": "C1", "addiction": "C1",

  // C2 (Advanced II / Proficient)
  "abnegation": "C2", "cacophony": "C2", "desultory": "C2", "effrontery": "C2", "fastidious": "C2",
  "grandiloquent": "C2", "iconoclast": "C2", "imperturbable": "C2", "insouciant": "C2", "maudlin": "C2",
  "mendacious": "C2", "nadir": "C2", "obstreperous": "C2", "perspicacious": "C2", "pulchritude": "C2",
  "refulgent": "C2", "sinecure": "C2", "surreptitious": "C2", "truculent": "C2", "turgid": "C2",
  "visceral": "C2", "gregarious": "C2", "plethora": "C2", "ubiquitous": "C2", "soliloquy": "C2",
  "recalcitrant": "C2", "paradigmatic": "C2", "obfuscate": "C2", "loquacious": "C2", "laconic": "C2",
  "idiosyncrasy": "C2", "harangue": "C2", "esoteric": "C2", "dearth": "C2", "capricious": "C2",
  "anomaly": "C2", "hegemony": "C2", "bellicose": "C2"
};

// Cleans a string to look up words
export const cleanText = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"]/g, "")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
};

// Classifies a word or sentence using the local dictionary.
// Returns the HIGHEST CEFR level found in the text.
export const classifyLocal = (text: string): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null => {
  const words = cleanText(text);
  if (words.length === 0) return null;

  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  let highestLevelIdx = -1;

  for (const word of words) {
    const lvl = cefrDict[word];
    if (lvl) {
      const idx = levels.indexOf(lvl);
      if (idx > highestLevelIdx) {
        highestLevelIdx = idx;
      }
    }
  }

  return highestLevelIdx === -1 ? null : (levels[highestLevelIdx] as any);
};

// Classifies a batch of words using the AI Service.
// Retries/returns a dictionary map of word -> level.
export const classifyWithGemini = async (
  words: string[],
  aiService: AIService
): Promise<Record<string, 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>> => {
  if (words.length === 0) return {};

  const prompt = `Classifique cada uma das seguintes palavras/frases em inglês em um dos níveis de proficiência do CEFR (A1, A2, B1, B2, C1, C2). 
Retorne APENAS um objeto JSON puro mapeando a palavra/frase em minúsculas para o nível correspondente, sem explicações, comentários ou marcações adicionais.
Exemplo de formato:
{
  "cat": "A1",
  "reluctant": "C1"
}

Palavras/Frases a classificar:
${JSON.stringify(words)}`;

  try {
    const textResponse = await aiService.generateContent({
      messages: [{ role: 'user', content: prompt }],
      responseMimeType: 'application/json'
    });

    const classificationMap = JSON.parse(textResponse.trim());

    // Validate that the mapping contains valid CEFR levels
    const result: Record<string, any> = {};
    const validLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    
    for (const key of Object.keys(classificationMap)) {
      const val = classificationMap[key]?.toUpperCase();
      if (validLevels.includes(val)) {
        result[key.toLowerCase()] = val;
      }
    }

    return result;
  } catch (err) {
    console.error("AI classification failed:", err);
    return {};
  }
};
