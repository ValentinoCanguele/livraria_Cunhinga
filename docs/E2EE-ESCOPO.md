# Escopo E2EE — mensagens privadas ligadas a livros

Estado: esquema e camada de acesso ciphertext-only preparados localmente; inbox de produção ainda não implementado.

## Decisões

- O conteúdo protegido são mensagens privadas de suporte entre um cliente autenticado e a equipa.
- Na primeira versão, só administradores podem ser destinatários e detentores de chaves de leitura.
- O cliente pode iniciar a conversa a partir de um livro ou de uma avaliação. `book_id` e, quando aplicável, `review_id` são metadados de ligação, não conteúdo cifrado.
- Comentários e estrelas das avaliações continuam públicos. As médias, distribuição por estrelas e contagens continuam calculáveis e visíveis na loja.
- A lista de desejos existente continua a representar os favoritos pessoais de cada utilizador.
- Os votos «Útil» nas avaliações são uma funcionalidade pública independente: a contagem pode ser vista, mas a identidade dos votantes não é publicada.
- O assistente com IA, o formulário público atual, o CRM, campanhas, emails/WhatsApp, encomendas e pagamentos ficam fora do E2EE.

## Limites de privacidade

A cifra protege o corpo da mensagem contra leitura na base de dados, nos serviços de alojamento e nos registos de aplicação. Não esconde a identidade da conta, participantes, livro/review associado, timestamps, estado de entrega ou tamanho aproximado da mensagem.

As mensagens não podem ser pesquisadas, moderadas, restauradas ou encaminhadas pelo servidor em texto simples. Emails e notificações push/WhatsApp devem ser genéricos e nunca conter o corpo da mensagem.

E2EE não protege um dispositivo comprometido, extensões maliciosas, screenshots, cópias feitas pelo destinatário ou JavaScript do site comprometido (incluindo XSS). A distribuição de chaves públicas também precisa de uma estratégia de verificação: se o servidor puder substituir uma chave sem deteção, pode intermediar uma conversa.

## Requisitos para implementação

1. Não guardar mensagens cifradas em `contacts.notes`, `contact_notifications.body` ou `notification_logs.content`; criar tabelas próprias para conversas, mensagens cifradas, chaves públicas e envelopes de chaves.
2. A base de dados guarda ciphertext, nonce/tag, versão do protocolo, referências opacas e metadados mínimos. Não guarda chaves privadas nem frases de recuperação.
3. Usar protocolo e implementação criptográfica mantidos e revistos; não inventar primitivas ou protocolo próprio. Validar suporte nos navegadores móveis usados pela loja.
4. Cada cliente e administrador gera as chaves no dispositivo. As chaves privadas ficam protegidas localmente por credencial de recuperação controlada pelo utilizador; a perda sem recuperação torna o histórico ilegível.
5. A inclusão ou remoção de administradores exige rotação/distribuição de chaves. Remover acesso futuro não apaga plaintext ou chaves já obtidos por um administrador anterior.
6. RLS restringe criação/leitura de conversas aos participantes autorizados; políticas e RPCs não devolvem corpos em plaintext nem listas de identidade de votos úteis.
7. O cliente só pode apontar para livros e avaliações existentes. A referência nunca concede acesso a dados privados do autor da avaliação.

## Avaliação de bibliotecas (2026-11-02)

- `@privacyresearch/libsignal-protocol-typescript` tem uma implementação Signal para TypeScript/browser, mas a versão publicada é antiga (0.0.16, há três anos) e GPL-3.0; não é uma escolha adequada para este frontend.
- `@signalapp/libsignal-client` pertence ao projecto oficial Signal, mas é destinado aos clientes Signal, não oferece um caminho browser simples e o próprio projecto declara uso externo como não suportado.
- `ts-mls` implementa MLS/RFC 9420, suporta browsers, é MIT e tem actividade recente. O seu README declara que não foi formalmente auditado e recomenda cautela em produção ou contextos críticos.
- `@vanishing.page/webcrypto-mls` é um fork browser de `ts-mls` ainda em `0.0.x`; não é tratado como uma alternativa auditada.
- `openmls-wasm` descreve-se como experiência de bindings e não é uma base de produção.

Decisão de segurança: não ligar uma biblioteca criptográfica experimental ao fluxo real de clientes nem anunciar o inbox como E2EE sem revisão independente. Uma prova de conceito isolada com `ts-mls` pode validar integração e armazenamento MLS, mas não é aprovação para produção.

## Prova isolada

`app/web/src/lib/e2eePrototype.test.js` é um teste apenas de desenvolvimento, não importado pelo frontend. Usa identidades sintéticas e verifica um grupo cliente/administrador, troca de mensagens cifradas, exclusão de um participante externo e rejeição de ciphertext adulterado. A identidade do teste é ligada a chaves geradas dentro do próprio teste; isto não implementa a verificação de identidade Supabase, recuperação de chave ou persistência real.

O pacote MLS e `@noble/hashes` estão como dependências de desenvolvimento. A prova não torna o site E2EE, não armazena mensagens reais e não deve ser publicada como funcionalidade de segurança.

## Base de armazenamento local

A migração `20261102130000_inbox_privado_e2ee.sql` cria diretório de key packages públicos, threads ligadas opcionalmente a livro/review e mensagens MLS em Base64URL. O remetente e o cliente da thread são derivados da sessão; RLS limita leituras ao cliente dono ou a administradores. O RPC `e2ee_admin_key_packages` expõe apenas packages ativos dos administradores a utilizadores autenticados. A migração ainda não foi aplicada e não pôde ser validada com `supabase db lint`: não há base local em execução nem projeto Supabase linkado nesta cópia.

`app/web/src/lib/secureInboxApi.js` é uma camada de acesso que só aceita formatos MLS e ciphertext Base64URL. Não existe componente de inbox, criptografia real de mensagens no frontend, associação verificada entre chave pública e conta Supabase, persistência/recuperação de estado MLS nem política de rotação pronta.

## Sequência

1. Votos úteis nas avaliações: tabela por utilizador/review, contagem pública agregada e RLS. A migração e UI estão no repositório, ainda sem aplicação na base de produção.
2. Escolher protocolo de mensagens, formato de envelope, verificação de chaves, recuperação, revogação e política de retenção.
3. Implementar registo de chaves de administradores e clientes, sem expor chaves privadas ao servidor.
4. Implementar inbox autenticado, mensagens cifradas e ligação opcional a livro/review; incluir notificações genéricas.
5. Testar com duas sessões independentes, tentativas de acesso não autorizado, troca/rotação de chaves, ciphertext-only no banco e perda/recuperação de chave.

## Fora do estado atual

A migração de votos úteis ainda não foi aplicada em produção. Não existe inbox E2EE, gestão/recuperação de chaves nem integração visual para iniciar uma conversa privada. A build atual não deve ser apresentada como E2EE até esses passos e testes serem concluídos.
