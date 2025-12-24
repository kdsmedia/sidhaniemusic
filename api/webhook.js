const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * FUNGSI DYNAMIS: Membaca Folder Music
 * File dibaca dari folder /public/music
 */
const getDynamicMusicList = () => {
  const musicDir = path.join(process.cwd(), 'public', 'music');
  
  try {
    if (!fs.existsSync(musicDir)) {
      console.error("DEBUG: Folder music tidak ditemukan di path:", musicDir);
      return [];
    }

    const files = fs.readdirSync(musicDir)
      .filter(file => file.toLowerCase().endsWith('.mp3'))
      .sort();
    
    return files.map(file => {
      // Mengambil angka di awal file sebagai ID (Contoh: "01")
      const songId = file.match(/^\d+/)?.[0] || "00";
      
      // Membersihkan nama file untuk Judul
      const cleanTitle = file
        .replace(/\.[^/.]+$/, "")   // Hapus ekstensi .mp3
        .replace(/^\d+[._-]?/, '')  // Hapus "01." atau "01_" di depan
        .replace(/[._-]/g, ' ')     // Ganti titik, underscore, atau dash dengan spasi
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
        Markup.button.url('🎧 SPOTIFY', 'https://spotify.com')
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
    return ctx.reply("❌ Koleksi musik tidak ditemukan di server. Pastikan folder 'public/music' berisi file .mp3.");
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

// --- HANDLER: PRIVACY POLICY ---
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

  if (!song) {
    return ctx.reply(`❌ Nomor ${songId} tidak ditemukan.`);
  }

  // Menggunakan host dari request headers agar URL selalu sinkron dengan domain Vercel
  const host = ctx.headers ? ctx.headers.host : (process.env.VERCEL_URL || 'sidhaniemusic.vercel.app');
  const audioUrl = `https://${host}/music/${encodeURIComponent(song.fileName)}`;
  
  const nextSong = musicList[(songIndex + 1) % musicList.length];

  try {
    await ctx.sendChatAction('upload_document');
    
    // Kirim Audio dengan metadata lengkap agar suara muncul dan player bekerja
    return await ctx.replyWithAudio({ url: audioUrl }, {
      title: song.title,
      performer: "Sidhanie Music",
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
    console.error("Error mengirim audio:", error);
    return ctx.reply(`❌ Gagal memutar lagu. Link file mungkin bermasalah atau ukuran terlalu besar.\n\nCoba cek manual: ${audioUrl}`);
  }
}

// Handler input teks nomor
bot.on('text', (ctx) => {
  const input = ctx.message.text.trim();
  if (/^\d+$/.test(input)) {
    return playMusic(ctx, input);
  }
});

// Handler tombol Next
bot.action(/^playnext_(\d+)$/, (ctx) => {
  ctx.answerCbQuery('Memutar lagu berikutnya...');
  return playMusic(ctx, ctx.match[1]);
});

// Ekspor untuk Vercel Serverless Function
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      res.status(200).send('Sidhanie Bot is Online!');
    }
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).send('Server Error');
  }
};
