# 🔒 Guia de Segurança - Sistema de Votação

## 📋 Visão Geral

Este documento descreve as medidas de segurança implementadas no sistema de votação e fornece orientações para manter a aplicação segura.

## 🛡️ Proteções Implementadas

### 1. Rate Limiting (Limitação de Taxa)

O sistema implementa rate limiting para prevenir abuso e ataques de força bruta:

#### Votações
- **Limite**: 5 votos por minuto
- **Período de bloqueio**: 1 minuto
- **Mensagem**: "Muitos votos muito rápido! Aguarde 1 minuto."

#### Requisições da IA
- **Limite**: 10 requisições a cada 5 minutos
- **Período de bloqueio**: 5 minutos
- **Mensagem**: "Muitas perguntas muito rápido! Aguarde X minuto(s)."

#### Login do Admin
- **Limite**: 3 tentativas a cada 5 minutos
- **Período de bloqueio**: 15 minutos
- **Mensagem**: "Muitas tentativas de login! Aguarde X minuto(s)."

### 2. Validação e Sanitização de Entrada

Todas as entradas de usuário são validadas e sanitizadas:

#### Validação de Nomes
- Tamanho mínimo: 2 caracteres
- Tamanho máximo: 50 caracteres
- Caracteres permitidos: letras, números, espaços, acentos e pontuação básica
- Rejeita: URLs, tags HTML, scripts

#### Sanitização
- Remove caracteres perigosos: `<`, `>`, `{`, `}`
- Remove tentativas de injeção: `javascript:`, `data:`, `vbscript:`
- Remove event handlers: `onclick`, `onerror`, `onload`, etc.

### 3. Autenticação do Admin

#### Hash de Senha
- **Algoritmo**: SHA-256
- **Comparação**: Tempo constante (protege contra timing attacks)
- **Senha padrão**: `123456` (hash: `8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92`)

⚠️ **IMPORTANTE**: Altere a senha padrão imediatamente em produção!

### 4. Content Security Policy (CSP)

Headers de segurança configurados no `index.html`:

```html
Content-Security-Policy:
  - default-src 'self'
  - script-src 'self' 'unsafe-inline' 'unsafe-eval'
  - style-src 'self' 'unsafe-inline'
  - connect-src 'self' https://*.firebaseio.com https://openrouter.ai
  - frame-ancestors 'none'
  - base-uri 'self'
  - form-action 'self'

Proteções Adicionais:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
```

## 🔑 Como Alterar a Senha do Admin

### Método 1: Gerar novo hash manualmente

1. Abra o console do navegador (F12)
2. Execute este código com sua nova senha:

```javascript
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Substitua "MINHA_SENHA_SEGURA" pela sua senha
hashPassword("MINHA_SENHA_SEGURA").then(hash => console.log("Hash:", hash));
```

3. Copie o hash gerado
4. Abra `src/Admin.jsx`
5. Substitua o valor de `ADMIN_PASSWORD_HASH`:

```javascript
const ADMIN_PASSWORD_HASH = "SEU_NOVO_HASH_AQUI";
```

### Método 2: Usar a função do sistema

1. Abra `src/security.js`
2. Temporariamente adicione ao final do arquivo:

```javascript
// REMOVER APÓS GERAR O HASH!
hashPassword("MINHA_SENHA_SEGURA").then(console.log);
```

3. Execute o projeto e verifique o console
4. Copie o hash e atualize `Admin.jsx`
5. **IMPORTANTE**: Remova o código temporário!

## 🔐 Boas Práticas de Segurança

### Para Desenvolvimento

1. **Nunca commit credenciais**: Use `.env` para chaves de API
2. **Mantenha dependências atualizadas**: Execute `npm audit` regularmente
3. **Teste a sanitização**: Tente inserir `<script>alert('xss')</script>` nos inputs
4. **Verifique rate limits**: Faça múltiplas requisições rápidas para testar

### Para Produção

1. **Altere a senha admin imediatamente**
2. **Configure HTTPS**: Nunca use HTTP em produção
3. **Regras do Firebase**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /votes/{document=**} {
         allow read: if true;
         allow write: if request.time > timestamp.date(2024, 1, 1);
         allow delete: if request.auth != null; // Requer autenticação
       }
     }
   }
   ```

4. **Monitore logs**: Verifique tentativas de login falhadas
5. **Backup regular**: Configure backup automático do Firestore
6. **Variáveis de ambiente**: Nunca exponha chaves de API no código

## 🚨 Como Reportar Vulnerabilidades

Se você encontrar uma vulnerabilidade de segurança:

1. **NÃO crie uma issue pública**
2. Entre em contato diretamente com o desenvolvedor
3. Forneça detalhes:
   - Descrição da vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Sugestão de correção (se possível)

## 📊 Limitações Conhecidas

### Navegador como Cliente
- Rate limiting é baseado em localStorage (pode ser limpo)
- Hash de senha ocorre no cliente (visível no código-fonte)
- **Recomendação**: Para produção séria, implemente autenticação no backend

### Firebase Security Rules
- Atualmente permite leitura pública dos votos
- Deletar requer apenas autenticação básica
- **Recomendação**: Implemente roles de usuário no Firebase

### API Keys
- Chave do OpenRouter exposta no cliente
- **Recomendação**: Use um proxy backend para chamadas de API

## 🔄 Próximos Passos de Segurança

Para tornar o sistema ainda mais seguro:

1. **Backend com autenticação real**:
   - Node.js/Express ou Firebase Functions
   - JWT para sessões
   - Bcrypt para senhas (mais seguro que SHA-256)

2. **Firebase Authentication**:
   - Substituir senha hardcoded
   - Usar Google/Email authentication
   - Roles e permissões granulares

3. **Rate Limiting no Servidor**:
   - Implementar no Firebase Functions
   - IP-based limiting
   - CAPTCHA para proteção adicional

4. **Auditoria e Logs**:
   - Registrar tentativas de login
   - Monitorar padrões suspeitos
   - Alertas automáticos

## 📚 Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Web Security Best Practices](https://web.dev/security/)

---

**Última atualização**: 2024
**Versão do documento**: 1.0
