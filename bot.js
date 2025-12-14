require("./uptime");
const { Telegraf } = require("telegraf");
const express = require("express");
const { Pool } = require("pg");
const OpenAI = require("openai");
const ms = require("ms");
const { GoogleGenAI } = require("@google/genai");

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Gemini AI - the newest model is "gemini-2.5-flash"
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS active_users (
            user_id BIGINT PRIMARY KEY,
            first_seen TIMESTAMP DEFAULT NOW(),
            last_seen TIMESTAMP DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS banned_users (
            user_id BIGINT PRIMARY KEY,
            banned_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

async function trackUser(userId) {
    await pool.query(`
        INSERT INTO active_users (user_id, last_seen)
        VALUES ($1, NOW())
        ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW()
    `, [userId]);
}

async function getActiveUserCount() {
    const result = await pool.query(`SELECT COUNT(*) FROM active_users`);
    return result.rows[0].count;
}

async function getAllActiveUsers() {
    const result = await pool.query(`SELECT user_id FROM active_users`);
    return result.rows.map(r => r.user_id);
}

async function banUser(userId) {
    await pool.query(`INSERT INTO banned_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
}

async function unbanUser(userId) {
    await pool.query(`DELETE FROM banned_users WHERE user_id = $1`, [userId]);
}

async function isUserBanned(userId) {
    const result = await pool.query(`SELECT 1 FROM banned_users WHERE user_id = $1`, [userId]);
    return result.rows.length > 0;
}

async function getAllBannedUsers() {
    const result = await pool.query(`SELECT user_id FROM banned_users`);
    return result.rows.map(r => r.user_id);
}

initDatabase().catch(console.error);

const app = express();
const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => {
    res.send("Bot is running!");
});
app.listen(PORT, () => {
    console.log("Uptime server running on port " + PORT);
});

if (!process.env.BOT_TOKEN) {
    console.error("ERROR: BOT_TOKEN environment variable is not set!");
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

let botActive = true;

const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;
let users = new Set();

function isAdmin(ctx) {
    return ctx.from.id === ADMIN_ID;
}

bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id) {
        users.add(ctx.from.id);
    }
    return next();
});

const commands = {
    start: "Start the bot",
    help: "Show help info",
    menu: "Show full command list",
    ping: "Check bot speed",
    time: "Get current time",
    date: "Get today's date",
    id: "Get your Telegram ID",
    math: "Random math fact",
    joke: "Random joke",
    fact: "Random fact",
    quote: "Random quote",
    alive: "Check if bot is alive",
    echo: "Repeat your message",
    reverse: "Reverse text",
    upper: "Text to uppercase",
    lower: "Text to lowercase",
    avatar: "Get your profile photo",
    random: "Random number",
    roll: "Dice roll",
    flip: "Coin flip",
    choose: "Let bot choose between words",
    love: "Love percentage",
    hack: "Fake hack",
    vibe: "Random vibe check",
    emoji: "Random emoji",
    calc: "Simple calculator",
    weather: "Fake weather",
    ip: "Fake IP check",
    about: "About the bot",
    owner: "Bot owner info",
    roast: "Roast someone",
    bless: "Bless someone",
    cat: "Random cat",
    dog: "Random dog",
    anime: "Random anime quote",
    game: "Random game name",
    movie: "Random movie name",
    rate: "Rate anything",
    ask: "Ask the bot anything",
    secret: "Random secret",
    active: "Show active users count",
    shutdown: "Shutdown bot (Admin only)",
    broadcast: "Send message to all users (Admin)",
    ban: "Ban a user (Admin only)",
    unban: "Unban a user (Admin only)",
    kick: "Kick a user (Admin only)",
    listbanned: "List banned users (Admin only)",
    poweron: "Check if bot is running (Admin only)",
    stats: "Bot stats (Admin only)",
    clear: "Delete last 5 messages (Admin only)",
    trt: "Translate message to English (reply to msg)",
    short: "Shorten a URL",
    tagall: "Tag everyone (Admin only)",
    mute: "Timed mute (e.g., /mute 10m) (Admin only)",
    unmute: "Unmute a user (Admin only, reply to msg)",
    animeclips: "Get anime clips link"
};

function generateMenu() {
    let msg = "📜 *BOT COMMANDS*\n\n";
    Object.keys(commands).forEach(c => {
        msg += `/${c} - ${commands[c]}\n`;
    });
    return msg;
}

bot.start(ctx => ctx.reply("🔥 Bot started! Use /menu to view all commands."));
bot.help(ctx => ctx.reply("Use /menu to see the full list of commands."));
bot.command("menu", ctx => ctx.replyWithMarkdown(generateMenu()));

bot.command("ping", ctx => ctx.reply("🏓 Pong!"));
bot.command("time", ctx => ctx.reply(new Date().toLocaleTimeString()));
bot.command("date", ctx => ctx.reply(new Date().toDateString()));
bot.command("id", ctx => ctx.reply(`🪪 Your ID: ${ctx.from.id}`));
bot.command("math", ctx => ctx.reply("➗ Math fact: Zero is the only number that can't be divided."));
bot.command("joke", ctx => ctx.reply("😂 Why don't robots panic? Because they have nerves of steel."));
bot.command("fact", ctx => ctx.reply("📘 Fact: Honey never spoils."));
bot.command("quote", ctx => ctx.reply("💬 'Stay hungry, stay foolish.'"));
bot.command("alive", ctx => ctx.reply("🔥 I'm alive boss!"));
bot.command("echo", ctx => ctx.reply(ctx.message.text.replace("/echo ", "")));

bot.command("reverse", ctx => {
    const t = ctx.message.text.replace("/reverse ", "");
    ctx.reply(t.split("").reverse().join(""));
});
bot.command("upper", ctx => ctx.reply(ctx.message.text.replace("/upper ", "").toUpperCase()));
bot.command("lower", ctx => ctx.reply(ctx.message.text.replace("/lower ", "").toLowerCase()));
bot.command("avatar", ctx => ctx.reply("⚠️ Telegram doesn't allow fetching profile pics via bot."));
bot.command("random", ctx => ctx.reply("🎲 " + Math.floor(Math.random() * 100)));
bot.command("roll", ctx => ctx.reply("🎲 You rolled: " + (1 + Math.floor(Math.random() * 6))));
bot.command("flip", ctx => ctx.reply(["🪙 Heads!", "🪙 Tails!"][Math.floor(Math.random()*2)]));
bot.command("choose", ctx => {
    const parts = ctx.message.text.replace("/choose ", "").split(" ");
    ctx.reply("🤖 I choose: " + parts[Math.floor(Math.random() * parts.length)]);
});
bot.command("love", ctx => ctx.reply("❤️ Love level: " + Math.floor(Math.random() * 100) + "%"));
bot.command("hack", ctx => ctx.reply("💻 Hacking... 0% ▓▓▓▓ 100% DONE 😂"));
bot.command("vibe", ctx => ctx.reply("💫 Vibe: " + ["Chill", "Angry", "Happy", "Tired"][Math.floor(Math.random()*4)]));
bot.command("emoji", ctx => ctx.reply(["😀","🔥","⚡","💀","💎","👻","🤖"][Math.floor(Math.random()*7)]));
bot.command("calc", ctx => {
    try {
        const expr = ctx.message.text.replace("/calc ", "");
        const safeExpr = expr.replace(/[^0-9+\-*/().]/g, '');
        ctx.reply("🧮 Result: " + eval(safeExpr));
    } catch {
        ctx.reply("❌ Invalid expression.");
    }
});
bot.command("weather", ctx => ctx.reply("🌤️ Weather: Sunny 29°C"));
bot.command("ip", ctx => ctx.reply("🌍 Fake IP: 192.168.0." + Math.floor(Math.random()*255)));
bot.command("about", ctx => ctx.reply("🤖 A multipurpose Telegram bot made by you."));
bot.command("owner", ctx => ctx.reply("👑 Owner: YOU!"));
bot.command("roast", ctx => ctx.reply("🔥 You look like WiFi with weak signal 😂"));
bot.command("bless", ctx => ctx.reply("✨ You are blessed bro."));
bot.command("cat", ctx => ctx.reply("🐱 Meow! (image coming soon)"));
bot.command("dog", ctx => ctx.reply("🐶 Woof!"));
bot.command("anime", ctx => ctx.reply("🎌 'People die if they are killed.' – Shirou"));
bot.command("game", ctx => ctx.reply("🎮 Random game: Apex Legends"));
bot.command("movie", ctx => ctx.reply("🎬 Movie: Interstellar"));
bot.command("rate", ctx => {
    const t = ctx.message.text.replace("/rate ", "");
    ctx.reply(`⭐ I rate *${t}* — ${Math.floor(Math.random()*10)}/10`);
});
bot.command("ask", async (ctx) => {
    try {
        const question = ctx.message.text.split(" ").slice(1).join(" ");
        if (!question) return ctx.reply("❌ Usage: /ask [your question]");

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: question,
        });

        const answer = response.text || "Sorry, I couldn't generate a response.";
        ctx.reply(answer);

    } catch (err) {
        console.error("AI /ask error:", err);
        ctx.reply("⚠️ Sorry, something went wrong. Try again later.");
    }
});
bot.command("secret", ctx => ctx.reply("🤫 Secret: You are awesome. Don't tell anyone."));

bot.command("active", (ctx) => {
    const activeUsers = Array.from(users).join("\n");
    if (activeUsers.length === 0) return ctx.reply("❌ No active users.");
    ctx.reply(`👥 Active users:\n${activeUsers}`);
});

bot.command("shutdown", (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    botActive = false;
    ctx.reply("⚠️ Bot is now OFF. Use /poweron to turn it back ON.");
});

bot.command("broadcast", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const msg = ctx.message.text.replace("/broadcast ", "");
    if (!msg || msg === "/broadcast") return ctx.reply("❌ Specify a message: /broadcast <message>");
    const users = await getAllActiveUsers();
    let sent = 0;
    for (const userId of users) {
        try {
            await ctx.telegram.sendMessage(userId, `📢 Admin broadcast:\n${msg}`);
            sent++;
        } catch (e) {}
    }
    ctx.reply(`✅ Broadcast sent to ${sent} users!`);
});

bot.command("ban", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const userId = parseInt(ctx.message.text.replace("/ban ", ""));
    if (!userId) return ctx.reply("❌ Specify a user ID: /ban <id>");
    await banUser(userId);
    ctx.reply(`🚫 User ${userId} is now banned.`);
});

bot.command("unban", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const userId = parseInt(ctx.message.text.replace("/unban ", ""));
    if (!userId) return ctx.reply("❌ Specify a user ID: /unban <id>");
    await unbanUser(userId);
    ctx.reply(`✅ User ${userId} is now unbanned.`);
});

bot.command("kick", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    
    let userId;
    if (ctx.message.reply_to_message) {
        userId = ctx.message.reply_to_message.from.id;
    } else {
        userId = parseInt(ctx.message.text.split(" ")[1]);
    }
    
    if (!userId) return ctx.reply("❌ Reply to a user or specify user ID: /kick <id>");
    
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, userId);
        await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
        ctx.reply(`👢 User ${userId} has been kicked from the group.`);
    } catch (err) {
        console.error("Kick error:", err);
        ctx.reply("❌ Failed to kick user. Make sure I'm an admin with ban permissions.");
    }
});

bot.command("listbanned", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const banned = await getAllBannedUsers();
    ctx.reply(`🚫 Banned users:\n${banned.join("\n") || "None"}`);
});

bot.command("poweron", (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    botActive = true;
    ctx.reply("⚡ Bot is now ON ✅");
});

bot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ You are not authorized.");
    const count = await getActiveUserCount();
    ctx.reply(`📊 BOT STATS\nUsers: ${count}\nStatus: ${botActive ? "ON" : "OFF"}`);
});

bot.command("clear", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const chatId = ctx.chat.id;
    for (let i = 0; i < 5; i++) {
        try {
            await ctx.telegram.deleteMessage(chatId, ctx.message.message_id - i);
        } catch {}
    }
});

bot.command("trt", async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply("❌ Reply to a message to translate it.");
    }

    const originalText = ctx.message.reply_to_message.text;

    if (!originalText) {
        return ctx.reply("❌ That message has no text to translate.");
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Translate the following text to English. Only return the translation, nothing else:\n\n${originalText}`,
        });

        const translated = response.text || "Translation failed.";

        ctx.reply(`🇬🇧 *Translation:*\n${translated}`, {
            parse_mode: "Markdown"
        });

    } catch (err) {
        console.error("Translate error:", err);
        ctx.reply("⚠️ Translation failed.");
    }
});

