const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const TOKEN = '8628133205:AAGPyjElaBqKUkcg_Wt6EVeE34hYh9rtVuo';
const MONGO_URI = process.env.MONGO_URI;

let usersCollection = null;

async function connectDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('telegram_bot');
    usersCollection = db.collection('users');
    console.log('Connected to MongoDB Atlas successfully!');
  } catch (e) {
    console.error('MongoDB connection error:', e);
  }
}
connectDB();

let ADMIN_CHAT_ID = null;

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(cors());
app.use(express.json());

const CHANNELS = {
  active: 'https://t.me/+_znY5WL-ePExYzg0',
  old: 'https://t.me/+yTkbvektH3EyMWI0',
  premium: 'https://t.me/+vthjD7CCrrY5OWI8',
  requests: 'https://t.me/+zPB0gFGnmhw1M2M0'
};

const PRICES = {
  '75': { stars: 1000, title: 'חבילה בסיסית', days: 30 },
  '150': { stars: 2000, title: 'חבילה מלאה', days: 90 }
};

async function resolveUser(input) {
  input = String(input).trim();
  if (/^\d+$/.test(input)) return input;
  const username = input.replace('@', '');
  try {
    const chat = await bot.getChat('@' + username);
    return String(chat.id);
  } catch (e) {
    return null;
  }
}

bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = String(msg.chat.id);
  const param = (match[1] || '').trim();
  const name = msg.from.first_name || 'לקוח';

  if (!ADMIN_CHAT_ID) ADMIN_CHAT_ID = msg.chat.id;

  if (param.startsWith('pay_')) {
    const pkg = param.replace('pay_', '');
    await sendStarsInvoice(msg.chat.id, pkg, name);
  } else {
    let u = null;
    if (usersCollection) {
      u = await usersCollection.findOne({ $or: [{ userId: chatId }, { _id: chatId }] });
    }

    let caption = '';
    let keyboard = { inline_keyboard: [] };

    if (u && u.expiresAt) {
      const now = new Date();
      const exp = new Date(u.expiresAt);
      if (exp >= now) {
        const daysLeft = Math.ceil((exp - now) / 86400000);
        const pkgName = u.package === '150' ? 'מלאה' : 'בסיסית';
        caption = `שלום ${name} 👋\n\nאתה רשום במערכת ✅\nחבילה: ${pkgName}\nנותר: ${daysLeft} ימים`;
        keyboard.inline_keyboard = [
          [{ text: '🔓 כניסה לרשומים', callback_data: 'enter_members' }],
          [{ text: '⭐ חידוש חבילה בסיסית', callback_data: 'buy_75' }],
          [{ text: '🌟 חידוש חבילה מלאה', callback_data: 'buy_150' }]
        ];
      } else {
        caption = `שלום ${name} 👋\n\nהמנוי שלך פג.\nבחר חבילה חדשה:`;
        keyboard.inline_keyboard = [
          [{ text: '⭐ חבילה בסיסית — 1000 כוכבים', callback_data: 'buy_75' }],
          [{ text: '🌟 חבילה מלאה — 2000 כוכבים', callback_data: 'buy_150' }]
        ];
      }
    } else {
      caption = `שלום ${name} 👋\n\nכרגע אתה לא רשום למערכת.\nבחר חבילה:`;
      keyboard.inline_keyboard = [
        [{ text: '🔓 כניסה לרשומים', callback_data: 'enter_members' }],
        [{ text: '⭐ חבילה בסיסית — 1000 כוכבים', callback_data: 'buy_75' }],
        [{ text: '🌟 חבילה מלאה — 2000 כוכבים', callback_data: 'buy_150' }]
      ];
    }

    const logoPath = path.join(__dirname, 'logo.jpg');
    if (fs.existsSync(logoPath)) {
      bot.sendPhoto(msg.chat.id, logoPath, { caption, reply_markup: keyboard });
    } else {
      bot.sendMessage(msg.chat.id, caption, { reply_markup: keyboard });
    }
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);
  await bot.answerCallbackQuery(query.id);

  if (query.data === 'buy_75') {
    await sendStarsInvoice(chatId, '75', query.from.first_name);
  } else if (query.data === 'buy_150') {
    await sendStarsInvoice(chatId, '150', query.from.first_name);
  } else if (query.data === 'enter_members') {
    let u = null;
    if (usersCollection) {
      u = await usersCollection.findOne({ $or: [{ userId: userId }, { _id: userId }] });
    }

    if (!u || !u.expiresAt || new Date(u.expiresAt) < new Date()) {
      bot.sendMessage(chatId, '❌ אין לך גישה.\nאתה לא רשום או שהמנוי פג.');
      return;
    }
    let buttons = [
      [{ text: '🔥 עמוד פעיל', url: CHANNELS.active }],
      [{ text: '📼 סרטוני עבר', url: CHANNELS.old }],
      [{ text: '💬 המלצות ובקשות', url: CHANNELS.requests }]
    ];
    if (u.package === '150') {
      buttons.push([{ text: '⭐ לקוחות פרימיום', url: CHANNELS.premium }]);
    }
    buttons.push([{ text: '⬅️ חזרה', callback_data: 'back_main' }]);
    bot.sendMessage(chatId, 'בחר עמוד:', { reply_markup: { inline_keyboard: buttons } });
  } else if (query.data === 'back_main') {
    bot.sendMessage(chatId, 'לחץ /start כדי לחזור לתפריט הראשי');
  }
});

