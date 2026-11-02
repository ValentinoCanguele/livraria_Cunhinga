// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bytesToBase64,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeMlsMessage,
  defaultCapabilities,
  defaultKeyPackageEqualityConfig,
  defaultKeyRetentionConfig,
  defaultLifetime,
  defaultLifetimeConfig,
  defaultPaddingConfig,
  emptyPskIndex,
  encodeMlsMessage,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  processMessage,
  zeroOutUint8Array,
} from 'ts-mls';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ciphersuiteName = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
const rejectGroupChanges = () => 'reject';

function createClientConfig(identityBySigningKey) {
  return {
    keyRetentionConfig: defaultKeyRetentionConfig,
    lifetimeConfig: defaultLifetimeConfig,
    keyPackageEqualityConfig: defaultKeyPackageEqualityConfig,
    paddingConfig: defaultPaddingConfig,
    authService: {
      async validateCredential(credential, signaturePublicKey) {
        const expectedIdentity = identityBySigningKey.get(bytesToBase64(signaturePublicKey));
        return expectedIdentity === decoder.decode(credential.identity);
      },
    },
  };
}

async function createParticipant(identity, ciphersuite, identityBySigningKey, clientConfig) {
  const keyPackage = await generateKeyPackage(
    { credentialType: 'basic', identity: encoder.encode(identity) },
    defaultCapabilities(),
    defaultLifetime,
    [],
    ciphersuite,
  );
  identityBySigningKey.set(
    bytesToBase64(keyPackage.publicPackage.leafNode.signaturePublicKey),
    identity,
  );
  return keyPackage;
}

async function createTwoMemberConversation() {
  const ciphersuite = await getCiphersuiteImpl(getCiphersuiteFromName(ciphersuiteName));
  const identityBySigningKey = new Map();
  const clientConfig = createClientConfig(identityBySigningKey);
  const customerKeys = await createParticipant('customer-test', ciphersuite, identityBySigningKey, clientConfig);
  const adminKeys = await createParticipant('admin-test', ciphersuite, identityBySigningKey, clientConfig);
  const customerState = await createGroup(
    encoder.encode('local-e2ee-prototype'),
    customerKeys.publicPackage,
    customerKeys.privatePackage,
    [],
    ciphersuite,
    clientConfig,
  );
  const commit = await createCommit({ state: customerState, cipherSuite: ciphersuite }, {
    extraProposals: [{ proposalType: 'add', add: { keyPackage: adminKeys.publicPackage } }],
    ratchetTreeExtension: true,
  });
  const adminState = await joinGroup(
    commit.welcome,
    adminKeys.publicPackage,
    adminKeys.privatePackage,
    emptyPskIndex,
    ciphersuite,
    commit.newState.ratchetTree,
    undefined,
    clientConfig,
  );
  commit.consumed.forEach(zeroOutUint8Array);

  return { ciphersuite, clientConfig, customerKeys, adminKeys, customerState: commit.newState, adminState };
}

async function sendAndReceive(state, receiverState, text, ciphersuite) {
  const sent = await createApplicationMessage(state, encoder.encode(text), ciphersuite);
  const wire = encodeMlsMessage({
    version: 'mls10',
    wireformat: 'mls_private_message',
    privateMessage: sent.privateMessage,
  });
  const [message] = decodeMlsMessage(wire, 0);
  const received = await processMessage(message, receiverState, emptyPskIndex, rejectGroupChanges, ciphersuite);
  sent.consumed.forEach(zeroOutUint8Array);
  received.consumed?.forEach(zeroOutUint8Array);

  return { sent, wire, received };
}

describe('MLS browser prototype (test-only)', () => {
  it('encrypts both directions and only group members can read the message', async () => {
    const conversation = await createTwoMemberConversation();
    const { ciphersuite } = conversation;
    const customerMessage = 'mensagem privada de teste';
    const toAdmin = await sendAndReceive(
      conversation.customerState,
      conversation.adminState,
      customerMessage,
      ciphersuite,
    );

    expect(toAdmin.received.kind).toBe('applicationMessage');
    expect(decoder.decode(toAdmin.received.message)).toBe(customerMessage);
    expect(decoder.decode(toAdmin.wire)).not.toContain(customerMessage);

    const outsiderKeys = await createParticipant(
      'outsider-test',
      ciphersuite,
      new Map(),
      conversation.clientConfig,
    );
    const outsiderState = await createGroup(
      encoder.encode('different-test-group'),
      outsiderKeys.publicPackage,
      outsiderKeys.privatePackage,
      [],
      ciphersuite,
      conversation.clientConfig,
    );
    const [wireMessage] = decodeMlsMessage(toAdmin.wire, 0);

    await expect(processMessage(
      wireMessage,
      outsiderState,
      emptyPskIndex,
      rejectGroupChanges,
      ciphersuite,
    )).rejects.toThrow();

    const adminMessage = 'resposta privada de teste';
    const toCustomer = await sendAndReceive(
      toAdmin.received.newState,
      toAdmin.sent.newState,
      adminMessage,
      ciphersuite,
    );
    expect(toCustomer.received.kind).toBe('applicationMessage');
    expect(decoder.decode(toCustomer.received.message)).toBe(adminMessage);
  });

  it('rejects a tampered MLS ciphertext', async () => {
    const conversation = await createTwoMemberConversation();
    const sent = await createApplicationMessage(
      conversation.customerState,
      encoder.encode('conteudo autentico'),
      conversation.ciphersuite,
    );
    const wire = encodeMlsMessage({
      version: 'mls10',
      wireformat: 'mls_private_message',
      privateMessage: sent.privateMessage,
    });
    const tampered = wire.slice();
    tampered[tampered.length - 1] ^= 1;
    const [message] = decodeMlsMessage(tampered, 0);

    await expect(processMessage(
      message,
      conversation.adminState,
      emptyPskIndex,
      rejectGroupChanges,
      conversation.ciphersuite,
    )).rejects.toThrow();
    sent.consumed.forEach(zeroOutUint8Array);
  });
});
