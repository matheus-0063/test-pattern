import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { CheckoutService } from '../src/services/CheckoutService.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

describe('CheckoutService', () => {
    const cartaoCredito = { numero: '4111111111111111', cvv: '123' };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('quando o pagamento falha', () => {
        test('deve retornar null usando um stub de pagamento e dummies nas demais dependências', async () => {
            // Arrange: o stub controla a resposta; os dummies apenas completam o construtor.
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryDummy = {};
            const emailDummy = {};
            const checkout = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

            // Act
            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            // Assert: verificação de estado, sem inspecionar chamadas.
            expect(pedido).toBeNull();
        });

        test('não deve salvar o pedido nem enviar e-mail', async () => {
            // Arrange: os mocks permitem verificar a ausência de interações.
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };
            const checkout = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            // Act
            await checkout.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        test('deve retornar o pedido salvo com a soma dos itens e sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPadrao())
                .comItens([new Item('Livro', 80), new Item('Fone', 120)])
                .build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => (
                    new Pedido(10, pedido.carrinho, pedido.totalFinal, pedido.status)
                )),
            };
            const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            // Assert: o stub de persistência preserva os valores recebidos do serviço.
            expect(pedido).toEqual(new Pedido(10, carrinho, 200, 'PROCESSADO'));
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        test('deve cobrar R$ 180 por R$ 200 em itens e salvar o pedido com desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPremium())
                .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
                .build();
            // Controla o sucesso do pagamento e também verifica o valor cobrado.
            const gatewayMock = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const pedidoSalvo = new Pedido(42, carrinho, 180, 'PROCESSADO');
            const repositoryMock = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkout = new CheckoutService(gatewayMock, repositoryMock, emailStub);

            // Act
            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            // Assert: verificação de comportamento e do retorno da persistência.
            expect(gatewayMock.cobrar).toHaveBeenCalledTimes(1);
            expect(gatewayMock.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
            expect(repositoryMock.salvar).toHaveBeenCalledTimes(1);
            expect(repositoryMock.salvar).toHaveBeenCalledWith(
                new Pedido(null, carrinho, 180, 'PROCESSADO'),
            );
            expect(pedido).toBe(pedidoSalvo);
        });

        test('deve enviar um único e-mail com o destinatário, o ID salvo e o valor correto', async () => {
            // Arrange: gateway e repository são stubs; e-mail é o mock verificado.
            const carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPremium())
                .comItens([new Item('Produto', 200)])
                .build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const pedidoSalvo = new Pedido(42, carrinho, 180, 'PROCESSADO');
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailMock);

            // Act
            await checkout.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180',
            );
        });
    });

    describe('quando uma dependência lança um erro', () => {
        test('deve retornar o pedido salvo e registrar a falha se o envio de e-mail falhar', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const pedidoSalvo = new Pedido(7, carrinho, 100, 'PROCESSADO');
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailStub = {
                enviarEmail: jest.fn().mockRejectedValue(new Error('Servidor indisponível')),
            };
            const consoleMock = jest.spyOn(console, 'error').mockImplementation(() => {});
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            // Act
            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBe(pedidoSalvo);
            expect(consoleMock).toHaveBeenCalledTimes(1);
            expect(consoleMock).toHaveBeenCalledWith(
                'Falha ao enviar e-mail', 'Servidor indisponível',
            );
        });

        test('deve propagar o erro do gateway sem salvar nem enviar e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const erro = new Error('Gateway indisponível');
            const gatewayStub = { cobrar: jest.fn().mockRejectedValue(erro) };
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };
            const checkout = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            // Act
            const processamento = checkout.processarPedido(carrinho, cartaoCredito);

            // Assert
            await expect(processamento).rejects.toBe(erro);
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });

        test('deve propagar o erro de persistência sem enviar e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const erro = new Error('Banco indisponível');
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockRejectedValue(erro) };
            const emailMock = { enviarEmail: jest.fn() };
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailMock);

            // Act
            const processamento = checkout.processarPedido(carrinho, cartaoCredito);

            // Assert
            await expect(processamento).rejects.toBe(erro);
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    test('deve calcular total zero para um carrinho vazio, conforme o comportamento atual', async () => {
        // Arrange: o serviço atual permite cobrar um carrinho vazio.
        const carrinho = new CarrinhoBuilder().vazio().build();
        const gatewayMock = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
        const repositoryStub = {
            salvar: jest.fn().mockImplementation(async (pedido) => (
                new Pedido(8, pedido.carrinho, pedido.totalFinal, pedido.status)
            )),
        };
        const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
        const checkout = new CheckoutService(gatewayMock, repositoryStub, emailStub);

        // Act
        const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

        // Assert
        expect(pedido).toEqual(new Pedido(8, carrinho, 0, 'PROCESSADO'));
        expect(gatewayMock.cobrar).toHaveBeenCalledTimes(1);
        expect(gatewayMock.cobrar).toHaveBeenCalledWith(0, cartaoCredito);
    });
});