async function sendStarsInvoice(chatId, pkg, name) {
  const info = PRICES[pkg] || PRICES['75'];
  try {
    await bot.sendInvoice(chatId, info.title, 
      pkg === '150' ? 'גישה מלאה לכל 4 העמודים למשך 3 חודשים' : 'עמוד פעיל + סרטוני עבר למשך חודש',
      `pkg_${pkg}_${chatId}`,
      '',
      'XTR',
      [{ label: info.title, amount: info.stars }]
    );
  } catch (e) {
    console.log('Invoice error:', e.message);
    bot.sendMessage(chatId, 'שגיאה ביצירת החשבונית. נסה שוב מאוחר יותר.');
  }
}

bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', async (msg) => {
  const payment = msg.successful_payment;
  const userId = String(msg.from.id);
  const name = msg.from.first_name || 'לקוח';
  const payload = payment.invoice_payload || '';
  const pkg = payload.includes('150') ? '150' : '75';
  const info = PRICES[pkg];

  const expires = new Date();
  expires.setDate(expires.getDate() + info.days);
  const expiresAt = expires.toISOString().split('T')[0];

  const userData = {
    userId,
    package: pkg,
    expiresAt,
    days: info.days,
    addedAt: new Date().toISOString(),
    paidWith: 'stars'
  };

  if (usersCollection) {
    await usersCollection.updateOne(
      { userId },
      { $set: userData },
      { upsert: true }
    );
  }

  bot.sendMessage(msg.chat.id, `✅ התשלום התקבל!\nחבילה: ${info.title}\nבתוקף עד: ${expiresAt}\n\nפתח שוב את עמוד פעיל.`);
  if (ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, `💰 תשלום כוכבים\nשם: ${name}\nמזהה: ${userId}\nחבילה: ${info.title}\nעד: ${expiresAt}`);
  }
});

bot.onText(/\/approve (.+)/, async (msg, match) => {
  const parts = match[1].trim().split(/\s+/);
  const input = parts[0];
  const pkg = parts[1] || '75';
  const days = parseInt(parts[2]) || (pkg === '150' ? 90 : 30);

  const userId = await resolveUser(input);
  if (!userId) {
    return bot.sendMessage(msg.chat.id, `❌ לא מצאתי משתמש: ${input}`);
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  const expiresAt = expires.toISOString().split('T')[0];

  const userData = {
    userId,
    package: pkg,
    expiresAt,
    days,
    addedAt: new Date().toISOString()
  };

  if (usersCollection) {
    await usersCollection.updateOne(
      { userId },
      { $set: userData },
      { upsert: true }
    );
  }

  bot.sendMessage(msg.chat.id, `✅ אושר!\nמזהה: ${userId}\nחבילה: ${pkg}\nעד: ${expiresAt}`);
  bot.sendMessage(userId, `✅ המנוי שלך אושר!\nבתוקף עד: ${expiresAt}`).catch(() => {});
});

bot.onText(/\/add (.+)/, async (msg, match) => {
  const parts = match[1].trim().split(/\s+/);
  const input = parts[0];
  const pkg = parts[1] || '75';
  const expiresAt = parts[2] || null;

  const userId = await resolveUser(input);
  if (!userId) {
    return bot.sendMessage(msg.chat.id, `❌ לא מצאתי משתמש: ${input}`);
  }

  const userData = {
    userId,
    package: pkg,
    expiresAt,
    addedAt: new Date().toISOString()
  };

  if (usersCollection) {
    await usersCollection.updateOne(
      { userId },
      { $set: userData },
      { upsert: true }
    );
  }

  bot.sendMessage(msg.chat.id, `✅ נוסף!\nמזהה: ${userId}\nחבילה: ${pkg}\nעד: ${expiresAt || 'לא צוין'}`);
});

bot.onText(/\/check (.+)/, async (msg, match) => {
  const input = match[1].trim();
  const userId = await resolveUser(input);
  if (!userId) {
    return bot.sendMessage(msg.chat.id, `❌ לא מצאתי משתמש: ${input}`);
  }

  let u = null;
  if (usersCollection) {
    u = await usersCollection.findOne({ userId });
  }

  if (!u) bot.sendMessage(msg.chat.id, '❌ לא רשום');
  else bot.sendMessage(msg.chat.id, `✅ רשום\nחבילה: ${u.package}\nעד: ${u.expiresAt || 'לא ידוע'}`);
});

bot.onText(/\/list/, async (msg) => {
  let count = 0;
  if (usersCollection) {
    count = await usersCollection.countDocuments();
  }
  bot.sendMessage(msg.chat.id, `סה"כ רשומים: ${count}`);
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    let u = null;
    if (usersCollection) {
      u = await usersCollection.findOne({ $or: [{ userId: userId }, { _id: userId }] });
    }

    if (!u) return res.json({ isRegistered: false });
    const now = new Date();
    const exp = u.expiresAt ? new Date(u.expiresAt) : null;
    res.json({
      isRegistered: !exp || exp >= now,
      package: u.package,
      expiresAt: u.expiresAt,
      daysLeft: exp ? Math.max(0, Math.ceil((exp - now) / 86400000)) : null
    });
  } catch (e) {
    res.status(500).json({ isRegistered: false, error: 'DB Error' });
  }
});

app.get('/', (req, res) => res.send('Amud Pail Bot running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Bot running on port', PORT));
console.log('Bot started');
