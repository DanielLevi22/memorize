import React, { createContext, useContext, useState, useMemo } from 'react';
import type { AIService } from './types';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';

interface AIContextProps {
  aiService: AIService;
  aiProvider: 'gemini' | 'ollama';
  setAiProvider: (provider: 'gemini' | 'ollama') => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  ollamaApiUrl: string;
  setOllamaApiUrl: (url: string) => void;
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
  testConnection: () => Promise<boolean>;
}

const AIContext = createContext<AIContextProps | undefined>(undefined);

export function AIProvider({ children }: { children: React.ReactNode }) {
  // Load initial settings from localStorage
  const [aiProvider, setAiProviderState] = useState<'gemini' | 'ollama'>(() => {
    const saved = localStorage.getItem('memorize_ai_provider');
    return saved === 'ollama' ? 'ollama' : 'gemini';
  });

  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => {
    return localStorage.getItem('memorize_gemini_api_key') || '';
  });

  const [ollamaApiUrl, setOllamaApiUrlState] = useState<string>(() => {
    return localStorage.getItem('memorize_ollama_api_url') || 'http://localhost:11434';
  });

  const [ollamaModel, setOllamaModelState] = useState<string>(() => {
    return localStorage.getItem('memorize_ollama_model') || 'llama3.2';
  });

  // Sync to localStorage
  const setAiProvider = (provider: 'gemini' | 'ollama') => {
    setAiProviderState(provider);
    localStorage.setItem('memorize_ai_provider', provider);
  };

  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    localStorage.setItem('memorize_gemini_api_key', key);
  };

  const setOllamaApiUrl = (url: string) => {
    setOllamaApiUrlState(url);
    localStorage.setItem('memorize_ollama_api_url', url);
  };

  const setOllamaModel = (model: string) => {
    setOllamaModelState(model);
    localStorage.setItem('memorize_ollama_model', model);
  };

  // Instanciate the active AIService
  const aiService = useMemo<AIService>(() => {
    if (aiProvider === 'ollama') {
      return new OllamaProvider(ollamaApiUrl, ollamaModel);
    }
    return new GeminiProvider(geminiApiKey);
  }, [aiProvider, geminiApiKey, ollamaApiUrl, ollamaModel]);

  // Test active service connection
  const testConnection = async (): Promise<boolean> => {
    try {
      const result = await aiService.generateContent({
        messages: [{ role: 'user', content: 'Respond with the single word "active" if you receive this.' }],
      });
      return result.toLowerCase().includes('active');
    } catch (err) {
      console.error('AI Connection test failed:', err);
      throw err;
    }
  };

  return (
    <AIContext.Provider
      value={{
        aiService,
        aiProvider,
        setAiProvider,
        geminiApiKey,
        setGeminiApiKey,
        ollamaApiUrl,
        setOllamaApiUrl,
        ollamaModel,
        setOllamaModel,
        testConnection,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI deve ser utilizado dentro de um AIProvider');
  }
  return context;
}
