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
  StringSelectMenuBuilder
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildEmojisAndStickers
  ]
});

const CHANNEL_ID = "1496547592622833764";
const VOICE_CHANNEL_ID = "1488854856633680083";

let lastOrderMessageId = null;

// =======================
// DATA
// =======================
function loadData() {
  return JSON.parse(fs.readFileSync("./data.json"));
}

// =======================
// EMOJI
// =======================
function getEmojiDisplay(emoji, guild) {
  if (!emoji) return "🔫";

  const match = emoji.match(/\d+/);
  if (match) {
    const emojiObj = guild.emojis.cache.get(match[0]);
    if (emojiObj) return emojiObj.toString();
  }

  return "🔫";
}

function getEmojiObject(emoji) {
  if (!emoji) return undefined;

  const match = emoji.match(/\d+/);
  if (match) {
    const name = emoji.match(/:(.*?):/)?.[1];
    return { id: match[0], name };
  }

  return emoji;
}

// =======================
// READY
// =======================
client.once("ready", async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  // =======================
  // 🔊 AUTO JOIN VOICE
  // =======================
  const voiceChannel = await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);

  if (voiceChannel) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log("🎧 Bot masuk voice (24/7 aktif)");
    });
  }

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return console.log("Channel tidak ditemukan");

  const guild = channel.guild;

  await guild.emojis.fetch();

  const icon = guild.iconURL({ dynamic: true });
  const data = loadData();

  const list = data.weapons
    .map(w => `${getEmojiDisplay(w.emoji, guild)} • ${w.name}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setAuthor({ name: "BETLEHEM SENJATA", iconURL: icon })
    .setDescription(list)
    .setColor(0x00ffff)
    .setFooter({
      text: `${guild.name} • Copyright ©️2018 - BTHL`,
      iconURL: icon
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("order")
      .setLabel("Pesan")
      .setStyle(ButtonStyle.Primary)
  );

  const messages = await channel.messages.fetch({ limit: 10 });

  const panel = messages.find(msg =>
    msg.author.id === client.user.id &&
    msg.embeds.length > 0
  );

  if (panel) {
    await panel.edit({ embeds: [embed], components: [row] });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }
});

// =======================
// AUTO RECONNECT VOICE
// =======================
setInterval(async () => {
  const channel = await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const connection = getVoiceConnection(channel.guild.id);

  if (!connection) {
    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    console.log("🔁 Reconnect voice berhasil");
  }
}, 60 * 1000);

// =======================
// INTERACTION
// =======================
client.on("interactionCreate", async (interaction) => {

  const guild = interaction.guild;
  const icon = guild.iconURL({ dynamic: true });
  const guildName = guild.name;

  if (interaction.isButton()) {

    if (interaction.customId === "order") {

      const data = loadData();

      const options = data.weapons.map(w => ({
        label: w.name,
        value: w.name,
        emoji: getEmojiObject(w.emoji)
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId("pilih")
        .setPlaceholder("Pilih senjata...")
        .addOptions(options);

      const embed = new EmbedBuilder()
        .setAuthor({ name: "PILIH SENJATA", iconURL: icon })
        .setDescription("Silakan pilih senjata yang ingin dipesan")
        .setColor("Blue");

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith("sold_")) {

      await interaction.reply({
        content: "✅ Order selesai...",
        ephemeral: true
      });

      setTimeout(() => {
        interaction.message.delete().catch(() => {});
      }, 1500);
    }
  }

  if (interaction.isStringSelectMenu()) {

    const senjata = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`order_${senjata}`)
      .setTitle(`Order ${senjata}`);

    const jumlah = new TextInputBuilder()
      .setCustomId("jumlah")
      .setLabel("Jumlah")
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(jumlah)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {

    const senjata = interaction.customId.replace("order_", "");
    const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"));

    const data = loadData();
    const weaponData = data.weapons.find(w => w.name === senjata);

    if (!weaponData || isNaN(jumlah) || jumlah <= 0) {
      return interaction.reply({
        content: "❌ Data tidak valid",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: "📦 ORDER BARU", iconURL: icon })
      .setDescription(
`📦 **DETAIL ORDER**

👤 **PEMESAN**
<@${interaction.user.id}>

${getEmojiDisplay(weaponData.emoji, guild)} **SENJATA**
${senjata}

📦 **JUMLAH**
${jumlah}`
      )
      .setColor("#2b2d31")
      .setFooter({
        text: `${guildName} • Menunggu diproses`,
        iconURL: icon
      })
      .setTimestamp();

    const orderId = Date.now();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sold_${orderId}`)
        .setLabel("Selesai")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("order")
        .setLabel("Pesan Lagi")
        .setStyle(ButtonStyle.Primary)
    );

    if (lastOrderMessageId) {
      try {
        const oldMsg = await interaction.channel.messages.fetch(lastOrderMessageId);
        await oldMsg.edit({ components: [] });
      } catch {}
    }

    await interaction.reply({
      content: "✅ Order berhasil dikirim",
      ephemeral: true
    });

    const newMsg = await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });

    lastOrderMessageId = newMsg.id;
  }
});

client.login(process.env.TOKEN);