bot.command("short", (ctx) => {
    const url = ctx.message.text.split(" ")[1];
    if (!url) return ctx.reply("❌ Usage: /short https://example.com");
    ctx.reply(`🔗 Shortened:\nhttps://tinyurl.com/api-create.php?url=${url}`);
});

bot.command("tagall", (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.reply("📣 @everyone");
});

bot.command("mute", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ Admin only");

    if (!ctx.message.reply_to_message)
        return ctx.reply("❌ Reply to a user to mute");

    const userId = ctx.message.reply_to_message.from.id;
    const muteTime = ctx.message.text.split(" ")[1];

    if (!muteTime || isNaN(ms(muteTime))) {
        return ctx.reply("❌ Usage: /mute [duration] (e.g., /mute 10m)");
    }

    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
            permissions: { can_send_messages: false }
        });

        ctx.reply(`🔇 User muted for ${muteTime}`);

        setTimeout(async () => {
            await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
                permissions: { can_send_messages: true }
            });
            ctx.reply(`🔊 User unmuted after ${muteTime}`);
        }, ms(muteTime));
    } catch (err) {
        console.error("Mute error:", err);
        ctx.reply("❌ Failed to mute user");
    }
});

bot.command("unmute", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("❌ Admin only");

    if (!ctx.message.reply_to_message)
        return ctx.reply("❌ Reply to the user you want to unmute");

    const userId = ctx.message.reply_to_message.from.id;

    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
            permissions: {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true
            }
        });
        ctx.reply("🔊 User unmuted");
    } catch (err) {
        console.error("Unmute error:", err);
        ctx.reply("❌ Failed to unmute user");
    }
});

