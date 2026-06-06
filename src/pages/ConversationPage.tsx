import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAI } from '../services/ai/AIContext';
import type { ChatMessage, ChatPartner } from '../types';
import { 
  Send, Mic, MicOff, Volume2, ArrowLeft, Trash2, 
  Sparkles, AlertCircle, Headphones, Languages, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { translateWithMyMemory } from '../utils/readingProcessor';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

interface ConversationPageProps {
  geminiApiKey: string;
  ttsRate: number;
  ttsVoice: string | null;
}

const CHAT_PARTNERS: ChatPartner[] = [
  {
    id: 'partner-alice',
    name: 'Alice',
    role: 'Professora de Inglês (Didática)',
    avatar: '👩‍🏫',
    description: 'Conversa de forma calma, didática e traz dicas úteis de correção gramatical em português.',
    systemPrompt: 'You are Alice, a highly supportive, friendly English teacher. Your goal is to converse with the student in simple English. Keep your responses short (1-2 sentences) and end with a friendly question. Crucial rule: You must also output a JSON property "grammarCorrection" containing a short, helpful explanation in Portuguese if the student made a grammar mistake in their message, otherwise return null. Do not mention that you are an AI, keep the teacher persona.',
    initialMessage: "Hello! I'm Alice, your English teacher. I'm so excited to chat with you today! How has your day been so far?"
  },
  {
    id: 'partner-john',
    name: 'John',
    role: 'Parceiro de Viagens (Casual)',
    avatar: '✈️',
    description: 'Adora falar sobre viagens, países, hobbies e aventuras do cotidiano com expressões casuais naturais.',
    systemPrompt: 'You are John, a relaxed, friendly travel blogger. Speak in casual, conversational English using natural slang and contractions (e.g. gonna, wanna). Keep responses short (1-2 sentences) and ask a follow-up question. Crucial rule: You must also output a JSON property "grammarCorrection" containing a short, helpful explanation in Portuguese if the student made a grammar mistake, otherwise return null. Do not mention that you are an AI, keep the traveler persona.',
    initialMessage: "Hey there! I'm John. I just got back from a crazy road trip! What's up? Do you like traveling?"
  },
  {
    id: 'partner-david',
    name: 'David',
    role: 'Recrutador de TI/Negócios (Formal)',
    avatar: '💼',
    description: 'Ideal para praticar entrevistas de emprego. Vocabulário profissional e perguntas sobre carreira.',
    systemPrompt: 'You are David, a professional corporate recruiter. Conduct a mock job interview. Ask typical interview question, maintain a formal and encouraging tone. Keep responses short (1-2 sentences) and ask the next interview question. Crucial rule: You must also output a JSON property "grammarCorrection" containing a short, helpful explanation in Portuguese if the student made a grammar mistake, otherwise return null. Do not mention that you are an AI, keep the recruiter persona.',
    initialMessage: "Good day. I am David, and I will be conducting your mock interview today. To start, could you please introduce yourself and tell me a bit about your professional background?"
  }
];

export function ConversationPage({ geminiApiKey, ttsRate, ttsVoice }: ConversationPageProps) {
  const { aiService, aiProvider, setAiProvider } = useAI();
  const [selectedPartner, setSelectedPartner] = useState<ChatPartner | null>(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const handsFreeRef = useRef(handsFree);

  // Sync handsFree state to ref for callbacks
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);

  // Load chat messages from IndexedDB for the selected partner
  const messages = useLiveQuery(
    async () => {
      if (!selectedPartner) return [];
      const list = await db.chatMessages
        .where('partnerId')
        .equals(selectedPartner.id)
        .sortBy('timestamp');
      return list;
    },
    [selectedPartner]
  );

  // Auto-scroll chat to the bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const hasSeededRef = useRef(false);
  useEffect(() => {
    hasSeededRef.current = false;
  }, [selectedPartner]);

  // Initialize/Seed initial message if chat is empty
  useEffect(() => {
    const seedChat = async () => {
      // Use !== undefined check to wait for Dexie to load
      if (selectedPartner && messages !== undefined && messages.length === 0 && !hasSeededRef.current) {
        hasSeededRef.current = true;
        // Double check DB to prevent React StrictMode double insertion
        const count = await db.chatMessages.where('partnerId').equals(selectedPartner.id).count();
        if (count === 0) {
          const welcomeMessage: ChatMessage & { partnerId: string } = {
            id: crypto.randomUUID(),
            partnerId: selectedPartner.id,
            sender: 'ai',
            text: selectedPartner.initialMessage,
            timestamp: Date.now(),
            grammarCorrection: null
          };
          await db.chatMessages.add(welcomeMessage);
          speakResponse(welcomeMessage.text, welcomeMessage.id);
        }
      }
    };
    seedChat();
  }, [selectedPartner, messages]);

  const handleTranslate = async (msgId: string, text: string) => {
    if (translations[msgId]) {
      const newTrans = { ...translations };
      delete newTrans[msgId];
      setTranslations(newTrans);
      return;
    }
    
    setTranslatingId(msgId);
    try {
      const ptText = await translateWithMyMemory(text);
      setTranslations(prev => ({ ...prev, [msgId]: ptText }));
    } catch (e) {
      console.error("Translation error:", e);
    } finally {
      setTranslatingId(null);
    }
  };

  // Handle SpeechSynthesis audio output
  const speakResponse = (text: string, msgId: string) => {
    window.speechSynthesis?.cancel();
    setCurrentlySpeakingId(msgId);

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = ttsRate;

    if (ttsVoice) {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      const matched = voices.find((v) => v.name === ttsVoice);
      if (matched) {
        utt.voice = matched;
        utt.lang = matched.lang;
      }
    }

    utt.onend = () => {
      setCurrentlySpeakingId(null);
      if (handsFreeRef.current) {
        setTimeout(() => {
          startListeningAutomatically();
        }, 300);
      }
    };

    utt.onerror = () => {
      setCurrentlySpeakingId(null);
    };

    window.speechSynthesis?.speak(utt);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setCurrentlySpeakingId(null);
  };

  // Start speech recognition automatically (for hands-free continuous loop)
  const startListeningAutomatically = () => {
    if (isRecording || isThinking) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim().length > 0) {
          handleSendMessage(transcript);
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error (auto):", e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error("Failed auto speech start:", e);
    }
  };

  // Manual toggle for recording
  const handleToggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconhecimento de voz não suportado neste navegador. Use o Chrome ou Edge.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim().length > 0) {
          handleSendMessage(transcript);
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Call AI API to process conversation
  const getAIResponse = async (
    userMsg: string,
    history: ChatMessage[],
    partner: ChatPartner
  ): Promise<{ reply: string; grammarCorrection: string | null }> => {
    if (aiProvider === 'gemini' && !geminiApiKey.trim()) {
      throw new Error("Configure sua API Key do Gemini nas configurações antes de iniciar.");
    }

    // Format chat messages history to schema
    const recentHistory = history.slice(-8);
    const messagesParam = recentHistory.map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text
    }));

    // Add current user message
    messagesParam.push({
      role: 'user',
      content: userMsg
    });

    let systemPrompt = partner.systemPrompt;
    if (aiProvider === 'ollama') {
      systemPrompt += `\n\nCRITICAL JSON INSTRUCTION: You must respond ONLY with a valid JSON object matching this schema:
{
  "reply": "your conversation response in English (1-2 sentences)",
  "grammarCorrection": "short explanation in Portuguese if the student made a grammar/vocabulary mistake in their latest message, or null if there are no errors"
}
Ensure the JSON is strictly formatted and contains only these keys. Do not output any thinking or conversational text outside the JSON.`;
    }

    const responseText = await aiService.generateContent({
      systemPrompt,
      messages: messagesParam,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          reply: { type: 'STRING', description: 'The conversation response in English.' },
          grammarCorrection: { 
            type: 'STRING', 
            description: 'If the user made a grammar or vocabulary error in their latest message, explain it in Portuguese. Otherwise return null.' 
          }
        },
        required: ['reply']
      }
    });

    let parsed: any = {};
    try {
      let cleanResponse = responseText.trim();
      
      // Clean markdown code blocks if returned
      if (cleanResponse.startsWith('```')) {
        const lines = cleanResponse.split('\n');
        if (lines[0].startsWith('```')) lines.shift();
        if (lines[lines.length - 1].startsWith('```')) lines.pop();
        cleanResponse = lines.join('\n').trim();
      }

      // Find JSON block boundary if conversational text is present
      const startIdx = cleanResponse.indexOf('{');
      const endIdx = cleanResponse.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanResponse = cleanResponse.substring(startIdx, endIdx + 1);
      }

      parsed = JSON.parse(cleanResponse);
    } catch (err) {
      console.error("Failed to parse conversation AI response JSON:", responseText, err);
      // Fallback: treat raw response as reply
      parsed = { reply: responseText };
    }

    // Defensive key mapping for reply
    let reply = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.content;
    if (!reply && typeof parsed === 'object' && parsed !== null) {
      const textKeys = Object.keys(parsed).filter(k => typeof parsed[k] === 'string' && k !== 'grammarCorrection');
      if (textKeys.length > 0) {
        reply = parsed[textKeys[0]];
      }
    }

    if (typeof reply === 'string') {
      reply = reply.trim();
    } else {
      reply = "";
    }

    // Defensive key mapping for grammarCorrection
    let gc = parsed.grammarCorrection || parsed.correction || parsed.grammar;
    if (gc === "null" || gc === "None" || gc === "" || gc === undefined) {
      gc = null;
    }
    
    return {
      reply: reply || "Sorry, I didn't catch that. Could you repeat?",
      grammarCorrection: gc || null
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const finalMsgText = textToSend || inputText;
    if (!finalMsgText.trim() || !selectedPartner || isThinking) return;

    setInputText('');
    stopSpeaking();

    // 1. Add user message to DB
    const userMessage: ChatMessage & { partnerId: string } = {
      id: crypto.randomUUID(),
      partnerId: selectedPartner.id,
      sender: 'user',
      text: finalMsgText.trim(),
      timestamp: Date.now(),
      grammarCorrection: null
    };

    await db.chatMessages.add(userMessage);
    setIsThinking(true);

    try {
      const currentHistory = messages ? [...messages] : [];
      // 2. Fetch Gemini response
      const result = await getAIResponse(userMessage.text, currentHistory, selectedPartner);

      // Save grammar correction to user message if present
      if (result.grammarCorrection) {
        await db.chatMessages.update(userMessage.id, {
          grammarCorrection: result.grammarCorrection
        });
      }

      // 3. Save AI message to DB
      const aiMessage: ChatMessage & { partnerId: string } = {
        id: crypto.randomUUID(),
        partnerId: selectedPartner.id,
        sender: 'ai',
        text: result.reply,
        timestamp: Date.now(),
        grammarCorrection: null
      };

      await db.chatMessages.add(aiMessage);
      setIsThinking(false);

      // Speak AI response
      speakResponse(aiMessage.text, aiMessage.id);
    } catch (e: any) {
      console.error(e);
      setIsThinking(false);
      
      const errorMessage: ChatMessage & { partnerId: string } = {
        id: crypto.randomUUID(),
        partnerId: selectedPartner.id,
        sender: 'ai',
        text: `⚠️ Ops! Ocorreu um erro: ${e.message || 'Verifique sua conexão e chave de API.'}`,
        timestamp: Date.now(),
        grammarCorrection: null
      };
      await db.chatMessages.add(errorMessage);
    }
  };

  const handleClearChat = () => {
    if (!selectedPartner) return;
    setShowClearConfirm(true);
  };

  const confirmClearChat = async () => {
    if (!selectedPartner) return;
    stopSpeaking();
    await db.chatMessages.where('partnerId').equals(selectedPartner.id).delete();
    setShowClearConfirm(false);
    toast.success("Histórico limpo com sucesso!");
  };

  const handleBackToPartners = () => {
    stopSpeaking();
    setSelectedPartner(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] md:h-[calc(100vh-100px)] w-full max-w-4xl mx-auto p-2 md:p-4 transition-all duration-300">
      
      {aiProvider === 'gemini' && !geminiApiKey.trim() ? (
        /* API KEY WARNING */
        <div className="flex flex-col items-center justify-center flex-1 space-y-4 text-center p-6 bg-card border border-border rounded-2xl shadow-sm">
          <AlertCircle size={48} className="text-amber-500 animate-pulse" />
          <h2 className="text-lg font-extrabold text-foreground">API Key do Gemini Requerida</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            A Arena de Conversação por Voz funciona diretamente conectada à Inteligência Artificial do Google Gemini. Cole sua chave de API nas configurações do aplicativo para começar a conversar.
          </p>
        </div>
      ) : !selectedPartner ? (
        /* PARTNER SELECTOR SCREEN */
        <div className="flex flex-col flex-1 space-y-6 animate-fadeIn py-4">
          <div className="space-y-1.5 text-center md:text-left">
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center justify-center md:justify-start gap-2">
              <Sparkles size={20} className="text-primary fill-primary/10 animate-pulse" />
              Arena de Conversação com IA
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              Escolha um parceiro virtual e treine conversas em inglês de forma livre por áudio ou texto.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/20 border border-border/80 rounded-2xl">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-foreground">Motor de Inteligência Artificial</span>
              <span className="text-[10px] text-muted-foreground">Escolha qual IA processará suas mensagens e dicas de gramática.</span>
            </div>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'ollama')}
              className="bg-background border border-border text-foreground px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-violet-500/50 cursor-pointer w-full sm:w-48"
            >
              <option value="gemini">Gemini Flash (Nuvem)</option>
              <option value="ollama">Ollama (Local / Llama)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CHAT_PARTNERS.map((partner) => (
              <div 
                key={partner.id}
                onClick={() => setSelectedPartner(partner)}
                className="flex flex-col bg-card hover:bg-muted/40 border border-border/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-200 justify-between gap-4 group"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-primary/5 group-hover:bg-primary/10 border border-primary/10 rounded-2xl flex items-center justify-center text-3xl transition-all shadow-sm">
                    {partner.avatar}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground group-hover:text-primary transition-colors">
                      {partner.name}
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {partner.role}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    {partner.description}
                  </p>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg">
                    Conversar
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-muted/40 border border-border/60 rounded-xl space-y-2 text-xs text-muted-foreground">
            <span className="font-bold text-foreground block">💡 Dicas de Treino:</span>
            <ul className="list-disc pl-4 space-y-1">
              <li>Use o modo **Viva-Voz** para simular uma ligação telefônica e exercitar rapidez na fala.</li>
              <li>A IA corrigirá seus erros de gramática discretamente em português se você falar alguma frase incorreta.</li>
              <li>Clique no balão de fala da IA a qualquer momento para ouvi-la repetir a fala.</li>
            </ul>
          </div>
        </div>
      ) : (
        /* CHAT INTERFACE */
        <div className="flex flex-col flex-1 bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-fadeIn h-full">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/80 bg-muted/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted"
                onClick={handleBackToPartners}
                title="Voltar aos parceiros"
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="text-2xl">{selectedPartner.avatar}</div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm text-foreground truncate">{selectedPartner.name}</span>
                <span className="text-[9px] text-muted-foreground font-bold tracking-wide uppercase truncate">
                  {selectedPartner.role}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'ollama')}
                className="bg-background border border-border text-foreground px-2 py-1.5 rounded-xl text-[10px] font-bold outline-none focus:border-violet-500/50 cursor-pointer w-24 h-8"
              >
                <option value="gemini">Gemini</option>
                <option value="ollama">Ollama</option>
              </select>

              {/* Hands-Free continuous loop Toggle */}
              <button
                onClick={() => setHandsFree(!handsFree)}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                  handsFree
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Ative para que o microfone se abra automaticamente após a IA falar"
              >
                <Headphones size={12} />
                <span>Viva-Voz: {handsFree ? 'LIGADO' : 'DESLIGADO'}</span>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                onClick={handleClearChat}
                title="Limpar histórico"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>

          {/* Messages List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-muted/5 scrollbar-thin">
            {messages && messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isSpeaking = currentlySpeakingId === msg.id;

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col space-y-1.5 max-w-[85%] ${isUser ? 'ml-auto items-end' : 'mr-auto items-start animate-fadeIn'}`}
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className={`flex items-end gap-1.5 ${isUser ? 'ml-auto' : 'mr-auto'}`}>
                      {/* User bubble vs AI bubble */}
                      <div 
                        className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm transition-all duration-200 group ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-card text-foreground border border-border/80 rounded-tl-none'
                        } ${isSpeaking ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.01]' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="whitespace-pre-wrap">{msg.text}</span>
                          <div className="flex gap-2 items-start shrink-0 opacity-40 group-hover:opacity-100 transition-opacity mt-0.5">
                            <button 
                              onClick={() => handleTranslate(msg.id, msg.text)}
                              title="Traduzir"
                              className="hover:text-primary transition-colors cursor-pointer"
                            >
                              {translatingId === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                            </button>
                            <button 
                              onClick={() => speakResponse(msg.text, msg.id)}
                              title="Ouvir"
                              className={`hover:text-primary transition-colors cursor-pointer ${isSpeaking ? 'text-primary animate-pulse opacity-100' : ''}`}
                            >
                              <Volume2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Translation display */}
                    {translations[msg.id] && (
                      <div className={`text-[11px] font-medium p-2 rounded-xl bg-muted/40 border border-border/50 text-muted-foreground animate-fadeIn ${isUser ? 'ml-auto text-right rounded-tr-none' : 'mr-auto text-left rounded-tl-none'}`}>
                        {translations[msg.id]}
                      </div>
                    )}
                  </div>

                  {/* Grammar Correction Panel */}
                  {isUser && msg.grammarCorrection && msg.grammarCorrection !== "null" && (
                    <div className="w-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-800 dark:text-amber-300 leading-normal animate-fadeIn flex gap-1.5 shadow-sm max-w-sm">
                      <AlertCircle size={14} className="shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <span className="font-bold text-[10px] uppercase tracking-wider block mb-0.5 text-amber-600 dark:text-amber-400">
                          Dica Gramatical
                        </span>
                        <span className="font-medium whitespace-pre-wrap">{msg.grammarCorrection}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="mr-auto items-start max-w-[80%] flex flex-col space-y-1 animate-pulse">
                <div className="bg-card text-muted-foreground border border-border/80 p-3 rounded-2xl rounded-tl-none text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span>{selectedPartner.name} está pensando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input control panel */}
          <div className="p-3 border-t border-border bg-card/60 backdrop-blur-md">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2 max-w-3xl mx-auto"
            >
              {/* Mic audio record button */}
              <button
                type="button"
                onClick={handleToggleRecording}
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  isRecording 
                    ? 'bg-destructive text-destructive-foreground animate-pulse shadow-md ring-4 ring-destructive/20' 
                    : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/10'
                }`}
                title={isRecording ? "Parar gravação de voz" : "Falar no microfone"}
                disabled={isThinking}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isRecording ? "Ouvindo sua fala..." : "Digite sua mensagem em inglês..."}
                disabled={isRecording || isThinking}
                className="flex-1 h-10 px-3.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground font-semibold"
              />

              <Button
                type="submit"
                className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold gap-1 cursor-pointer"
                disabled={!inputText.trim() || isRecording || isThinking}
              >
                <Send size={13} />
                <span>Enviar</span>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Limpeza */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Trash2 size={28} />
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Limpar Histórico
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
              Tem certeza que deseja apagar todas as conversas com <strong className="text-foreground">{selectedPartner?.name}</strong>? Essa ação é permanente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 font-bold h-11 rounded-xl"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-bold h-11 rounded-xl shadow-sm"
              onClick={confirmClearChat}
            >
              Sim, apagar tudo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
