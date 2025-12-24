const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);

const getDynamicMusicList = () => {
  const musicDir = path.join(process.cwd(), 'music');
  try {
    if (!fs.existsSync(musicDir)) return [];
    const files = fs.readdirSync(musicDir)
      .filter(file => file.toLowerCase().endsWith('.mp3'))
      .sort();
    
    return files.map(file => {
      const songId = file.match(/^\d+/)?.[0] || "00";
      const cleanTitle = file
        .replace(/\.[^/.]+$/, "")   // Hapus ekstensi apapun
        .replace(/^\d+[_-]?/, '')  
        .replace(/[_-]/g, ' ')     
        .trim();

      return {
        id: songId,
        title: cleanTitle || file,
        fileName: file
      };
    });
  } catch (error) {
    console.error("Gagal membaca folder musik:", error);
    return [];
  }
};

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
        Markup.button.url('🎧 SPOTIFY', 'https://open.spotify.com')
      ],
      [Markup.button.callback('🛡️ PRIVACY POLICY', 'show_privacy')]
    ])
  );
};

bot.start((ctx) => mainMenu(ctx));

bot.action('show_list', (ctx) => {
  const musicList = getDynamicMusicList();
  if (musicList.length === 0) return ctx.answerCbQuery("Koleksi musik tidak ditemukan di server.");

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
  ctx.deleteMessage().catch(() => {});
  return mainMenu(ctx);
});

async function sendMusic(ctx, songId) {
  const musicList = getDynamicMusicList();
  const songIndex = musicList.findIndex(s => parseInt(s.id) === parseInt(songId));
  const song = musicList[songIndex];

  if (!song) {
    return ctx.reply(`❌ Nomor ${songId} tidak ditemukan.`);
  }

  // PERBAIKAN URL: Gunakan host dari request jika VERCEL_URL bermasalah
  const domain = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const audioUrl = `${domain}/music/${encodeURIComponent(song.fileName)}`;
  
  const nextSong = musicList[(songIndex + 1) % musicList.length];

  try {
    await ctx.sendChatAction('upload_document');
    return await ctx.replyWithAudio({ url: audioUrl }, {
      caption: `▶️ *SEDANG DIPUTAR*\n\n🎼 *Judul:* ${song.title}\n🔢 *Nomor:* ${song.id}`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('⏹ Stop', 'back_to_main'),
          Markup.button.callback('⏭ Next', `playnext_${nextSong.id}`)
        ],
        [Markup.button.callback('📱 Menu Utama', 'back_to_main')]
      ])
    });
  } catch (error) {
    console.error("Error sending audio:", error);
    return ctx.reply(`❌ Gagal memutar lagu. Pastikan file "${song.fileName}" ada di server dan URL dapat diakses.`);
  }
}

bot.on('text', (ctx) => {
  const input = ctx.message.text.trim();
  if (/^\d+$/.test(input)) {
    return sendMusic(ctx, input);
  }
});

bot.action(/^playnext_(\d+)$/, (ctx) => {
  ctx.answerCbQuery('Memutar lagu berikutnya...');
  return sendMusic(ctx, ctx.match[1]);
});

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      res.status(200).send('Sidhanie is active!');
    }
  } catch (e) {
    res.status(500).send('Server Error');
  }
};
