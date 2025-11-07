import React, { useState, useEffect } from "react";
import { askAI, suggestedQuestions } from "./openrouter";
import { BiBot, BiSend } from "react-icons/bi";
import { MdLightbulb, MdClear, MdExpandMore, MdDownload } from "react-icons/md";
import { RateLimiter, RATE_LIMITS } from "./security";

// Rate limiter para requisições da IA
const aiRateLimiter = new RateLimiter(RATE_LIMITS.AI_REQUESTS);

export default function AIAssistant({ votes }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatHistory, setChatHistory] = useState(() => {
    // Carrega histórico do localStorage ao iniciar
    const saved = localStorage.getItem("aiChatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [isOpen, setIsOpen] = useState(true);

  // Salva histórico no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem("aiChatHistory", JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleAsk = async (customQuestion = null) => {
    const questionToAsk = customQuestion || question;
    if (!questionToAsk.trim()) return;

    setLoading(true);
    setError("");
    
    // Verifica rate limit
    const rateLimitCheck = aiRateLimiter.attempt('ai_requests');
    if (!rateLimitCheck.allowed) {
      setError(`⏱️ ${rateLimitCheck.error}`);
      setLoading(false);
      return;
    }
    
    // Adiciona a pergunta ao histórico
    const userMessage = { role: "user", content: questionToAsk };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await askAI(questionToAsk, votes);
      
      // Adiciona a resposta ao histórico
      const aiMessage = { role: "assistant", content: response };
      setChatHistory(prev => [...prev, aiMessage]);
      
      setQuestion("");
    } catch (err) {
      let errorMsg = "Erro ao consultar IA: ";
      
      // Trata diferentes tipos de erro
      if (err.message.includes("API Key não configurada")) {
        errorMsg = "🔑 " + err.message;
      } else if (err.message.includes("Provider returned error")) {
        errorMsg = "⚠️ O modelo de IA está temporariamente indisponível. Tente novamente em alguns instantes ou use outro modelo.";
      } else if (err.message.includes("Rate limit") || err.message.includes("temporariamente indisponíveis")) {
        errorMsg = "⏱️ " + err.message;
      } else if (err.message.includes("conexão")) {
        errorMsg = "🌐 Erro de conexão. Verifique sua internet.";
      } else {
        errorMsg += err.message;
      }
      
      setError(errorMsg);
      console.error(err);
      // Remove a pergunta do histórico se houver erro
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (suggestedQ) => {
    handleAsk(suggestedQ);
  };

  const clearHistory = () => {
    if (!window.confirm("Tem certeza que deseja limpar todo o histórico de conversas?")) return;
    setChatHistory([]);
    setError("");
    localStorage.removeItem("aiChatHistory");
  };

  const exportHistory = () => {
    if (chatHistory.length === 0) {
      alert("Não há histórico para exportar!");
      return;
    }
    
    const historyText = chatHistory.map((msg, index) => {
      const role = msg.role === "user" ? "VOCÊ" : "IA";
      return `[${role}]: ${msg.content}`;
    }).join("\n\n");
    
    const blob = new Blob([historyText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-ia-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Função para formatar o texto da IA com estilização rica
  const formatAIResponse = (text) => {
    // Divide o texto em linhas
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Detecta listas numeradas (1. Item, 2. Item, etc.)
      const numberedListMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numberedListMatch) {
        return (
          <div key={lineIndex} className="flex gap-2 my-1.5 pl-2">
            <span className="text-purple-400 font-bold min-w-[28px] text-base">{numberedListMatch[1]}.</span>
            <span className="flex-1">{formatInlineText(numberedListMatch[2])}</span>
          </div>
        );
      }

      // Detecta subtítulos/títulos (linhas que terminam com :)
      if (line.trim().endsWith(':') && line.trim().length < 60 && !line.includes('http')) {
        return (
          <div key={lineIndex} className="font-bold text-purple-300 mt-4 mb-2 text-base">
            {line}
          </div>
        );
      }

      // Detecta separadores (linhas com ---, ===, etc.)
      if (/^[-=]{3,}$/.test(line.trim())) {
        return <div key={lineIndex} className="border-t border-purple-500/30 my-3" />;
      }

      // Linha vazia
      if (line.trim() === '') {
        return <div key={lineIndex} className="h-2" />;
      }

      // Linha normal
      return (
        <div key={lineIndex} className="my-0.5 leading-relaxed">
          {formatInlineText(line)}
        </div>
      );
    });
  };

  // Função para formatar texto inline (números, nomes, destaques)
  const formatInlineText = (text) => {
    // Lista de padrões para destacar
    const patterns = [
      // Números com contexto: "19 votos", "1º lugar", "3 pontos"
      { 
        regex: /(\d+)\s*(voto[s]?|lugar(?:es)?|ponto[s]?|º|ª|colocad[oa][s]?)/gi,
        className: 'text-blue-300 font-semibold px-1 bg-blue-500/10 rounded'
      },
      // Nomes próprios com informação: "Sabrina (19 votos)"
      {
        regex: /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:e|de|da|do)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)*)\s+com\s+(\d+\s+voto[s]?)/gi,
        className: 'text-green-300 font-semibold'
      },
      // Destaque para palavras-chave
      {
        regex: /\b(vencedor[a]?|primeiro lugar|segundo lugar|terceiro lugar|ranking|total|soma|unificad[oa][s]?)\b/gi,
        className: 'text-yellow-300 font-semibold'
      }
    ];

    let result = [text];
    
    // Aplica cada padrão
    patterns.forEach((pattern, patternIndex) => {
      const newResult = [];
      
      result.forEach((part, partIndex) => {
        if (typeof part !== 'string') {
          newResult.push(part);
          return;
        }

        const matches = [];
        let match;
        const regex = new RegExp(pattern.regex);
        
        while ((match = regex.exec(part)) !== null) {
          matches.push({
            index: match.index,
            length: match[0].length,
            text: match[0]
          });
        }

        if (matches.length === 0) {
          newResult.push(part);
          return;
        }

        let lastIndex = 0;
        matches.forEach((m, matchIndex) => {
          // Texto antes do match
          if (m.index > lastIndex) {
            newResult.push(part.substring(lastIndex, m.index));
          }
          
          // Match destacado
          newResult.push(
            <span 
              key={`${patternIndex}-${partIndex}-${matchIndex}`} 
              className={pattern.className}
            >
              {m.text}
            </span>
          );
          
          lastIndex = m.index + m.length;
        });

        // Texto restante
        if (lastIndex < part.length) {
          newResult.push(part.substring(lastIndex));
        }
      });
      
      result = newResult;
    });
    
    return <>{result}</>;
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl shadow-lg border border-purple-500/30 backdrop-blur-sm overflow-hidden">
      {/* Header - Sempre visível e clicável */}
      <div 
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/5 transition-all duration-300 select-none active:scale-[0.99]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 bg-purple-500/20 rounded-lg transition-transform duration-500 ${loading ? 'animate-pulse' : ''}`}>
            <BiBot className="text-3xl text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white transition-all duration-300">Assistente IA</h2>
            <p className="text-sm text-neutral-400 transition-all duration-300">
              {isOpen 
                ? chatHistory.length > 0 
                  ? `${chatHistory.length} mensagem${chatHistory.length !== 1 ? 's' : ''} no histórico`
                  : "Análise inteligente dos votos"
                : "Clique para expandir"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {chatHistory.length > 0 && isOpen && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  exportHistory();
                }}
                className="p-2 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400 hover:text-white"
                title="Exportar histórico"
              >
                <MdDownload className="text-xl" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearHistory();
                }}
                className="p-2 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400 hover:text-white"
                title="Limpar histórico"
              >
                <MdClear className="text-xl" />
              </button>
            </>
          )}
          <div className={`p-2 text-neutral-400 transition-all duration-500 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            <MdExpandMore className="text-2xl" />
          </div>
        </div>
      </div>

      {/* Conteúdo - Colapsável com animação */}
      <div 
        className={`grid transition-all duration-500 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 space-y-4">
          {/* Perguntas sugeridas */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MdLightbulb className="text-yellow-400 text-lg" />
              <span className="text-sm font-medium text-neutral-300">Perguntas sugeridas:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((sq, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(sq)}
                  disabled={loading}
                  className="text-xs bg-neutral-800 hover:bg-purple-600/30 text-neutral-300 hover:text-white px-3 py-2 rounded-lg border border-neutral-700 hover:border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>

          {/* Histórico de chat */}
          {chatHistory.length > 0 && (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl animate-fadeIn ${
                    msg.role === "user"
                      ? "bg-blue-600/20 ml-8 border border-blue-500/30"
                      : "bg-neutral-800/50 mr-8 border border-purple-500/30"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start gap-3">
                    {msg.role === "assistant" && (
                      <div className="p-1.5 bg-purple-500/20 rounded-lg flex-shrink-0">
                        <BiBot className="text-purple-400 text-lg" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {msg.role === "user" ? (
                        <p className="text-blue-100 font-medium text-sm leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <div className="text-neutral-200 text-sm leading-relaxed">
                          {formatAIResponse(msg.content)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="bg-neutral-800/50 mr-8 border border-purple-500/30 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg">
                      <BiBot className="text-purple-400 text-lg animate-pulse" />
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Campo de pergunta */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !loading && handleAsk()}
                  placeholder="Faça uma pergunta sobre a votação..."
                  disabled={loading}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>
              <button
                onClick={() => handleAsk()}
                disabled={loading || !question.trim()}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-5 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[56px] shadow-lg shadow-purple-500/20"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <BiSend className="text-xl" />
                )}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-start gap-2">
              <span className="text-red-400">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Info */}
          <div className="space-y-1">
            <div className="text-xs text-neutral-500 italic flex items-center gap-1">
              <MdLightbulb className="text-yellow-400 text-lg" />
              <span>Usando modelos gratuitos via OpenRouter (Llama, Gemma, Mistral)</span>
            </div>
            {chatHistory.length > 0 && (
              <div className="text-xs text-green-400/70 flex items-center gap-1">
                <span>💾</span>
                <span>Histórico salvo automaticamente</span>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Grid rows animation - muito mais suave */
        .grid {
          display: grid;
        }
        
        .grid-rows-\[0fr\] {
          grid-template-rows: 0fr;
        }
        
        .grid-rows-\[1fr\] {
          grid-template-rows: 1fr;
        }
        
        /* Scrollbar customizada */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 3px;
          transition: background 0.2s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
        
        /* Animação de fade in para mensagens */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        /* Animação de bounce suave para loading dots */
        @keyframes smoothBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}
