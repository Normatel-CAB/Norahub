/**
 * Security Middleware para Cloud Functions
 * Implementa rate limiting, validação e logging de segurança
 */

const admin = require('firebase-admin');

/**
 * Rate Limiter usando Firestore
 * Previne ataques de força bruta e DDoS
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minuto padrão
    this.maxRequests = options.maxRequests || 100;
    this.keyGenerator = options.keyGenerator || ((context) => context.auth?.uid || 'anonymous');
    this.collection = options.collection || 'rate_limits';
  }

  async check(context) {
    const key = this.keyGenerator(context);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const db = admin.firestore();
    const docRef = db.collection(this.collection).doc(key);
    
    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        let requests = [];
        if (doc.exists) {
          requests = doc.data().requests || [];
        }
        
        // Remover requisições antigas
        requests = requests.filter(timestamp => timestamp > windowStart);
        
        // Verificar limite
        if (requests.length >= this.maxRequests) {
          return { allowed: false, retryAfter: Math.ceil((requests[0] - windowStart) / 1000) };
        }
        
        // Adicionar nova requisição
        requests.push(now);
        
        transaction.set(docRef, { 
          requests, 
          lastUpdate: admin.firestore.FieldValue.serverTimestamp() 
        }, { merge: true });
        
        return { allowed: true, remaining: this.maxRequests - requests.length };
      });
      
      if (!result.allowed) {
        const error = new Error('Rate limit exceeded');
        error.code = 'resource-exhausted';
        error.retryAfter = result.retryAfter;
        throw error;
      }
      
      return result;
    } catch (error) {
      if (error.code === 'resource-exhausted') {
        throw error;
      }
      // Em caso de erro no rate limiter, permitir (fail-open)
      console.error('Rate limiter error:', error);
      return { allowed: true, remaining: this.maxRequests };
    }
  }

  middleware(options = {}) {
    const limiter = new RateLimiter({ ...this, ...options });
    return async (context) => {
      const result = await limiter.check(context);
      if (!result.allowed) {
        const error = new Error(`Too many requests. Try again in ${result.retryAfter} seconds`);
        error.code = 'resource-exhausted';
        throw error;
      }
      return result;
    };
  }
}

/**
 * Validador de entrada
 * Previne SQL injection, XSS e outros ataques
 */
class InputValidator {
  static sanitizeString(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  // Remove vetores de script de HTML permitido em corpos de e-mail
  static sanitizeHtml(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '');
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase().trim();
  }

