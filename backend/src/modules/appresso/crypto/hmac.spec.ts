import * as crypto from 'crypto';
import {
  canonicalize,
  computeHmac,
  verifyHmac,
  HmacPayload,
} from './hmac';

describe('HMAC & Canonicalization (A1.1)', () => {
  const SECRET = 'test-secret-key-123';

  describe('canonicalize', () => {
    it('ordena las claves lexicográficamente ascendente (deep-sort)', () => {
      const obj = {
        z: 1,
        a: 2,
        m: {
          b: 'nested-b',
          a: 'nested-a',
        },
      };

      const result = canonicalize(obj);
      expect(result).toBe('{"a":2,"m":{"a":"nested-a","b":"nested-b"},"z":1}');
    });

    it('produce formato JSON compacto sin espacios extras', () => {
      const payload = {
        idTxn: 'TX-100',
        value: 15000,
        currency: 'COP',
      };
      const result = canonicalize(payload);
      expect(result).toBe('{"currency":"COP","idTxn":"TX-100","value":15000}');
      expect(result).not.toContain(' ');
    });

    it('maneja arrays conservando el orden de elementos', () => {
      const arr = [3, 1, 2];
      expect(canonicalize(arr)).toBe('[3,1,2]');
    });
  });

  describe('computeHmac & verifyHmac', () => {
    const validTransaction: HmacPayload = {
      idTxn: 'txn-abc-123',
      user: 'user-001',
      value: 250000, // 2500.00 COP en centavos
      currency: 'COP',
      paymentMethod: 'CREDIT_CARD',
      date: '2026-09-23T10:30:01.120Z',
    };

    it('calcula HMAC-SHA-256 consistente sobre los campos firmados', () => {
      const hmac1 = computeHmac(validTransaction, SECRET);
      const hmac2 = computeHmac(validTransaction, SECRET);

      expect(hmac1).toBe(hmac2);
      expect(hmac1).toMatch(/^[a-f0-9]{64}$/i);
    });

    it('verifica una firma válida exitosamente', () => {
      const signature = computeHmac(validTransaction, SECRET);
      const isValid = verifyHmac(validTransaction, signature, SECRET);

      expect(isValid).toBe(true);
    });

    it('excluye campos no firmados como hash y receivedAt', () => {
      const signature = computeHmac(validTransaction, SECRET);

      const payloadWithExtras = {
        ...validTransaction,
        hash: signature,
        receivedAt: 1727087401120,
      };

      const isValid = verifyHmac(payloadWithExtras, signature, SECRET);
      expect(isValid).toBe(true);
    });

    it('rechaza si un campo firmado fue alterado (integridad)', () => {
      const signature = computeHmac(validTransaction, SECRET);

      const tampered = {
        ...validTransaction,
        value: 999999, // valor alterado
      };

      const isValid = verifyHmac(tampered, signature, SECRET);
      expect(isValid).toBe(false);
    });

    it('rechaza si la firma tiene longitud incorrecta o caracteres inválidos de forma segura', () => {
      expect(verifyHmac(validTransaction, 'invalid-short-hash', SECRET)).toBe(false);
      expect(verifyHmac(validTransaction, '', SECRET)).toBe(false);
      expect(verifyHmac(validTransaction, 'g'.repeat(64), SECRET)).toBe(false);
    });

    it('rechaza si se usa un secreto incorrecto', () => {
      const signature = computeHmac(validTransaction, SECRET);
      const isValid = verifyHmac(validTransaction, signature, 'wrong-secret');

      expect(isValid).toBe(false);
    });

    it('acepta payloads firmados en formato de bot académico (orden de inserción y sin currency)', () => {
      const botSecret = 'dev-secret-super-secure-key-gastroforge-2026-xyz';
      const botPayload = {
        idTxn: 10077,
        user: 'stszddg@outlook.com',
        date: '2024-10-04T10:40:58.315Z',
        value: 700897,
        paymentMethod: 'Apple Pay',
        hash: 'e08a7f4ee4b20781099125b34cee1ff2a68c27422c6f0850609b5c71e0678a50',
      };

      const isValid = verifyHmac(botPayload, botPayload.hash, botSecret);
      expect(isValid).toBe(true);
    });
  });
});
