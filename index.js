const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] }
});

const gruposPermitidos = [
  '120363403199317276@g.us',
  '120363351699706014@g.us'
];

const avisados = {};

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log("Shellzinha Private ON");
});

const regrasDoGrupo = `
📌 *REGRAS DO GRUPO:*

1️⃣ Sem *links*, *fotos* ou *vídeos*.
2️⃣ Permitido: *áudios*, *stickers* e *textos* (máx. 35 palavras).
3️⃣ Regras ignoradas = *banimento* após 1 aviso.
4️⃣ Mantenha o respeito e evite spam.

Obrigado por colaborar.
`;

client.on('group_join', async (notification) => {
  const chat = await notification.getChat();
  if (!gruposPermitidos.includes(chat.id._serialized)) return;

  const contact = await notification.getContact();
  const nome = contact.pushname || contact.number;

  const mensagem = `
👤 *Bem-vindo(a), ${nome}!* 👋

| Leia as regras para evitar punições: *#regras* 

🔐 Respeite as regras para não ser banido.

Se quiser algum *serviço*, só me chamar!

> ⚠ Não aceite serviços de outra pessoasa sem ser os adm.
`;

  await chat.sendMessage(mensagem, { mentions: [contact] });
});

async function moderarMensagem(msg) {
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized) || msg.fromMe) return;

  const sender = msg.author || msg.from;
  const participante = chat.participants.find(p => p.id._serialized === sender);
  if (participante?.isAdmin) return;

  const texto = msg.body?.trim() || '';
  const palavras = texto.split(/\s+/).filter(w => w.length > 0).length;
  const contemLink = /(https?:\/\/|www\.|[a-z0-9\-]+\.(com|net|org|xyz|br|info))/i.test(texto);

  const permitido =
    msg.type === 'sticker' ||
    msg.type === 'audio' ||
    (msg.type === 'chat' && palavras <= 35 && !contemLink);

  if (permitido) return;

  try {
    await msg.delete(true);
  } catch {}

  if (!avisados[chat.id]) avisados[chat.id] = {};

  if (avisados[chat.id][sender]) {
    await chat.sendMessage(`Conteúdo proibido apagado: @${sender.split('@')[0]}`, {
      mentions: [sender]
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await chat.removeParticipants([sender]);
    } catch {
      await chat.sendMessage('Erro ao remover. Verifique permissões do bot.');
    }
  } else {
    avisados[chat.id][sender] = true;
    await chat.sendMessage(
      `@${sender.split('@')[0]} sua mensagem foi removida.\n\nPermitido: áudios, figurinhas e textos de até 35 palavras.\nProibido: links, imagens ou vídeos.\nReincidência = ban.`,
      { mentions: [sender] }
    );
  }
}

async function handleCommands(msg) {
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;

  const text = msg.body.trim().toLowerCase();
  const sender = msg.author || msg.from;
  const participante = chat.participants.find(p => p.id._serialized === sender);

  if (!participante?.isAdmin) return;

  if (text === '!help') {
    const comandosFormatados = `
[ shellzinha private ]

|-- !ban » Banir membro respondendo a msg
|-- @todos » Mencionar todos do grupo
|-- #regras » Exibir regras do grupo

> Criado por: cryptoxxz7
`;
    const mediaPath = path.resolve('./assets/shellzinha.jpeg');
    if (fs.existsSync(mediaPath)) {
      const media = MessageMedia.fromFilePath(mediaPath);
      await chat.sendMessage(media, { caption: comandosFormatados });
    } else {
      await chat.sendMessage(comandosFormatados);
    }
    return;
  }

  if (text.startsWith('!ban')) {
    if (!msg.hasQuotedMsg) {
      return chat.sendMessage('Responda à mensagem e digite *!ban*.');
    }
    try {
      const quotedMsg = await msg.getQuotedMessage();
      const idToRemove = quotedMsg.author || quotedMsg.from;
      await chat.removeParticipants([idToRemove]);
      return chat.sendMessage(`Lixo removido: @${idToRemove.split('@')[0]}`, {
        mentions: [idToRemove]
      });
    } catch {
      return chat.sendMessage('Não consegui remover o participante.');
    }
  }

  if (text.startsWith('@todos')) {
    try {
      const mentions = chat.participants.map(p => p.id._serialized);
      const mensagem = msg.body.replace('@todos', '').trim() || 'Atenção todos!';
      return chat.sendMessage(mensagem, { mentions });
    } catch {
      await chat.sendMessage('Não consegui mencionar todos os membros.');
    }
  }
}

client.on('message', async msg => {
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;

  const text = msg.body.trim().toLowerCase();
  if (text === '#regras') {
    return chat.sendMessage(regrasDoGrupo);
  }

  if (msg.fromMe) return;

  await moderarMensagem(msg);
  await handleCommands(msg);
});

client.on('message_create', async msg => {
  if (!msg.fromMe) return;
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;
  await handleCommands(msg);
});

client.initialize();
