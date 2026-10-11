import { createBot } from "@aiogram/tgcloud-grammy/grammy";

export const bot = createBot();

bot.command("start", async (ctx) => {
  if (ctx.chat.type !== "private") {
    await ctx.reply("Відкрийте картки через кнопку меню в приватному чаті.");
    return;
  }

  const menu = await ctx.api.getChatMenuButton({ chat_id: ctx.chat.id });
  if (menu.type === "web_app") {
    await ctx.reply("Привіт! Тут німецькі картки: займенники, числа й перші слова.", {
      reply_markup: {
        inline_keyboard: [[{ text: "Відкрити картки", web_app: { url: menu.web_app.url } }]],
      },
    });
    return;
  }

  await ctx.reply("Застосунок відкривається кнопкою меню біля поля вводу.");
});
