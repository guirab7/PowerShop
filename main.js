const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

// Função principal que inicia o bot
async function startBot() {
    // Salva a autenticação em arquivos para não precisar escanear o QR Code toda vez
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // Cria a conexão com o WhatsApp
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Deixa o console mais limpo
        printQRInTerminal: true, // Mostra o QR Code no terminal
        auth: state,
        browser: ['Meu Bot', 'Chrome', '1.0.0'] // Define como o bot aparece nos aparelhos conectados
    });

    // Evento que lida com as atualizações da conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("QR Code recebido, escaneie com seu celular.");
            qrcode.generate(qr, { small: true }); // Mostra um QR code pequeno no console
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Motivo:', lastDisconnect.error, ', reconectando:', shouldReconnect);
            // Reconecta se não for um logout
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Conexão aberta e bot online!');
        }
    });

    // Salva as credenciais sempre que elas forem atualizadas
    sock.ev.on('creds.update', saveCreds);

    // Evento que lida com as mensagens recebidas
    sock.ev.on('messages.upsert', async (m) => {
        // Pega a primeira mensagem do evento
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) {
            return; // Ignora se a mensagem for vazia ou se for do próprio bot
        }

        // Extrai o texto da mensagem de forma simples
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        // COMANDO DE MENU COM BOTÕES
        if (messageText.toLowerCase() === '.menu') {
            console.log("Recebido comando .menu, enviando botões...");

            const buttons = [
                { buttonId: 'id_comprar', buttonText: { displayText: '🛒 Quero Comprar' }, type: 1 },
                { buttonId: 'id_duvidas', buttonText: { displayText: '❓ Tirar Dúvidas' }, type: 1 },
                { buttonId: 'id_atendente', buttonText: { displayText: '💬 Falar com Atendente' }, type: 1 }
            ];

            const buttonMessage = {
                text: `Olá! 👋 Bem-vindo ao menu interativo.`,
                footer: 'Escolha uma opção abaixo.',
                buttons: buttons,
                headerType: 1
            };

            try {
                await sock.sendMessage(msg.key.remoteJid, buttonMessage);
                console.log("Mensagem com botões enviada com sucesso!");
            } catch (e) {
                console.error("Erro ao enviar mensagem com botões:", e);
            }
        }

        // LÓGICA PARA AS RESPOSTAS DOS BOTÕES
        const selectedButtonId = msg.message.buttonsResponseMessage?.selectedButtonId;
        if (selectedButtonId) {
            if (selectedButtonId === 'id_comprar') {
                await sock.sendMessage(msg.key.remoteJid, { text: "Você escolheu 'Quero Comprar'. O que você gostaria de ver?" });
            } else if (selectedButtonId === 'id_duvidas') {
                await sock.sendMessage(msg.key.remoteJid, { text: "Você escolheu 'Tirar Dúvidas'. Qual a sua pergunta?" });
            } else if (selectedButtonId === 'id_atendente') {
                await sock.sendMessage(msg.key.remoteJid, { text: "Você escolheu 'Falar com Atendente'. Transferindo..." });
            }
        }
    });
}

// Inicia o bot
startBot();
