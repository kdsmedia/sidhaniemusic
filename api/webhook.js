const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Database Musik (Sesuaikan dengan file di folder music/)
const musicList = [
  { id: "01", title: "Lagu Kenangan - Artis A" },
  { id: "02", title: "Melodi Senja - Artis B" },
  { id: "03", title: "Rhythm Malam - Artis C" }
];

// --- MENU UTAMA ---
const mainMenu = (ctx) => {
  const welcomeText = `*Halo! Selamat Datang di Sidhanie* 🎵\n\nSidhanie adalah Media Player universal untuk pemutar musik dan akses cepat ke media sosial kami.\n\nSilakan pilih menu di bawah ini:`;
  
  return ctx.replyWithMarkdown(welcomeText, 
    Markup.inlineKeyboard([
      [Markup.button.callback('🎵 MUSIK', 'show_list')],
      [
        Markup.button.url('📱 TIKTOK', 'https://www.tiktok.com/@sidhanie'),
        Markup.button.url('📸 INSTAGRAM', 'https://www.instagram.com/sidhanie06')
      ],
      [
        Markup.button.url('🎥 YOUTUBE', 'https://www.youtube.com/@sidhanie06'),
        Markup.button.url('🎧 SPOTIFY', 'https://open.spotify.com/user/your_id')
      ],
      [Markup.button.callback('🛡️ PRIVACY POLICY', 'show_privacy')]
    ])
  );
};

bot.start((ctx) => mainMenu(ctx));

// --- HANDLER: LIST MUSIK ---
bot.action('show_list', (ctx) => {
  let message = "🎵 *Daftar Musik Sidhanie:*\n\n";
  musicList.forEach(item => {
    message += `*${item.id}*. ${item.title}\n`;
  });
  message += "\n_Ketik nomor urut untuk memutar musik._";

  ctx.answerCbQuery();
  return ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'back_to_main')]])
  });
});

// --- HANDLER: PRIVACY POLICY ---
bot.action('show_privacy', (ctx) => {
  const privacyText = `🛡️ *Privacy Policy - Sidhanie*\n\n1. Media Player ini tidak menyimpan data pribadi.\n2. Hak cipta milik artis Sidhanie.\n\n📞 *Admin:* @sidhanie06`;
  ctx.answerCbQuery();
  return ctx.editMessageText(privacyText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'back_to_main')]])
  });
});

bot.action('back_to_main', (ctx) => {
  ctx.answerCbQuery();
  ctx.deleteMessage();
  return mainMenu(ctx);
});

// --- LOGIKA PUTAR MUSIK ---
bot.on('text', async (ctx) => {
  const input = ctx.message.text.trim();
  if (/^\d+$/.test(input)) {
    const songId = input.padStart(2, '0');
    const song = musicList.find(s => s.id === songId);

    if (song) {
      const audioUrl = `https://${process.env.VERCEL_URL}/music/${songId}.mp3`;
      await ctx.sendChatAction('upload_document');
      
      const nextIndex = (musicList.findIndex(s => s.id === songId) + 1) % musicList.length;
      const nextId = musicList[nextIndex].id;

      return ctx.replyWithAudio({ url: audioUrl }, {
        caption: `▶️ *SEDANG DIPUTAR*\n🎼 *Judul:* ${song.title}\n🔢 *Nomor:* ${songId}`,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('⏹ Stop', 'back_to_main'),
            Markup.button.callback('⏭ Next', `next_${nextId}`)
          ],
          [Markup.button.callback('📱 Menu Utama', 'back_to_main')]
        ])
      });
    }
  }
});

bot.action(/^next_(\d+)$/, (ctx) => {
  const nextId = ctx.match[1];
  ctx.answerCbQuery('Memutar lagu berikutnya...');
  // Logic to trigger next song by sending text or calling function
  ctx.reply(`Ketik ${nextId} untuk lanjut memutar lagu berikutnya.`);
});

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      res.status(200).send('Sidhanie is running!');
    }
  } catch (e) {
    res.status(500).send('Error');
  }
};
