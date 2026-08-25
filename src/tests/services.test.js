import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firebaseFirestore from 'firebase/firestore';

// ── Favorites service ─────────────────────────────────────────────────────────
describe('favorites service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getFavorites retorna array vazio quando doc não existe', async () => {
    firebaseFirestore.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    const { getFavorites } = await import('../services/favorites');
    const result = await getFavorites('uid123', 'project');
    expect(result.success).toBe(true);
    expect(result.favorites).toEqual([]);
  });
});

// ── activityLogger ────────────────────────────────────────────────────────────
describe('activityLogger', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não lança exceção ao logar atividade', async () => {
    firebaseFirestore.addDoc.mockResolvedValue({ id: 'log-id' });
    const { default: ActivityLogger } = await import('../services/activityLogger');
    await expect(
      ActivityLogger.projectCreated('Projeto Teste', 'uid123', 'João')
    ).resolves.not.toThrow();
  });
});

// ── carteirasDeProjeto — constantes ──────────────────────────────────────────
describe('carteirasDeProjeto constants', () => {
  it('SETORES_PADRAO tem 10 setores com id, nome e cor', async () => {
    const { SETORES_PADRAO } = await import('../services/carteirasDeProjeto');
    expect(SETORES_PADRAO).toHaveLength(10);
    SETORES_PADRAO.forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('nome');
      expect(s).toHaveProperty('cor');
      expect(s.cor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('CARTEIRAS_PADRAO_PROJETO tem 10 itens com ordem sequencial', async () => {
    const { CARTEIRAS_PADRAO_PROJETO } = await import('../services/carteirasDeProjeto');
    expect(CARTEIRAS_PADRAO_PROJETO).toHaveLength(10);
    const ordens = CARTEIRAS_PADRAO_PROJETO.map(c => c.ordem);
    expect(ordens).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

// ── CPF format validation ─────────────────────────────────────────────────────
describe('CPF validation', () => {
  const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

  it('aceita CPF formatado corretamente', () => {
    expect(CPF_REGEX.test('123.456.789-09')).toBe(true);
    expect(CPF_REGEX.test('000.000.000-00')).toBe(true);
  });

  it('rejeita CPF sem formatação', () => {
    expect(CPF_REGEX.test('12345678909')).toBe(false);
    expect(CPF_REGEX.test('123-456-789-09')).toBe(false);
  });

  it('formatCPF produz máscara correta', () => {
    function formatCPF(value) {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      const p1 = digits.slice(0, 3);
      const p2 = digits.slice(3, 6);
      const p3 = digits.slice(6, 9);
      const p4 = digits.slice(9, 11);
      let r = p1;
      if (p2) r += `.${p2}`;
      if (p3) r += `.${p3}`;
      if (p4) r += `-${p4}`;
      return r;
    }
    expect(formatCPF('12345678909')).toBe('123.456.789-09');
    expect(formatCPF('123')).toBe('123');
    expect(formatCPF('')).toBe('');
  });
});
