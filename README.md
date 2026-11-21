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

Os testes estão em `__tests__/CheckoutService.test.js` e seguem Arrange, Act, Assert
(preparar, executar e verificar). As dependências externas são substituídas por
dublês; nenhum teste realiza cobrança, gravação em banco ou envio real de e-mail.

### Criação dos dados

- **Object Mother:** `UserMother.umUsuarioPadrao()` e
  `UserMother.umUsuarioPremium()` retornam novos usuários com dados conhecidos.
- **Data Builder:** `CarrinhoBuilder` começa com um usuário padrão e um item de
  R$ 100. Os métodos `comUser(user)`, `comItens(itens)` e `vazio()` personalizam o
  carrinho de forma fluente; `build()` cria a instância final.

```js
const carrinho = new CarrinhoBuilder()
    .comUser(UserMother.umUsuarioPremium())
    .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
    .build();
```

O Mother atende aos dois perfis fixos de usuário. O Builder permite combinar
usuários e itens sem criar um método de fábrica para cada combinação.

### Papéis dos dublês

- **Stub:** fornece respostas predefinidas para controlar o cenário. No teste de
  estado de pagamento recusado, apenas o resultado `null` é verificado.
- **Dummy:** preenche uma dependência que não será utilizada. Nesse mesmo teste,
  repository e e-mail são objetos vazios.
- **Mock:** permite verificar interações, como o valor cobrado, o pedido enviado
  para persistência ou os argumentos do e-mail.

O papel depende do uso no teste: `jest.fn().mockResolvedValue(...)` pode funcionar
como stub ao fornecer uma resposta e como mock quando suas chamadas são
verificadas. No teste de e-mail Premium, gateway e repository são stubs e o
serviço de e-mail é o mock.

### Cenários implementados

1. Pagamento recusado retorna `null`.
2. Pagamento recusado não salva pedido nem envia e-mail.
3. Cliente padrão recebe o pedido salvo com a soma dos itens, sem desconto.
4. Cliente Premium paga R$ 180 por R$ 200 em itens; o pedido é salvo com desconto.
5. O e-mail Premium é enviado uma vez, com destinatário, ID e valor corretos.
6. Falha no e-mail é registrada e não impede o retorno do pedido salvo.
7. Erro do gateway é propagado sem persistência nem notificação.
8. Erro de persistência é propagado sem notificação.
9. Carrinho vazio tem total zero, conforme o comportamento atual do serviço.

Os testes documentam a lógica existente. O serviço ainda aceita carrinhos vazios;
uma eventual regra para rejeitá-los precisa ser definida antes de mudar esse fluxo.

## Como executar

1.  **Instale as dependências** com Node.js e npm disponíveis:
    ```bash
    npm ci
    ```
2.  **Execute todos os testes:**
    ```bash
    npm test
    ```
3.  **Execute em modo watch:**
    ```bash
    npm test -- --watch
    ```
4.  **Gere a cobertura do `CheckoutService`:**
    ```bash
    npm run coverage
    ```
    O relatório HTML fica em `coverage/lcov-report/index.html`. A cobertura é
    limitada ao serviço que é o objeto deste trabalho, conforme `package.json`.

A configuração Babel permite ao Jest executar os módulos `import`/`export` do
projeto. O Jest descobre apenas arquivos `*.test.js`, para não tratar os builders
em `__tests__/builders/` como suítes de teste. O `package-lock.json` registra as
versões instaladas para reproduzir o ambiente com `npm ci`.
