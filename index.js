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

// ⛔ JANGAN DIUBAH (punya lu)
const CHANNEL_ID = "1498061270165884928";

// simpan order terakhir
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
// AUTO PANEL
// =======================
client.once("ready", async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return console.log("Channel tidak ditemukan");

  const messages = await channel.messages.fetch({ limit: 10 });

  const sudahAda = messages.find(msg =>
    msg.author.id === client.user.id &&
    msg.embeds.length > 0 &&
    msg.embeds[0].title === "🔫 WEAPON STORE"
  );

  if (sudahAda) return console.log("Panel sudah ada");

  const data = loadData();
  const list = data.weapons.map(w => `• ${w.name}`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🔫 WEAPON STORE")
    .setDescription(list)
    .setColor("Red");

  const btn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("order")
      .setLabel("Pesan")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [embed],
    components: [btn]
  });
});

// =======================
// INTERACTION
// =======================
client.on("interactionCreate", async (interaction) => {

  // =======================
  // BUTTON
  // =======================
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

      await interaction.reply({
        content: "🔽 Pilih senjata",
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // SELESAI (FINAL FIX)
    if (interaction.customId.startsWith("sold_")) {

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor("Grey")
        .addFields({ name: "Status", value: "✅ Selesai" });

      await interaction.update({
        embeds: [embed],
        components: [] // 🔥 HAPUS SEMUA BUTTON
      });
    }
  }

  // =======================
  // SELECT MENU
  // =======================
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "pilih") {

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
  }

  // =======================
  // MODAL SUBMIT
  // =======================
  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith("order_")) {

      const senjata = interaction.customId.replace("order_", "");
      const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"));

      let data = loadData();
      const item = data.weapons.find(w => w.name === senjata);

      if (!item || jumlah > item.stock) {
        return interaction.reply({
          content: "❌ Barang tidak tersedia",
          ephemeral: true
        });
      }

      if (isNaN(jumlah) || jumlah <= 0) {
        return interaction.reply({
          content: "❌ Jumlah tidak valid",
          ephemeral: true
        });
      }

      item.stock -= jumlah;
      saveData(data);

      const orderId = Date.now();

      const embed = new EmbedBuilder()
        .setTitle("📦 ORDER BARU")
        .addFields(
          { name: "👤 Pemesan", value: `<@${interaction.user.id}>` },
          { name: "🔫 Senjata", value: senjata },
          { name: "📦 Jumlah", value: `${jumlah}` }
        )
        .setColor("Yellow");

      // tombol order baru
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

      // =======================
      // EDIT ORDER LAMA (hapus Pesan Lagi)
      // =======================
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

          await oldMsg.edit({
            components: [oldRow]
          });

        } catch (err) {
          console.log("Gagal edit order lama");
        }
      }

      await interaction.reply({
        content: "✅ Order dikirim",
        ephemeral: true
      });

      const newMsg = await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      lastOrderMessageId = newMsg.id;
    }
  }
});

client.login(process.env.TOKEN);
