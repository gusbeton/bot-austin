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

const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CHANNEL_ID = "1498061270165884928";

let lastOrderMessageId = null;

// =======================
// DATA
// =======================
function loadData() {
  return JSON.parse(fs.readFileSync("./data.json"));
}

function saveData(data) {
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

// =======================
// READY (AUTO PANEL EDIT)
// =======================
client.once("ready", async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return console.log("Channel tidak ditemukan");

  const guild = channel.guild;
  const icon = guild.iconURL({ dynamic: true });

  const data = loadData();
  const list = data.weapons.map(w => `• ${w.name}`).join("\n");

  const embed = new EmbedBuilder()
    .setAuthor({ name: "BETLEHEM SENJATA", iconURL: icon })
    .setDescription(list)
    .setColor("Red")
    .setFooter({
      text: `${guild.name} • Weapon Store`,
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
// INTERACTION
// =======================
client.on("interactionCreate", async (interaction) => {

  const icon = interaction.guild.iconURL({ dynamic: true });
  const guildName = interaction.guild.name;

  // BUTTON
  if (interaction.isButton()) {

    // PESAN
    if (interaction.customId === "order") {

      const data = loadData();

      const options = data.weapons.map(w => ({
        label: w.name,
        value: w.name
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId("pilih")
        .setPlaceholder("Pilih senjata...")
        .addOptions(options);

      const embed = new EmbedBuilder()
        .setAuthor({ name: "PILIH SENJATA", iconURL: icon })
        .setDescription("Silakan pilih senjata yang ingin dipesan")
        .setColor("Blue")
        .setFooter({
          text: `${guildName} • Weapon System`,
          iconURL: icon
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // SELESAI
    if (interaction.customId.startsWith("sold_")) {

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor("Grey")
        .addFields({ name: "Status", value: "✅ Selesai" })
        .setFooter({
          text: `${guildName} • Order selesai`,
          iconURL: icon
        })
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  }

  // SELECT
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

  // MODAL
  if (interaction.isModalSubmit()) {

    const icon = interaction.guild.iconURL({ dynamic: true });
    const guildName = interaction.guild.name;

    const senjata = interaction.customId.replace("order_", "");
    const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"));

    let data = loadData();
    const item = data.weapons.find(w => w.name === senjata);

    if (!item || jumlah > item.stock) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription("❌ Barang tidak tersedia")
            .setFooter({ text: guildName, iconURL: icon })
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    if (isNaN(jumlah) || jumlah <= 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription("❌ Jumlah tidak valid")
            .setFooter({ text: guildName, iconURL: icon })
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    item.stock -= jumlah;
    saveData(data);

    const orderId = Date.now();

    const embed = new EmbedBuilder()
      .setAuthor({ name: "ORDER BARU", iconURL: icon })
      .addFields(
        { name: "👤 Pemesan", value: `<@${interaction.user.id}>` },
        { name: "🔫 Senjata", value: senjata },
        { name: "📦 Jumlah", value: `${jumlah}` }
      )
      .setColor("Yellow")
      .setFooter({
        text: `${guildName} • Menunggu diproses`,
        iconURL: icon
      })
      .setTimestamp();

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

    // EDIT ORDER LAMA
    if (lastOrderMessageId) {
      try {
        const oldMsg = await interaction.channel.messages.fetch(lastOrderMessageId);

        const oldId = oldMsg.components[0]?.components[0]?.customId?.split("_")[1];

        const oldRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`sold_${oldId}`)
            .setLabel("Selesai")
            .setStyle(ButtonStyle.Danger)
        );

        await oldMsg.edit({ components: [oldRow] });

      } catch {}
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("Green")
          .setDescription("✅ Order berhasil dikirim")
          .setFooter({
            text: `${guildName} • System`,
            iconURL: icon
          })
          .setTimestamp()
      ],
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
