const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * FUNGSI DYNAMIS: Membaca Folder Music
 * Menggunakan kombinasi __dirname dan process.cwd untuk memastikan folder terbaca di Vercel
 */
const getDynamicMusicList = () => {
  // Mencoba beberapa kemungkinan path folder music di Vercel
  const pathsToTry = [
    path.join(process.cwd(), 'public', 'music'),
    path.join(__dirname, '..', 'public', 'music'),
    path.join('/var/task', 'public', 'music')
  ];

  let musicDir = '';
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      musicDir = p;
      break;
    }
  }
  
  try {
    if (!musicDir) {
      console.error("DEBUG: Folder music TIDAK ditemukan di path manapun.");
      return [];
    }

    const files = fs.readdirSync(musicDir)
      .filter(file => file.toLowerCase().endsWith('.mp3'))
      .sort();
    
    return files.map(file => {
      const songId = file.match(/^\d+/)?.[0] || "00";
      const cleanTitle = file
        .replace(/\.[^/.]+$/, "")
        .replace(/^\d+[._-]?/, '')
        .replace(/[._-]/g, ' ')
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

// --- MENU UTAMA ---
const sendMainMenu = (ctx) => {
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
        Markup.button.url('🎧 SPOTIFY', 'https://open.spotify.com/user/sidhanie')
      ],
      [Markup.button.callback('🛡️ PRIVACY POLICY', 'show_privacy')]
    ])
  );
};

bot.start((ctx) => sendMainMenu(ctx));

// --- HANDLER: DAFTAR MUSIK ---
bot.action('show_list', (ctx) => {
  const musicList = getDynamicMusicList();
  if (musicList.length === 0) {
    ctx.answerCbQuery();
    return ctx.reply("❌ Koleksi musik belum terdeteksi. Pastikan folder 'public/music' berisi file .mp3 dan sudah di-push ke GitHub.");
  }

  let message = "🎵 *Daftar Musik Sidhanie:*\n\n";
  musicList.forEach(item => {
    message += `*${item.id}*. ${item.title}\n`;
  });
  message += "\n_Ketik nomor urut untuk memutar musik._";

  ctx.answerCbQuery();
  return ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'back_to_main')]])
  }).catch(() => ctx.replyWithMarkdown(message));
});

// --- HANDLER: PRIVACY POLICY & LAINNYA ---
bot.action('show_privacy', (ctx) => {
  const privacyText = `🛡️ *Privacy Policy - Sidhanie*\n\n1. Media Player ini tidak menyimpan data pribadi.\n2. Hak cipta milik artis Sidhanie.\n\n📞 *Admin:* @sidhanie06`;
  ctx.answerCbQuery();
  return ctx.editMessageText(privacyText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Kembali', 'back_to_main')]])
  }).catch(() => ctx.replyWithMarkdown(privacyText));
});

bot.action('back_to_main', (ctx) => {
  ctx.answerCbQuery();
  ctx.deleteMessage().catch(() => {});
  return sendMainMenu(ctx);
});

// --- LOGIKA PEMUTAR MUSIK ---
async function playMusic(ctx, songId) {
  const musicList = getDynamicMusicList();
  const songIndex = musicList.findIndex(s => parseInt(s.id) === parseInt(songId));
  const song = musicList[songIndex];

  if (!song) return ctx.reply(`❌ Nomor ${songId} tidak ditemukan.`);

  // Gunakan host dinamis agar tidak 404
  const host = ctx.headers ? ctx.headers.host : process.env.VERCEL_URL;
  const audioUrl = `https://${host}/music/${encodeURIComponent(song.fileName)}`;
  
  const nextSong = musicList[(songIndex + 1) % musicList.length];

  try {
    await ctx.sendChatAction('upload_document');
    return await ctx.replyWithAudio({ url: audioUrl }, {
      title: song.title,
      performer: "Sidhanie Player",
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
    return ctx.reply(`❌ Gagal memutar. Pastikan link ini bisa dibuka di browser: ${audioUrl}`);
  }
}

bot.on('text', (ctx) => {
  const input = ctx.message.text.trim();
  if (/^\d+$/.test(input)) return playMusic(ctx, input);
});

bot.action(/^playnext_(\d+)$/, (ctx) => {
  ctx.answerCbQuery('Memutar lagu berikutnya...');
  return playMusic(ctx, ctx.match[1]);
});

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      res.status(200).send('Sidhanie is Active!');
    }
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
