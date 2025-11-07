// Configurações de segurança do projeto

// Rate limiting - limita quantidade de ações por usuário
export const RATE_LIMITS = {
  VOTE: {
    MAX_ATTEMPTS: 5, // máximo de tentativas de voto
    TIME_WINDOW: 60000, // em 1 minuto (ms)
  },
  AI_REQUESTS: {
    MAX_REQUESTS: 10, // máximo de perguntas à IA
    TIME_WINDOW: 300000, // em 5 minutos (ms)
  },
  ADMIN_LOGIN: {
    MAX_ATTEMPTS: 3, // máximo de tentativas de login
    TIME_WINDOW: 300000, // em 5 minutos (ms)
    LOCKOUT_TIME: 900000, // bloqueia por 15 minutos após exceder
  }
};

// Validação de inputs
export const INPUT_VALIDATION = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 50,
  ALLOWED_NAME_PATTERN: /^[a-záéíóúâêôãõçA-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+$/,
  MAX_QUESTION_LENGTH: 500,
};

// Sanitização de texto
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < e > para prevenir XSS
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers (onclick=, etc)
    .substring(0, 200); // Limita tamanho
}

// Validação de nome de votação
export function validateVoteName(name) {
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length < INPUT_VALIDATION.MIN_NAME_LENGTH) {
    return { valid: false, error: 'Nome muito curto (mínimo 2 caracteres)' };
  }
  
  if (sanitized.length > INPUT_VALIDATION.MAX_NAME_LENGTH) {
    return { valid: false, error: 'Nome muito longo (máximo 50 caracteres)' };
  }
  
  if (!INPUT_VALIDATION.ALLOWED_NAME_PATTERN.test(sanitized)) {
    return { valid: false, error: 'Nome contém caracteres inválidos' };
  }
  
  return { valid: true, sanitized };
}

// Rate limiter genérico
export class RateLimiter {
  constructor(maxAttempts, timeWindow, lockoutTime = 0) {
    this.maxAttempts = maxAttempts;
    this.timeWindow = timeWindow;
    this.lockoutTime = lockoutTime;
    this.storageKey = 'rate_limit_';
  }

  attempt(identifier) {
    const key = this.storageKey + identifier;
    const now = Date.now();
    
    // Verifica se está em lockout
    const lockoutKey = key + '_lockout';
    const lockoutUntil = parseInt(localStorage.getItem(lockoutKey) || '0');
    if (lockoutUntil > now) {
      const remainingMinutes = Math.ceil((lockoutUntil - now) / 60000);
      return {
        allowed: false,
        error: `Bloqueado temporariamente. Tente novamente em ${remainingMinutes} minuto(s).`
      };
    }

    // Recupera tentativas anteriores
    const attemptsData = localStorage.getItem(key);
    let attempts = attemptsData ? JSON.parse(attemptsData) : [];
    
    // Remove tentativas antigas
    attempts = attempts.filter(timestamp => now - timestamp < this.timeWindow);
    
    // Verifica se excedeu o limite
    if (attempts.length >= this.maxAttempts) {
      // Aplica lockout se configurado
      if (this.lockoutTime > 0) {
        localStorage.setItem(lockoutKey, (now + this.lockoutTime).toString());
        const lockoutMinutes = Math.ceil(this.lockoutTime / 60000);
        return {
          allowed: false,
          error: `Muitas tentativas! Bloqueado por ${lockoutMinutes} minutos.`
        };
      }
      
      const remainingSeconds = Math.ceil((attempts[0] + this.timeWindow - now) / 1000);
      return {
        allowed: false,
        error: `Limite de tentativas excedido. Aguarde ${remainingSeconds} segundos.`
      };
    }
    
    // Registra nova tentativa
    attempts.push(now);
    localStorage.setItem(key, JSON.stringify(attempts));
    
    return { 
      allowed: true, 
      remaining: this.maxAttempts - attempts.length 
    };
  }

  reset(identifier) {
    const key = this.storageKey + identifier;
    localStorage.removeItem(key);
    localStorage.removeItem(key + '_lockout');
  }
}

// Hash simples de senha (para uso no frontend - não é criptograficamente seguro)
// NOTA: Em produção, use autenticação real no backend
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verificação de força de senha
export function checkPasswordStrength(password) {
  const strength = {
    score: 0,
    feedback: []
  };

  if (password.length >= 8) strength.score++;
  else strength.feedback.push('Mínimo 8 caracteres');

  if (/[a-z]/.test(password)) strength.score++;
  else strength.feedback.push('Adicione letras minúsculas');

  if (/[A-Z]/.test(password)) strength.score++;
  else strength.feedback.push('Adicione letras maiúsculas');

  if (/[0-9]/.test(password)) strength.score++;
  else strength.feedback.push('Adicione números');

  if (/[^a-zA-Z0-9]/.test(password)) strength.score++;
  else strength.feedback.push('Adicione caracteres especiais');

  return strength;
}

// Proteção contra ataques de timing
export function constantTimeCompare(a, b) {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
