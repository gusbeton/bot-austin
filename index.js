require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildEmojisAndStickers
  ]
});

// =======================
// ⚙️ CONFIG
// =======================
const CHANNEL_ID = "1496547592622833764";
const VOICE_CHANNEL_ID = "1488854856633680083";

const PANEL_AUTHOR = "BETLEHEM SENJATA";
const LOGO_URL = "https://media.discordapp.net/attachments/1487590787284734143/1492050545219862598/bthl.png";
const FOOTER_TEXT = "Austin • Copyright ©2018 - BTHL";

// =======================
// 💾 DATA
// =======================
function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
    return { weapons: Array.isArray(data.weapons) ? data.weapons : [] };
  } catch (err) {
    console.log("⚠️ Gagal baca data.json:", err.message);
    return { weapons: [] };
  }
}

// =======================
// 😀 EMOJI
// =======================
function getEmojiDisplay(emoji, guild) {
  if (!emoji) return "🔫";

  const match = emoji.match(/\d{15,}/);
  if (match) {
    const emojiObj = guild.emojis.cache.get(match[0]);
    if (emojiObj) return emojiObj.toString();
    return "🔫";
  }

  return emoji; // emoji biasa (unicode)
}

function getEmojiObject(emoji) {
  if (!emoji) return undefined;

  const match = emoji.match(/\d{15,}/);
  if (match) {
    const name = emoji.match(/:(.*?):/)?.[1];
    return { id: match[0], name };
  }

  return emoji;
}

// =======================
// 🎨 EMBED
// =======================
function baseEmbed(guild) {
  return new EmbedBuilder()
    .setFooter({ text: FOOTER_TEXT, iconURL: guild?.iconURL() || undefined })
    .setTimestamp();
}

function errorEmbed(desc, guild) {
  return baseEmbed(guild)
    .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
    .setColor("#ED4245")
    .setTitle("⚠️ Gagal")
    .setDescription(desc);
}

// =======================
// 🔥 AUTO JOIN + AUTO REJOIN VC
// =======================
async function connectToVC() {
  try {
    const vc = await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
    if (!vc || vc.type !== ChannelType.GuildVoice) {
      return console.log("❌ VC tidak ditemukan");
    }

    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    console.log("🎧 Voice aktif 24/7");

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        console.log("🔄 Bot keluar VC, rejoin...");
        try { connection.destroy(); } catch {}
        setTimeout(connectToVC, 3000);
      }
    });
  } catch (err) {
    console.log("❌ Error join VC:", err);
    setTimeout(connectToVC, 5000);
  }
}

// =======================
// 📦 PANEL (TIDAK NYAMPAH)
// =======================
async function sendOrUpdatePanel() {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return console.log("❌ Channel panel tidak ditemukan");

  const guild = channel.guild;
  await guild.emojis.fetch().catch(() => {});

  const data = loadData();

  const list = data.weapons
    .map(w => `${getEmojiDisplay(w.emoji, guild)} • ${w.name}`)
    .join("\n");

  const embed = baseEmbed(guild)
    .setAuthor({ name: PANEL_AUTHOR, iconURL: LOGO_URL })
    .setColor(0x00ffff)
    .setTitle("📦 SYSTEM BETLEHEM")
    .setDescription(
      "> Sistem order senjata otomatis oleh **Marun**.\n\n" +
      "**📌 Cara Order**\n" +
      "> **1.** Klik tombol **PESAN**\n" +
      "> **2.** Pilih senjata\n" +
      "> **3.** Isi jumlah, order langsung masuk ✨"
    )
    .addFields({
      name: "📜 LIST SENJATA",
      value: (list || "Tidak ada data").slice(0, 1024)
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("order")
      .setLabel("PESAN")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Primary)
  );

  // Cari panel berdasarkan judulnya, BUKAN sembarang embed bot
  // (dulu bisa salah meng-edit pesan order jadi panel)
  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const panels = recent
    ? [...recent.filter(m =>
        m.author.id === client.user.id &&
        m.embeds[0]?.author?.name === PANEL_AUTHOR
      ).values()] // urut terbaru dulu
    : [];

  for (const m of panels.slice(1)) {
    await m.delete().catch(() => {});
    console.log(`🧹 Hapus panel duplikat ${m.id}`);
  }

  const payload = { embeds: [embed], components: [row] };

  if (panels[0]) {
    try {
      await panels[0].edit(payload);
      console.log("♻️ Panel di-update");
      return;
    } catch {
      await panels[0].delete().catch(() => {});
    }
  }

  await channel.send(payload);
  console.log("✅ Panel dikirim");
}

// =======================
// 🚀 READY
// =======================
client.once("clientReady", async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  setTimeout(connectToVC, 3000);

  try {
    await sendOrUpdatePanel();
  } catch (err) {
    console.log("❌ Error setup panel:", err);
  }
});

