# Trabalho Prático: Implementando Padrões de Teste (Test Patterns)

Este repositório contem os elementos necessários para execução do projeto de Test Patterns

## Sua Tarefa

Seu objetivo é criar a suíte de testes para o `src/services/CheckoutService.js`.

1.  **Crie seu arquivo de teste:** `__tests__/CheckoutService.test.js`.
2.  **Crie os Builders:** Crie a pasta `__tests__/builders/` e implemente:
    - `UserMother.js` (Object Mother)
    - `CarrinhoBuilder.js` (Data Builder)
3.  **Implemente os Testes:** No seu arquivo de teste, cubra os principais cenários do `CheckoutService`, aplicando os padrões de Test Doubles corretos.

### Cenários Principais a Cobrir:

- **Verificação de Estado (Stub):**
  - Deve retornar `null` se o `GatewayPagamento` recusar a cobrança.
  - Deve retornar o pedido salvo com o `totalFinal` correto para um cliente padrão.
- **Verificação de Comportamento (Mock):**
  - Deve aplicar 10% de desconto ao chamar o `GatewayPagamento` se o usuário for "PREMIUM".
  - Deve chamar o `EmailService.enviarEmail` com os dados corretos após um pagamento bem-sucedido.
  - Não deve chamar o `EmailService` nem o `PedidoRepository` se o pagamento falhar.

## Implementação da suíte

Os testes estão em `__tests__/CheckoutService.test.js`. Eles seguem a sequência
preparar, executar e verificar (AAA), com as etapas separadas por linhas em branco.
Pagamento, persistência e e-mail são simulados com dublês.

### Criação dos dados

O `UserMother` cria os dois perfis usados nos testes: padrão e Premium.
O `CarrinhoBuilder` começa com um usuário padrão e um item de R$ 100. Ele permite
trocar o usuário, definir os itens ou criar um carrinho vazio.

```js
const carrinho = new CarrinhoBuilder()
    .comUser(UserMother.umUsuarioPremium())
    .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
    .build();
```

O Builder evita criar um método de fábrica para cada combinação de usuário e itens.

### Papéis dos dublês

- No teste que espera `null`, o gateway é um **stub**: retorna pagamento recusado.
  Repository e e-mail são **dummies**, pois não serão utilizados.
- No teste do desconto, gateway e repository são **mocks**: suas chamadas são
  verificadas para conferir o valor cobrado e o pedido salvo.
- No teste da confirmação por e-mail, gateway e repository fornecem as respostas
  como **stubs**. O e-mail é o **mock** cujos argumentos e número de chamadas são
  verificados.

Os nomes das variáveis não mudam o papel do dublê: a mesma `jest.fn()` pode fornecer
uma resposta em um teste e ter suas chamadas verificadas em outro. Os testes
Premium compartilham a preparação em um `beforeEach`, com novos objetos a cada teste.

### Cenários implementados

Os nove testes cobrem pagamento recusado, total do cliente padrão, desconto
Premium, confirmação por e-mail e erros nas dependências. Também registram o
comportamento atual do carrinho vazio: ele é aceito e cobrado com valor zero.

## Como executar

Com Node.js e npm instalados:

```bash
npm ci
npm test
```

Para acompanhar mudanças, use `npm test -- --watch`. Para gerar a cobertura do
`CheckoutService`, use `npm run coverage`. O relatório HTML fica em
`coverage/lcov-report/index.html`.

O Babel permite executar `import`/`export` no Jest. Apenas arquivos `*.test.js`
são reconhecidos como testes, para que os builders não sejam executados como suítes.
