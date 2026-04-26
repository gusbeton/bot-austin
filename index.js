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

// =======================
// 📂 DATA
// =======================
function loadData() {
  return JSON.parse(fs.readFileSync("./data.json"));
}

function saveData(data) {
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

// =======================
client.once("ready", () => {
  console.log(`Login sebagai ${client.user.tag}`);
});

// =======================
client.on("interactionCreate", async (interaction) => {

  // =======================
  // 📋 /panel
  // =======================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "panel") {

      const data = loadData();

      const list = data.weapons.map(w =>
        `• ${w.name}`
      ).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🔫 WEAPON STORE")
        .setDescription(list)
        .setColor("Red");

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("order")
          .setLabel("Order")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [btn]
      });
    }
  }

  // =======================
  // 🔘 BUTTON
  // =======================
  if (interaction.isButton()) {

    // ORDER BUTTON
    if (interaction.customId === "order") {

      const data = loadData();

      const options = data.weapons.map(w => ({
        label: w.name,
        value: w.name
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId("pilih_senjata")
        .setPlaceholder("Pilih senjata...")
        .addOptions(options);

      await interaction.reply({
        content: "🔽 Pilih senjata",
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    // DELIVERED
    if (interaction.customId.startsWith("done_")) {

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor("Green")
        .addFields({ name: "Status", value: "✅ Delivered" });

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }

    // SOLD
    if (interaction.customId.startsWith("sold_")) {

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor("Grey")
        .addFields({ name: "Status", value: "❌ Sold / Cancel" });

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }
  }

  // =======================
  // 🔽 SELECT MENU
  // =======================
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "pilih_senjata") {

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
  // 📩 MODAL SUBMIT
  // =======================
  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith("order_")) {

      const senjata = interaction.customId.replace("order_", "");
      const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"));

      let data = loadData();
      const item = data.weapons.find(w => w.name === senjata);

      if (!item) {
        return interaction.reply({
          content: "❌ Senjata tidak ditemukan!",
          ephemeral: true
        });
      }

      if (isNaN(jumlah) || jumlah <= 0) {
        return interaction.reply({
          content: "❌ Jumlah tidak valid!",
          ephemeral: true
        });
      }

      if (jumlah > item.stock) {
        return interaction.reply({
          content: "❌ Barang tidak tersedia!",
          ephemeral: true
        });
      }

      // Kurangi stock
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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`done_${orderId}`)
          .setLabel("Delivered")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`sold_${orderId}`)
          .setLabel("Sold")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: "✅ Order berhasil dikirim!",
        ephemeral: true
      });

      // 👉 ORDER MASUK KE BAWAH
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });
    }
  }
});

client.login(process.env.TOKEN);