// =======================
// 🎯 INTERACTION
// =======================
client.on("interactionCreate", async (interaction) => {
  const guild = interaction.guild;
  if (!guild) return;

  try {
    // ===== BUTTON =====
    if (interaction.isButton()) {

      // PESAN
      if (interaction.customId === "order") {
        await guild.emojis.fetch().catch(() => {});
        const data = loadData();

        if (!data.weapons.length) {
          return interaction.reply({
            embeds: [errorEmbed("> Daftar senjata kosong, hubungi **ADMIN**.", guild)],
            flags: MessageFlags.Ephemeral
          });
        }

        // dropdown Discord maksimal 25 pilihan
        const options = data.weapons.slice(0, 25).map(w => ({
          label: w.name.slice(0, 100),
          value: w.name.slice(0, 90),
          emoji: getEmojiObject(w.emoji)
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId("pilih_senjata")
          .setPlaceholder("🔫 Pilih senjata...")
          .addOptions(options);

        return interaction.reply({
          embeds: [
            baseEmbed(guild)
              .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
              .setColor(0x00ffff)
              .setTitle("🔫 PILIH SENJATA")
              .setDescription("> Silahkan pilih senjata yang mau kamu order di bawah ini.")
          ],
          components: [new ActionRowBuilder().addComponents(select)],
          flags: MessageFlags.Ephemeral
        });
      }

      // SELESAI
      if (interaction.customId.startsWith("sold_")) {
        // format baru: sold_<userId>_<orderId>
        const parts = interaction.customId.split("_");
        const ownerId = parts.length >= 3 ? parts[1] : null;

        const isOwner = ownerId === interaction.user.id;
        const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);

        if (ownerId && !isOwner && !isStaff) {
          return interaction.reply({
            embeds: [errorEmbed(`> Order ini milik <@${ownerId}>.\n> Hanya pemesan atau staff yang bisa menyelesaikan.`, guild)],
            flags: MessageFlags.Ephemeral
          });
        }

        const msg = interaction.message;

        await interaction.reply({
          embeds: [
            baseEmbed(guild)
              .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
              .setColor("#57F287")
              .setTitle("✅ ORDER SELESAI")
              .setDescription("> Order berhasil ditandai selesai dan akan dihapus.")
          ],
          flags: MessageFlags.Ephemeral
        });

        setTimeout(() => msg.delete().catch(() => {}), 1500);
        return;
      }
    }

    // ===== SELECT MENU =====
    if (interaction.isStringSelectMenu() && interaction.customId === "pilih_senjata") {
      const senjata = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`order_${senjata}`)
        .setTitle(`Order ${senjata}`.slice(0, 45));

      const jumlah = new TextInputBuilder()
        .setCustomId("jumlah")
        .setLabel("Jumlah")
        .setPlaceholder("Contoh: 5")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(4)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(jumlah));

      return interaction.showModal(modal);
    }

    // ===== MODAL SUBMIT =====
    if (interaction.isModalSubmit() && interaction.customId.startsWith("order_")) {
      const senjata = interaction.customId.replace("order_", "");
      const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"), 10);

      await guild.emojis.fetch().catch(() => {});
      const data = loadData();
      const weaponData = data.weapons.find(w => w.name.slice(0, 90) === senjata);

      if (!weaponData || isNaN(jumlah) || jumlah <= 0) {
        return interaction.reply({
          embeds: [errorEmbed("> Data tidak valid. Pastikan jumlah berupa **angka lebih dari 0**.", guild)],
          flags: MessageFlags.Ephemeral
        });
      }

      const orderId = Date.now();

      const embed = baseEmbed(guild)
        .setAuthor({ name: "📦 ORDER BARU", iconURL: LOGO_URL })
        .setColor("#FFD700")
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(
          `**👤 PEMESAN**\n> <@${interaction.user.id}>\n\n` +
          `**${getEmojiDisplay(weaponData.emoji, guild)} SENJATA**\n> ${weaponData.name}\n\n` +
          `**📦 JUMLAH**\n> ${jumlah}\n\n` +
          "━━━━━━━━━━━━━━\n\n" +
          "🟡 **STATUS: PENDING**"
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`sold_${interaction.user.id}_${orderId}`)
          .setLabel("SELESAI")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("order")
          .setLabel("PESAN LAGI")
          .setEmoji("🛒")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [
          baseEmbed(guild)
            .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
            .setColor("#57F287")
            .setTitle("✅ ORDER TERKIRIM")
            .setDescription(`> **${jumlah}x ${weaponData.name}** berhasil diorder!`)
        ],
        flags: MessageFlags.Ephemeral
      });

      await interaction.channel.send({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    console.log("❌ Error interaction:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({
        embeds: [errorEmbed("> Terjadi kendala, silahkan hubungi **ADMIN** ya.", guild)],
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
});

// =======================
// 🛡️ ANTI CRASH
// =======================
process.on("unhandledRejection", err => console.log("Unhandled Rejection:", err));
process.on("uncaughtException", err => console.log("Uncaught Exception:", err));

client.login(process.env.TOKEN);