  static validateUid(uid) {
    if (typeof uid !== 'string' || uid.length === 0 || uid.length > 128) {
      throw new Error('Invalid UID');
    }
    // Apenas alfanuméricos e alguns caracteres especiais
    if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
      throw new Error('Invalid UID format');
    }
    return uid;
  }

  static sanitizeObject(obj, schema = {}) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const schemaType = schema[key];
      
      if (schemaType === 'email') {
        sanitized[key] = this.validateEmail(value);
      } else if (schemaType === 'uid') {
        sanitized[key] = this.validateUid(value);
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeString(item) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  static requireFields(data, fields) {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}

/**
 * Logger de segurança
 * Registra eventos de segurança para auditoria
 */
class SecurityLogger {
  static async log(event) {
    const db = admin.firestore();
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: event.type,
      severity: event.severity || 'info',
      userId: event.userId || null,
      ip: event.ip || null,
      userAgent: event.userAgent || null,
      action: event.action,
      details: event.details || {},
      success: event.success !== false
    };

    try {
      await db.collection('security_logs').add(logEntry);
      
      // Se for crítico, também logar no console
      if (event.severity === 'critical' || event.severity === 'high') {
        console.warn('Security Event:', logEntry);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  static async logAuthAttempt(context, success, details = {}) {
    await this.log({
      type: 'authentication',
      severity: success ? 'info' : 'warning',
      userId: context.auth?.uid,
      action: 'login_attempt',
      success,
      details
    });
  }

  static async logUnauthorizedAccess(context, resource) {
    await this.log({
      type: 'authorization',
      severity: 'high',
      userId: context.auth?.uid,
      action: 'unauthorized_access',
      success: false,
      details: { resource }
    });
  }

  static async logSuspiciousActivity(context, description) {
    await this.log({
      type: 'suspicious_activity',
      severity: 'critical',
      userId: context.auth?.uid,
      action: 'suspicious_behavior',
      success: false,
      details: { description }
    });
  }
}

/**
 * Verificador de permissões
 */
class PermissionChecker {
  static async requireAdmin(context) {
    if (!context.auth) {
      await SecurityLogger.logUnauthorizedAccess(context, 'admin_function');
      throw new Error('unauthenticated: User not authenticated');
    }

    const db = admin.firestore();
    const userDoc = await db.collection('usuarios').doc(context.auth.uid).get();
    
    if (!userDoc.exists || userDoc.data().funcao !== 'admin') {
      await SecurityLogger.logUnauthorizedAccess(context, 'admin_function');
      throw new Error('permission-denied: Admin access required');
    }

    return userDoc.data();
  }

  static async requireAuth(context) {
    if (!context.auth) {
      await SecurityLogger.logUnauthorizedAccess(context, 'authenticated_function');
      throw new Error('unauthenticated: User not authenticated');
    }

    const db = admin.firestore();
    const userDoc = await db.collection('usuarios').doc(context.auth.uid).get();
    
    if (!userDoc.exists) {
      await SecurityLogger.logUnauthorizedAccess(context, 'authenticated_function');
      throw new Error('permission-denied: User not found');
    }

    return userDoc.data();
  }

  static async requireRole(context, allowedRoles) {
    const user = await this.requireAuth(context);
    
    if (!allowedRoles.includes(user.funcao)) {
      await SecurityLogger.logUnauthorizedAccess(context, `role_${allowedRoles.join('_or_')}`);
      throw new Error(`permission-denied: Required role: ${allowedRoles.join(' or ')}`);
    }

    return user;
  }
}

/**
 * Wrapper de segurança para Cloud Functions
 */
function secureFunction(handler, options = {}) {
  const rateLimiter = options.rateLimit ? new RateLimiter(options.rateLimit) : null;
  
  return async (data, context) => {
    const startTime = Date.now();
    
    try {
      // Rate limiting
      if (rateLimiter) {
        await rateLimiter.check(context);
      }

      // Validação de entrada
      if (options.validate) {
        InputValidator.requireFields(data, options.validate.required || []);
        data = InputValidator.sanitizeObject(data, options.validate.schema || {});
      }

      // Verificação de permissões
      if (options.requireAdmin) {
        await PermissionChecker.requireAdmin(context);
      } else if (options.requireAuth) {
        await PermissionChecker.requireAuth(context);
      } else if (options.requireRole) {
        await PermissionChecker.requireRole(context, options.requireRole);
      }

      // Executar função
      const result = await handler(data, context);
      
      // Log de sucesso
      if (options.logAccess) {
        await SecurityLogger.log({
          type: 'function_call',
          severity: 'info',
          userId: context.auth?.uid,
          action: options.functionName || 'unknown',
          success: true,
          details: { executionTime: Date.now() - startTime }
        });
      }

      return result;
    } catch (error) {
      // Log de erro
      await SecurityLogger.log({
        type: 'function_error',
        severity: error.code === 'permission-denied' ? 'warning' : 'error',
        userId: context.auth?.uid,
        action: options.functionName || 'unknown',
        success: false,
        details: { 
          error: error.message,
          code: error.code,
          executionTime: Date.now() - startTime
        }
      });

      throw error;
    }
  };
}

module.exports = {
  RateLimiter,
  InputValidator,
  SecurityLogger,
  PermissionChecker,
  secureFunction
};
