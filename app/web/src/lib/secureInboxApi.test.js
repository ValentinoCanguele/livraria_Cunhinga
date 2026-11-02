import { describe, expect, it } from 'vitest';
import { buildEncryptedMessageRecord } from '@/lib/secureInboxApi';

const envelope = {
  threadId: '4c274ad2-8d90-4aeb-9350-d226fc206d7d',
  clientMessageId: '667f5b0d-e8aa-4ac7-94be-57108698a740',
  wireFormat: 'mls_private_message',
  epoch: 2,
  ciphertextBase64url: 'bWxzLWNpcGhlcnRleHQ',
};

describe('buildEncryptedMessageRecord', () => {
  it('emite apenas metadados e ciphertext MLS, nunca plaintext', () => {
    const record = buildEncryptedMessageRecord(envelope);

    expect(record).toEqual({
      thread_id: envelope.threadId,
      client_message_id: envelope.clientMessageId,
      wire_format: 'mls_private_message',
      epoch: 2,
      ciphertext_base64url: envelope.ciphertextBase64url,
    });
    expect(record).not.toHaveProperty('plaintext');
    expect(record).not.toHaveProperty('message');
  });

  it('rejeita formatos que não são MLS e ciphertext com caracteres inválidos', () => {
    expect(() => buildEncryptedMessageRecord({ ...envelope, wireFormat: 'text/plain' })).toThrow();
    expect(() => buildEncryptedMessageRecord({ ...envelope, ciphertextBase64url: 'plain text' })).toThrow();
  });

  it('rejeita IDs inválidos e épocas negativas', () => {
    expect(() => buildEncryptedMessageRecord({ ...envelope, threadId: 'not-a-uuid' })).toThrow();
    expect(() => buildEncryptedMessageRecord({ ...envelope, epoch: -1 })).toThrow();
  });
});