# 🔐 Melhorias de Segurança - API Keys e Firebase

## 📋 Problemas Atuais

### 1. Chaves de API Expostas
- ❌ Chave do OpenRouter visível no código do cliente
- ❌ Configuração do Firebase exposta no navegador
- ❌ Qualquer pessoa com acesso ao código pode copiar as chaves
- ❌ Sem controle de uso por usuário

### 2. Limitações do Frontend
- Rate limiting baseado em localStorage (pode ser contornado)
- Sem autenticação real de usuários
- Sem logs centralizados de uso

## ✅ Soluções Implementáveis

### **NÍVEL 1: Melhorias Rápidas (Sem Backend)**

#### 1.1. Firebase Security Rules Aprimoradas

Atualize as regras do Firestore para serem mais restritivas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /votes/{voteId} {
      // Leitura pública permitida
      allow read: if true;
      
      // Escrita com validação
      allow create: if request.resource.data.name is string 
                    && request.resource.data.name.size() >= 2 
                    && request.resource.data.name.size() <= 50
                    && request.resource.data.value is number
                    && request.resource.data.value >= 0;
      
      // Atualização apenas incrementando votos
      allow update: if request.resource.data.value == resource.data.value + 1
                    || request.auth != null; // Admin autenticado
      
      // Deletar apenas com autenticação
      allow delete: if request.auth != null;
    }
  }
}
```

#### 1.2. Domínios Autorizados no Firebase

1. Vá em Firebase Console → Authentication → Settings
2. Em "Authorized domains", adicione apenas seus domínios:
   - `localhost` (dev)
   - `seu-dominio.com` (produção)
3. Isso impede que outros sites usem sua configuração

#### 1.3. Restrições de API Key do Firebase

1. Acesse Google Cloud Console
2. Vá em "APIs & Services" → "Credentials"
3. Encontre sua API Key do Firebase
4. Adicione restrições:
   - **Application restrictions**: HTTP referrers
   - Adicione: `localhost/*` e `seu-dominio.com/*`
   - **API restrictions**: Apenas Firebase APIs necessárias

#### 1.4. OpenRouter: Limites de Uso

1. No dashboard do OpenRouter (https://openrouter.ai/keys)
2. Configure limites na sua chave:
   - **Credit limits**: Defina máximo de gasto
   - **Rate limits**: Limite requisições por minuto
3. Isso evita abuso se a chave vazar

---

### **NÍVEL 2: Backend Proxy (RECOMENDADO para Produção)**

Crie um backend Node.js/Express que intermedie as chamadas:

#### 2.1. Estrutura do Backend

```
votacao-backend/
├── server.js
├── routes/
│   ├── ai.js
│   └── votes.js
├── middleware/
│   ├── auth.js
│   └── rateLimiter.js
├── .env (chaves aqui, nunca commitadas)
└── package.json
```

#### 2.2. Exemplo de Implementação

**package.json**
```json
{
  "name": "votacao-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "firebase-admin": "^12.0.0"
  }
}
```

**server.js**
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Segurança
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'https://seu-dominio.com'],
  credentials: true
}));
app.use(express.json());

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: 'Muitas requisições deste IP'
});
app.use(globalLimiter);

// Rotas
app.use('/api/ai', require('./routes/ai'));
app.use('/api/votes', require('./routes/votes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
```

**routes/ai.js**
```javascript
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limit específico para IA
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 requisições
  message: 'Muitas perguntas para a IA. Aguarde.'
});

router.post('/ask', aiLimiter, async (req, res) => {
  try {
    const { question, votes } = req.body;
    
    // Validação
    if (!question || question.length < 3 || question.length > 500) {
      return res.status(400).json({ error: 'Pergunta inválida' });
    }

    // Chama OpenRouter usando a chave do servidor
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de análise de votações...'
          },
          {
            role: 'user',
            content: `${question}\n\nVotos: ${JSON.stringify(votes)}`
          }
        ]
      })
    });

    const data = await response.json();
    res.json({ answer: data.choices[0].message.content });
    
  } catch (error) {
    console.error('Erro na IA:', error);
    res.status(500).json({ error: 'Erro ao processar pergunta' });
  }
});

module.exports = router;
```

**Atualização no Frontend (src/openrouter.js)**
```javascript
export async function askAI(question, votes) {
  try {
    // Agora chama seu backend ao invés do OpenRouter direto
    const response = await fetch('http://localhost:3000/api/ai/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ question, votes })
    });

    if (!response.ok) {
      throw new Error('Erro na requisição');
    }

    const data = await response.json();
    return data.answer;
  } catch (error) {
    throw new Error('Erro ao consultar IA: ' + error.message);
  }
}
```

---

### **NÍVEL 3: Firebase Functions (Serverless)**

Alternativa ao backend completo, use Firebase Functions:

#### 3.1. Configuração

```bash
npm install -g firebase-tools
firebase init functions
```

#### 3.2. functions/index.js

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Cloud Function para chamadas de IA
exports.askAI = functions.https.onCall(async (data, context) => {
  // Rate limiting por IP
  const ip = context.rawRequest.ip;
  const rateLimitRef = admin.firestore()
    .collection('rateLimits')
    .doc(ip);
    
  const rateLimitDoc = await rateLimitRef.get();
  const now = Date.now();
  
  if (rateLimitDoc.exists) {
    const { requests, resetTime } = rateLimitDoc.data();
    
    if (now < resetTime && requests >= 10) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Muitas requisições. Aguarde.'
      );
    }
    
    if (now >= resetTime) {
      await rateLimitRef.set({
        requests: 1,
        resetTime: now + (5 * 60 * 1000)
      });
    } else {
      await rateLimitRef.update({
        requests: admin.firestore.FieldValue.increment(1)
      });
    }
  } else {
    await rateLimitRef.set({
      requests: 1,
      resetTime: now + (5 * 60 * 1000)
    });
  }

  // Chama OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${functions.config().openrouter.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      messages: data.messages
    })
  });

  const result = await response.json();
  return { answer: result.choices[0].message.content };
});
```

#### 3.3. Configurar chave (sem expor)

```bash
firebase functions:config:set openrouter.key="sua-chave-aqui"
```

#### 3.4. Frontend atualizado

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const askAIFunction = httpsCallable(functions, 'askAI');

export async function askAI(question, votes) {
  try {
    const result = await askAIFunction({ 
      messages: [/* ... */],
      votes 
    });
    return result.data.answer;
  } catch (error) {
    throw new Error(error.message);
  }
}
```

---

## 📊 Comparação de Abordagens

| Abordagem | Segurança | Custo | Complexidade | Recomendação |
|-----------|-----------|-------|--------------|--------------|
| **Apenas Frontend** | ⭐⭐ | Grátis | Baixa | ❌ Não para produção |
| **Firebase Rules** | ⭐⭐⭐ | Grátis | Baixa | ✅ Mínimo aceitável |
| **Backend Proxy** | ⭐⭐⭐⭐⭐ | Baixo | Média | ✅✅ Melhor opção |
| **Firebase Functions** | ⭐⭐⭐⭐ | Grátis-Baixo | Média | ✅ Boa alternativa |

---

## 🚀 Plano de Implementação Recomendado

### Curto Prazo (Hoje)
1. ✅ Implementar Firebase Security Rules mais restritivas
2. ✅ Adicionar restrições de domínio no Firebase Console
3. ✅ Configurar limites de uso no OpenRouter

### Médio Prazo (Esta Semana)
1. 🔄 Criar Firebase Functions para chamadas de IA
2. 🔄 Implementar Firebase Authentication
3. 🔄 Adicionar roles (admin, user) no Firestore

### Longo Prazo (Próximo Mês)
1. 📅 Backend completo com Express
2. 📅 Sistema de autenticação JWT
3. 📅 Dashboard de monitoramento
4. 📅 Logs e analytics centralizados

---

## 🔍 Monitoramento e Detecção

### Firebase Analytics
```javascript
// Adicione no firebase.js
import { getAnalytics } from "firebase/analytics";
export const analytics = getAnalytics(app);

// Use em eventos importantes
import { logEvent } from "firebase/analytics";
logEvent(analytics, 'vote_submitted', { name: voteName });
```

### Logs de Acesso
- Firebase Console → Firestore → Usage
- OpenRouter Dashboard → Usage logs
- Monitore padrões suspeitos (muitas requisições, IPs estranhos)

---

## 📚 Recursos Adicionais

- [Firebase Security Rules Guide](https://firebase.google.com/docs/rules)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)

---

**Quer que eu implemente alguma dessas soluções agora?**
