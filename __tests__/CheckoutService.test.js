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
        test('deve retornar null', async () => {
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryDummy = {};
            const emailDummy = {};
            const checkout = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            expect(pedido).toBeNull();
        });

        test('não deve salvar o pedido nem enviar e-mail', async () => {
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };
            const checkout = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            await checkout.processarPedido(carrinho, cartaoCredito);

            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        test('deve retornar o pedido salvo com a soma dos itens e sem desconto', async () => {
            const carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPadrao())
                .comItens([new Item('Livro', 80), new Item('Fone', 120)])
                .build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = {
                salvar: jest.fn(async (pedido) => (
                    new Pedido(10, pedido.carrinho, pedido.totalFinal, pedido.status)
                )),
            };
            const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            expect(pedido).toEqual(new Pedido(10, carrinho, 200, 'PROCESSADO'));
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let carrinho;
        let gatewayMock;
        let repositoryMock;
        let emailMock;
        let pedidoSalvo;
        let checkout;

        beforeEach(() => {
            carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPremium())
                .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
                .build();
            gatewayMock = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            pedidoSalvo = new Pedido(42, carrinho, 180, 'PROCESSADO');
            repositoryMock = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            checkout = new CheckoutService(gatewayMock, repositoryMock, emailMock);
        });

        test('deve cobrar e salvar o pedido com 10% de desconto', async () => {
            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            expect(gatewayMock.cobrar).toHaveBeenCalledTimes(1);
            expect(gatewayMock.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
            expect(repositoryMock.salvar).toHaveBeenCalledTimes(1);
            expect(repositoryMock.salvar).toHaveBeenCalledWith(
                new Pedido(null, carrinho, 180, 'PROCESSADO'),
            );
            expect(pedido).toBe(pedidoSalvo);
        });

        test('deve enviar a confirmação com os dados do pedido salvo', async () => {
            await checkout.processarPedido(carrinho, cartaoCredito);

            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180',
            );
        });
    });

    describe('quando uma dependência lança um erro', () => {
        test('deve manter o pedido aprovado se o e-mail falhar', async () => {
            const carrinho = new CarrinhoBuilder().build();
            const pedidoSalvo = new Pedido(7, carrinho, 100, 'PROCESSADO');
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            const emailStub = {
                enviarEmail: jest.fn().mockRejectedValue(new Error('Servidor indisponível')),
            };
            const consoleMock = jest.spyOn(console, 'error').mockImplementation(() => {});
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailStub);

            const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

            expect(pedido).toBe(pedidoSalvo);
            expect(consoleMock).toHaveBeenCalledTimes(1);
            expect(consoleMock).toHaveBeenCalledWith(
                'Falha ao enviar e-mail', 'Servidor indisponível',
            );
        });

        test('deve propagar o erro do gateway sem salvar nem enviar e-mail', async () => {
            const carrinho = new CarrinhoBuilder().build();
            const erro = new Error('Gateway indisponível');
            const gatewayStub = { cobrar: jest.fn().mockRejectedValue(erro) };
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };
            const checkout = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            const processamento = checkout.processarPedido(carrinho, cartaoCredito);

            await expect(processamento).rejects.toBe(erro);
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });

        test('deve propagar o erro de persistência sem enviar e-mail', async () => {
            const carrinho = new CarrinhoBuilder().build();
            const erro = new Error('Banco indisponível');
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            const repositoryStub = { salvar: jest.fn().mockRejectedValue(erro) };
            const emailMock = { enviarEmail: jest.fn() };
            const checkout = new CheckoutService(gatewayStub, repositoryStub, emailMock);

            const processamento = checkout.processarPedido(carrinho, cartaoCredito);

            await expect(processamento).rejects.toBe(erro);
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    test('deve cobrar valor zero quando o carrinho estiver vazio', async () => {
        const carrinho = new CarrinhoBuilder().vazio().build();
        const gatewayMock = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
        const repositoryStub = {
            salvar: jest.fn(async (pedido) => (
                new Pedido(8, pedido.carrinho, pedido.totalFinal, pedido.status)
            )),
        };
        const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
        const checkout = new CheckoutService(gatewayMock, repositoryStub, emailStub);

        const pedido = await checkout.processarPedido(carrinho, cartaoCredito);

        expect(pedido).toEqual(new Pedido(8, carrinho, 0, 'PROCESSADO'));
        expect(gatewayMock.cobrar).toHaveBeenCalledTimes(1);
        expect(gatewayMock.cobrar).toHaveBeenCalledWith(0, cartaoCredito);
    });
});
