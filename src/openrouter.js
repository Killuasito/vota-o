// Configuração do OpenRouter API
// Sistema com fallback automático para múltiplos modelos gratuitos

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Modelos gratuitos disponíveis (em ordem de preferência)
const FREE_MODELS = [
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

export async function askAI(question, votesData) {
  // Verifica se a API key está configurada
  console.log("API Key presente:", OPENROUTER_API_KEY ? "Sim (primeiros chars: " + OPENROUTER_API_KEY.substring(0, 10) + "...)" : "Não");
  
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === "") {
    throw new Error("⚠️ API Key não configurada! Por favor, adicione sua chave do OpenRouter no arquivo .env\n\nPara obter uma chave:\n1. Acesse https://openrouter.ai/\n2. Faça login\n3. Vá em 'Keys'\n4. Crie uma nova chave\n5. Cole no arquivo .env");
  }

  // Prepara o contexto com os dados dos votos
  const votesContext = votesData
    .map((vote, index) => `${index + 1}. ${vote.name}: ${vote.value} votos`)
    .join("\n");

  const totalVotes = votesData.reduce((sum, vote) => sum + vote.value, 0);
  const totalParticipants = votesData.length;

  // Tenta cada modelo disponível
  let lastError = null;
  
  for (let i = 0; i < FREE_MODELS.length; i++) {
    const model = FREE_MODELS[i];
    console.log(`🤖 Tentativa ${i + 1}/${FREE_MODELS.length} - Modelo: ${model}`);
    
    try {
      const result = await tryAskAI(question, votesContext, totalVotes, totalParticipants, model);
      console.log("✅ Sucesso com modelo:", model);
      return result;
    } catch (error) {
      console.warn(`❌ Falha com modelo ${model}:`, error.message);
      lastError = error;
      
      // Se for erro 429 (rate limit), tenta o próximo modelo
      if (error.message.includes("429") || error.message.includes("Rate limit") || error.message.includes("Provider returned error")) {
        console.log("⏭️ Tentando próximo modelo...");
        continue;
      }
      
      // Para outros erros, lança imediatamente
      throw error;
    }
  }
  
  // Se todos os modelos falharam
  throw new Error("⏱️ Todos os modelos estão temporariamente indisponíveis (limite de uso atingido). Aguarde alguns minutos e tente novamente.");
}

async function tryAskAI(question, votesContext, totalVotes, totalParticipants, model) {
  const systemPrompt = `Você é um assistente especializado em análise de votação do Sarau. 

DADOS ATUAIS:
Total de participantes: ${totalParticipants}
Total de votos: ${totalVotes}

RANKING ATUAL:
${votesContext}

INSTRUÇÕES IMPORTANTES DE FORMATAÇÃO (SEGUIR RIGOROSAMENTE):
- NUNCA use asteriscos (**), hashtags (#), traços (-), ou qualquer markdown
- NUNCA use negrito, itálico ou outros estilos
- Use apenas texto simples e corrido
- Para destacar algo, use MAIÚSCULAS ou coloque entre aspas "assim"
- Para listas, use números seguidos de ponto e vírgula: 1. Nome; 2. Nome; etc.
- Separe informações com vírgulas, pontos ou ponto e vírgula
- Seja conversacional como se estivesse falando

INSTRUÇÕES DE CONTEÚDO:
- Responda em português de forma clara, direta e conversacional
- Seja conciso e objetivo
- Use números quando necessário (1º lugar, 2º lugar, etc.)
- Quando listar nomes, use formato simples: Nome (X votos)
- Mantenha um tom amigável e informal

ANÁLISE DE NOMES:
- Analise cuidadosamente os nomes da lista
- Identifique possíveis nomes duplicados ou similares (ex: "Thaina" e "Taina", "Daniela" e "Danielle" e "Danyella")
- Considere variações de grafia, abreviações e erros de digitação
- Ao identificar nomes similares, sugira a unificação e some os votos
- Exemplos de possíveis duplicatas: "Bea e Izabel" vs "Bia e Isabel", "Dançarina árabe" pode ser uma pessoa específica
- Se perguntado sobre o vencedor ou ranking, primeiro unifique os nomes similares antes de responder
- Seja detalhista e minucioso na análise dos nomes

EXEMPLOS DE FORMATAÇÃO CORRETA:
ERRADO: "**Sabrina**: 19 votos"
CORRETO: "Sabrina com 19 votos"

ERRADO: "1. **Nome** - descrição"
CORRETO: "1. Nome com descrição;"

ERRADO: "## Ranking"
CORRETO: "Ranking atualizado:"

ERRADO: "- item 1\n- item 2"
CORRETO: "Item 1, item 2"

Lembre-se: responda como se estivesse conversando, sem formatação especial alguma.`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.href,
      "X-Title": "Votação Sarau",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: question + "\n\nIMPORTANTE: Responda SEM usar markdown, asteriscos, hashtags ou formatação especial. Use apenas texto simples.",
        },
      ],
      temperature: 0.8,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Erro na API (${response.status})`;
    try {
      const errorData = await response.json();
      console.error("Detalhes do erro:", errorData);
      errorMessage = errorData.error?.message || errorData.message || errorMessage;
      
      // Se for erro 429, adiciona informação específica
      if (response.status === 429) {
        errorMessage = "Rate limit atingido para este modelo";
      }
    } catch (e) {
      console.error("Não foi possível parsear erro:", e);
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log("Resposta da API:", data);
  
  // Verifica se há erro na resposta mesmo com status 200
  if (data.error) {
    throw new Error(data.error.message || "Erro desconhecido na resposta");
  }
  
  // Verifica se há choices na resposta
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Resposta da API não contém choices");
  }
  
  return data.choices[0].message.content;
}

// Perguntas pré-definidas úteis
export const suggestedQuestions = [
  "Analise nomes duplicados ou similares e unifique os votos",
  "Quem é o verdadeiro vencedor após unificar nomes parecidos?",
  "Qual a diferença de votos entre o primeiro e segundo colocado?",
  "Quem está em terceiro lugar?",
  "Faça um resumo detalhado da votação atual",
  "Identifique possíveis erros de digitação nos nomes",
];