bot.command("animeclips", (ctx) => {
    ctx.reply("🔥 Check out anime clips here: https://hiitwixtor.com/");
});

bot.on("text", async (ctx) => {
    if (!botActive && !isAdmin(ctx)) return;
    if (await isUserBanned(ctx.from.id)) return;
    trackUser(ctx.from.id).catch(console.error);
});

// Inline Mode - allows bot to respond in any chat via @botname query
bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.trim().toLowerCase();
    const results = [];

    if (!query) {
        results.push({
            type: "article",
            id: "help",
            title: "How to use inline mode",
            description: "Type: joke, fact, quote, flip, roll, ask [question], and more!",
            input_message_content: { message_text: "📖 Inline commands:\njoke, fact, quote, flip, roll, random, vibe, emoji, ping, time, date, math, alive, hack, weather, ip, about, owner, cat, dog, game, movie, secret, anime, animeclips, roast, bless\n\nWith text: ask [q], love [name], echo [text], reverse [text], upper [text], lower [text], choose [words], calc [expr], rate [thing], short [url]" }
        });
    } else if (query === "joke") {
        results.push({
            type: "article",
            id: "joke",
            title: "😂 Get a Joke",
            description: "Click to send a joke",
            input_message_content: { message_text: "😂 Why don't robots panic? Because they have nerves of steel." }
        });
    } else if (query === "fact") {
        results.push({
            type: "article",
            id: "fact",
            title: "📘 Get a Fact",
            description: "Click to send a fact",
            input_message_content: { message_text: "📘 Fact: Honey never spoils." }
        });
    } else if (query === "quote") {
        results.push({
            type: "article",
            id: "quote",
            title: "💬 Get a Quote",
            description: "Click to send a quote",
            input_message_content: { message_text: "💬 'Stay hungry, stay foolish.'" }
        });
    } else if (query === "flip") {
        const result = Math.random() < 0.5 ? "🪙 Heads!" : "🪙 Tails!";
        results.push({
            type: "article",
            id: "flip-" + Date.now(),
            title: "🪙 Flip a Coin",
            description: "Click to flip",
            input_message_content: { message_text: result }
        });
    } else if (query === "roll") {
        const roll = 1 + Math.floor(Math.random() * 6);
        results.push({
            type: "article",
            id: "roll-" + Date.now(),
            title: "🎲 Roll a Dice",
            description: "Click to roll",
            input_message_content: { message_text: "🎲 You rolled: " + roll }
        });
    } else if (query === "random") {
        const num = Math.floor(Math.random() * 100);
        results.push({
            type: "article",
            id: "random-" + Date.now(),
            title: "🎲 Random Number",
            description: "Click to get a random number",
            input_message_content: { message_text: "🎲 " + num }
        });
    } else if (query === "vibe") {
        const vibes = ["Chill", "Angry", "Happy", "Tired", "Excited", "Mysterious"];
        const vibe = vibes[Math.floor(Math.random() * vibes.length)];
        results.push({
            type: "article",
            id: "vibe-" + Date.now(),
            title: "💫 Vibe Check",
            description: "Click to check your vibe",
            input_message_content: { message_text: "💫 Vibe: " + vibe }
        });
    } else if (query === "emoji") {
        const emojis = ["😀","🔥","⚡","💀","💎","👻","🤖","🎉","💯","🌟"];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        results.push({
            type: "article",
            id: "emoji-" + Date.now(),
            title: "🎭 Random Emoji",
            description: "Click to get a random emoji",
            input_message_content: { message_text: emoji }
        });
    } else if (query.startsWith("love")) {
        const name = query.replace("love", "").trim() || "someone";
        const percent = Math.floor(Math.random() * 100);
        results.push({
            type: "article",
            id: "love-" + Date.now(),
            title: "❤️ Love Calculator",
            description: `Check love level for ${name}`,
            input_message_content: { message_text: `❤️ Love level for ${name}: ${percent}%` }
        });
    } else if (query.startsWith("ask ")) {
        const question = query.replace("ask ", "").trim();
        if (question) {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: question,
                });
                const answer = response.text || "Sorry, I couldn't generate a response.";
                results.push({
                    type: "article",
                    id: "ask-" + Date.now(),
                    title: "🤖 AI Answer",
                    description: answer.substring(0, 100) + "...",
                    input_message_content: { message_text: answer }
                });
            } catch (err) {
                results.push({
                    type: "article",
                    id: "ask-error",
                    title: "⚠️ AI Error",
                    description: "Something went wrong",
                    input_message_content: { message_text: "⚠️ Sorry, something went wrong. Try again later." }
                });
            }
        }
    } else if (query === "roast") {
        results.push({
            type: "article",
            id: "roast",
            title: "🔥 Roast",
            description: "Click to send a roast",
            input_message_content: { message_text: "🔥 You look like WiFi with weak signal 😂" }
        });
    } else if (query === "bless") {
        results.push({
            type: "article",
            id: "bless",
            title: "✨ Blessing",
            description: "Click to send a blessing",
            input_message_content: { message_text: "✨ You are blessed bro." }
        });
    } else if (query === "anime") {
        results.push({
            type: "article",
            id: "anime",
            title: "🎌 Anime Quote",
            description: "Click to send an anime quote",
            input_message_content: { message_text: "🎌 'People die if they are killed.' – Shirou" }
        });
    } else if (query === "ping") {
        results.push({
            type: "article",
            id: "ping",
            title: "🏓 Ping",
            description: "Click to send pong",
            input_message_content: { message_text: "🏓 Pong!" }
        });
    } else if (query === "time") {
        results.push({
            type: "article",
            id: "time-" + Date.now(),
            title: "🕐 Current Time",
            description: "Click to send current time",
            input_message_content: { message_text: "🕐 " + new Date().toLocaleTimeString() }
        });
    } else if (query === "date") {
        results.push({
            type: "article",
            id: "date-" + Date.now(),
            title: "📅 Today's Date",
            description: "Click to send today's date",
            input_message_content: { message_text: "📅 " + new Date().toDateString() }
        });
    } else if (query === "math") {
        results.push({
            type: "article",
            id: "math",
            title: "➗ Math Fact",
            description: "Click to send a math fact",
            input_message_content: { message_text: "➗ Math fact: Zero is the only number that can't be divided." }
        });
    } else if (query === "alive") {
        results.push({
            type: "article",
            id: "alive",
            title: "🔥 Alive Check",
            description: "Click to confirm bot is alive",
            input_message_content: { message_text: "🔥 I'm alive boss!" }
        });
    } else if (query.startsWith("echo ")) {
        const text = query.replace("echo ", "");
        results.push({
            type: "article",
            id: "echo-" + Date.now(),
            title: "📢 Echo",
            description: `Echo: ${text}`,
            input_message_content: { message_text: text }
        });
    } else if (query.startsWith("reverse ")) {
        const text = query.replace("reverse ", "");
        const reversed = text.split("").reverse().join("");
        results.push({
            type: "article",
            id: "reverse-" + Date.now(),
            title: "🔄 Reverse Text",
            description: `Reversed: ${reversed}`,
            input_message_content: { message_text: reversed }
        });
    } else if (query.startsWith("upper ")) {
        const text = query.replace("upper ", "").toUpperCase();
        results.push({
            type: "article",
            id: "upper-" + Date.now(),
            title: "🔠 Uppercase",
            description: text,
            input_message_content: { message_text: text }
        });
    } else if (query.startsWith("lower ")) {
        const text = query.replace("lower ", "").toLowerCase();
        results.push({
            type: "article",
            id: "lower-" + Date.now(),
            title: "🔡 Lowercase",
            description: text,
            input_message_content: { message_text: text }
        });
    } else if (query.startsWith("choose ")) {
        const parts = query.replace("choose ", "").split(" ");
        const choice = parts[Math.floor(Math.random() * parts.length)];
        results.push({
            type: "article",
            id: "choose-" + Date.now(),
            title: "🤖 Choose",
            description: `I choose: ${choice}`,
            input_message_content: { message_text: "🤖 I choose: " + choice }
        });
    } else if (query === "hack") {
        results.push({
            type: "article",
            id: "hack",
            title: "💻 Fake Hack",
            description: "Click to send fake hack",
            input_message_content: { message_text: "💻 Hacking... 0% ▓▓▓▓ 100% DONE 😂" }
        });
    } else if (query.startsWith("calc ")) {
        try {
            const expr = query.replace("calc ", "");
            const safeExpr = expr.replace(/[^0-9+\-*/().]/g, '');
            const result = eval(safeExpr);
            results.push({
                type: "article",
                id: "calc-" + Date.now(),
                title: "🧮 Calculator",
                description: `Result: ${result}`,
                input_message_content: { message_text: "🧮 Result: " + result }
            });
        } catch {
            results.push({
                type: "article",
                id: "calc-error",
                title: "❌ Invalid Expression",
                description: "Could not calculate",
                input_message_content: { message_text: "❌ Invalid expression." }
            });
        }
    } else if (query === "weather") {
        results.push({
            type: "article",
            id: "weather",
            title: "🌤️ Weather",
            description: "Click to send weather",
            input_message_content: { message_text: "🌤️ Weather: Sunny 29°C" }
        });
    } else if (query === "ip") {
        const fakeIp = "192.168.0." + Math.floor(Math.random() * 255);
        results.push({
            type: "article",
            id: "ip-" + Date.now(),
            title: "🌍 Fake IP",
            description: fakeIp,
            input_message_content: { message_text: "🌍 Fake IP: " + fakeIp }
        });
    } else if (query === "about") {
        results.push({
            type: "article",
            id: "about",
            title: "🤖 About",
            description: "About the bot",
            input_message_content: { message_text: "🤖 A multipurpose Telegram bot made by you." }
        });
    } else if (query === "owner") {
        results.push({
            type: "article",
            id: "owner",
            title: "👑 Owner",
            description: "Bot owner info",
            input_message_content: { message_text: "👑 Owner: YOU!" }
        });
    } else if (query === "cat") {
        results.push({
            type: "article",
            id: "cat",
            title: "🐱 Cat",
            description: "Meow!",
            input_message_content: { message_text: "🐱 Meow!" }
        });
    } else if (query === "dog") {
        results.push({
            type: "article",
            id: "dog",
            title: "🐶 Dog",
            description: "Woof!",
            input_message_content: { message_text: "🐶 Woof!" }
        });
    } else if (query === "game") {
        const games = ["Apex Legends", "Fortnite", "Minecraft", "Valorant", "GTA V", "Call of Duty"];
        const game = games[Math.floor(Math.random() * games.length)];
        results.push({
            type: "article",
            id: "game-" + Date.now(),
            title: "🎮 Random Game",
            description: game,
            input_message_content: { message_text: "🎮 Random game: " + game }
        });
    } else if (query === "movie") {
        const movies = ["Interstellar", "Inception", "The Dark Knight", "Avatar", "Titanic", "Avengers"];
        const movie = movies[Math.floor(Math.random() * movies.length)];
        results.push({
            type: "article",
            id: "movie-" + Date.now(),
            title: "🎬 Random Movie",
            description: movie,
            input_message_content: { message_text: "🎬 Movie: " + movie }
        });
    } else if (query.startsWith("rate ")) {
        const thing = query.replace("rate ", "");
        const rating = Math.floor(Math.random() * 10);
        results.push({
            type: "article",
            id: "rate-" + Date.now(),
            title: "⭐ Rate",
            description: `Rating for ${thing}: ${rating}/10`,
            input_message_content: { message_text: `⭐ I rate *${thing}* — ${rating}/10`, parse_mode: "Markdown" }
        });
    } else if (query === "secret") {
        results.push({
            type: "article",
            id: "secret",
            title: "🤫 Secret",
            description: "Click to reveal a secret",
            input_message_content: { message_text: "🤫 Secret: You are awesome. Don't tell anyone." }
        });
    } else if (query === "animeclips") {
        results.push({
            type: "article",
            id: "animeclips",
            title: "🔥 Anime Clips",
            description: "Get anime clips link",
            input_message_content: { message_text: "🔥 Check out anime clips here: https://hiitwixtor.com/" }
        });
    } else if (query.startsWith("short ")) {
        const url = query.replace("short ", "");
        results.push({
            type: "article",
            id: "short-" + Date.now(),
            title: "🔗 Shorten URL",
            description: "Click to get shortened URL",
            input_message_content: { message_text: `🔗 Shortened:\nhttps://tinyurl.com/api-create.php?url=${url}` }
        });
    }

    if (results.length === 0) {
        results.push({
            type: "article",
            id: "unknown",
            title: "❓ Unknown command",
            description: "Try: joke, fact, quote, flip, roll, ask [question], and more!",
            input_message_content: { message_text: "📖 Inline commands:\njoke, fact, quote, flip, roll, random, vibe, emoji, ping, time, date, math, alive, hack, weather, ip, about, owner, cat, dog, game, movie, secret, anime, animeclips, roast, bless\n\nWith text: ask [q], love [name], echo [text], reverse [text], upper [text], lower [text], choose [words], calc [expr], rate [thing], short [url]" }
        });
    }

    await ctx.answerInlineQuery(results, { cache_time: 0 });
});

bot.launch();
console.log("Bot is running...");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
