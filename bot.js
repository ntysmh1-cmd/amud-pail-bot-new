const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const TOKEN = '8346226785:AAEGNy8JDRtk5emhtteF8SdqCGBTXXXhoeE';
const MONGO_URI = 'mongodb+srv://botuser:noam21010@botnoa.ba4zpyf.mongodb.net/?retryWrites=true&w=majority&appName=Botnoa';
const DB_NAME = 'amudpail';
const COLLECTION = 'users';

let ADMIN_CHAT_ID = null;
let db = null;
let usersCol = null;

const PRICES = {
  '75': { stars: 1000, title: 'חבילה בסיסית', days: 30 },
  '150': { stars: 2000, title: 'חבילה מלאה', days: 90 }
};

const CHANNELS = {
  active: 'https://t.me/+eQGzaFR0fbk1MzFk',
  old: 'https://t.me/+QexMp8LCX2cyN2Rk',
  premium: 'https://t.me/+2i1ModhatC80MGZk',
  requests: 'https://t.me/+zPB0gFGnmhw1M2M0',
  preview: 'https://t.me/+vthjD7CCrrY5OWI8',
  previewId: -1002212954296
};

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  usersCol = db.collection(COLLECTION);
  console.log('Connected to MongoDB');
}

async function getUser(userId) {
  return await usersCol.findOne({ _id: String(userId) });
}

async function saveUser(userId, data) {
  await usersCol.updateOne(
    { _id: String(userId) },
    { $set: data },
    { upsert: true }
  );
}

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

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(cors());
app.use(express.json());

bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const param = (match[1] || '').trim();
  const name = msg.from.first_name || 'לקוח';
  const userId = String(msg.from.id);

  if (!ADMIN_CHAT_ID) ADMIN_CHAT_ID = chatId;

  if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== chatId) {
    bot.sendMessage(ADMIN_CHAT_ID, `👤 /start חדש\nשם: ${name}\nמזהה: ${userId}\nיוזר: @${msg.from.username || 'אין'}`).catch(() => {});
  }

  if (param.startsWith('pay_')) {
    const pkg = param.replace('pay_', '');
    await sendStarsInvoice(chatId, pkg, name);
    return;
  }

  const u = await getUser(userId);
  let text = '';
  let keyboard = { inline_keyboard: [] };

  if (u && u.expiresAt) {
    const now = new Date();
    const exp = new Date(u.expiresAt);
    if (exp >= now) {
      const daysLeft = Math.ceil((exp - now) / 86400000);
      const pkgName = u.package === '150' ? 'מלאה' : 'בסיסית';
      text = `שלום ${name} 👋\n\nאתה רשום במערכת ✅\nחבילה: ${pkgName}\nנותר: ${daysLeft} ימים`;
      keyboard.inline_keyboard = [
        [{ text: '🔓 כניסה לרשומים', callback_data: 'enter_members' }],
        [{ text: '📌 דברים שכדאי לדעת', callback_data: 'info_menu' }],
        [{ text: '⭐ חידוש חבילה בסיסית', callback_data: 'buy_75' }],
        [{ text: '🌟 חידוש חבילה מלאה', callback_data: 'buy_150' }]
      ];
    } else {
      text = `שלום ${name} 👋\n\nהמנוי שלך פג.\nבחר חבילה חדשה:`;
      keyboard.inline_keyboard = [
        [{ text: '🔓 כניסה לרשומים', callback_data: 'enter_members' }],
        [{ text: '⭐ חבילה בסיסית — 1000 כוכבים', callback_data: 'buy_75' }],
        [{ text: '🌟 חבילה מלאה — 2000 כוכבים', callback_data: 'buy_150' }]
      ];
    }
  } else {
    text = `שלום ${name} 🫶\nהגעת לבוט ההרשמות של העמוד.\n📌 פרטי מנוי: כרגע אינך רשום במערכת.\nההרשמה לעמוד דיסקרטית, יציבה ואמינה. במידה ויש בעיה כלשהי, ניתן לפנות אלינו: @The_Pink_Panther_israel\nרוצים הצצה לעמוד? לחצו על הכפתור למטה 👇`;
    keyboard.inline_keyboard = [
      [{ text: '👀 הצצה לעמוד', url: 'https://t.me/+vthjD7CCrrY5OWI8' }],
      [{ text: '🔓 כניסה לרשומים', callback_data: 'enter_members' }],
      [{ text: '⭐ חבילה בסיסית — 1000 כוכבים', callback_data: 'buy_75' }],
      [{ text: '🌟 חבילה מלאה — 2000 כוכבים', callback_data: 'buy_150' }]
    ];
  }

  const logoPath = require('path').join(__dirname, 'logo.jpg');
  const fs = require('fs');
  if (fs.existsSync(logoPath)) {
    bot.sendPhoto(chatId, logoPath, { caption: text, reply_markup: keyboard });
  } else {
    bot.sendMessage(chatId, text, { reply_markup: keyboard });
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = String(query.from.id);
  const name = query.from.first_name || 'לקוח';
  await bot.answerCallbackQuery(query.id);

  if (query.data === 'buy_75') {
    await sendStarsInvoice(chatId, '75', name);
  } else if (query.data === 'buy_150') {
    await sendStarsInvoice(chatId, '150', name);
  } else if (query.data === 'enter_members') {
    const u = await getUser(userId);
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
  } else if (query.data === 'info_menu') {
    bot.sendMessage(chatId, '📌 דברים שכדאי לדעת\nבחר נושא:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💋 איך מתחברים?', callback_data: 'info_connect' }],
          [{ text: '✨ המחירים', callback_data: 'info_prices' }],
          [{ text: '👇 איך זה עובד?', callback_data: 'info_how' }],
          [{ text: '🆘 צריכים עזרה?', callback_data: 'info_help' }],
          [{ text: '🇮🇱 האם התוכן ישראלי?', callback_data: 'info_israeli' }],
          [{ text: '⬅️ חזרה', callback_data: 'back_main' }]
        ]
      }
    });
  } else if (query.data === 'info_connect') {
    bot.sendMessage(chatId, `💋 איך מתחברים לכל הטוב הזה?\n\nהחיבור קל, מהיר, נוח ודיסקרטי לחלוטין – רק אתם והטלגרם שלכם, בלי סיבוכים מיותרים.\n\nהתשלום מתבצע בקלות באמצעות כוכבי טלגרם (Stars).`, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ חזרה לרשימה', callback_data: 'info_menu' }]] }
    });
  } else if (query.data === 'info_prices') {
    bot.sendMessage(chatId, `✨ המחירים\n\n✨ 1,000 כוכבים = 75 ₪\n✨ 2,000 כוכבים = 150 ₪`, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ חזרה לרשימה', callback_data: 'info_menu' }]] }
    });
  } else if (query.data === 'info_how') {
    bot.sendMessage(chatId, `👇 איך זה עובד בפועל?\n\nלחצו על אחד הכפתורים למטה. אל דאגה, הלחיצה עדיין לא מבצעת רכישה, אלא רק מעניקה לכם פירוט מדויק על כל מה שמחכה לכם בפנים. במידה שתאהבו ותבחרו להמשיך – משם הדרך קצרה.\n\nברגע שתשלימו את הרכישה ותהפכו לחברים רשמיים, הבוט יפנק אתכם באפשרויות חדשות ויפתח בפניכם כפתורים בלעדיים. בנוסף, הבוט תמיד יזכיר לכם איזה חבילה בחרתם וכמה זמן בדיוק נשאר למנוי שלכם. 🕒🔥`, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ חזרה לרשימה', callback_data: 'info_menu' }]] }
    });
  } else if (query.data === 'info_help') {
    bot.sendMessage(chatId, `🆘 נתקלתם בבעיה או צריכים עזרה?\n\nאל דאגה, אתם לא לבד. פנו אל המנהל שלנו שידאג לענות לכם בזריזות ובדיסקרטיות מוחלטת:\n\n👉 @The_Pink_Panther_israel`, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ חזרה לרשימה', callback_data: 'info_menu' }]] }
    });
  } else if (query.data === 'info_israeli') {
    bot.sendMessage(chatId, `🇮🇱 האם התוכן ישראלי?\n\nחד משמעית כן. כל התוכן בעמודים שלנו הוא 100% ישראלי, בלעדי, איכותי ובלי פשרות. 🇮🇱✨`, {
      reply_markup: { inline_keyboard: [[{ text: '⬅️ חזרה לרשימה', callback_data: 'info_menu' }]] }
    });
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

  await saveUser(userId, {
    package: pkg,
    expiresAt,
    days: info.days,
    addedAt: new Date().toISOString(),
    paidWith: 'stars',
    name
  });

  bot.sendMessage(msg.chat.id, `✅ התשלום התקבל!\nחבילה: ${info.title}\nבתוקף עד: ${expiresAt}`);

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

  await saveUser(userId, {
    package: pkg,
    expiresAt,
    days,
    addedAt: new Date().toISOString()
  });

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

  await saveUser(userId, {
    package: pkg,
    expiresAt,
    addedAt: new Date().toISOString()
  });

  bot.sendMessage(msg.chat.id, `✅ נוסף!\nמזהה: ${userId}\nחבילה: ${pkg}\nעד: ${expiresAt || 'לא צוין'}`);
});

bot.onText(/\/check (.+)/, async (msg, match) => {
  const u = await getUser(match[1].trim());
  if (!u) bot.sendMessage(msg.chat.id, '❌ לא רשום');
  else bot.sendMessage(msg.chat.id, `✅ רשום\nחבילה: ${u.package}\nעד: ${u.expiresAt || 'לא ידוע'}`);
});

bot.onText(/\/list/, async (msg) => {
  const count = await usersCol.countDocuments();
  bot.sendMessage(msg.chat.id, `סה"כ רשומים: ${count}`);
});

app.get('/', (req, res) => res.send('Amud Pail Bot running with MongoDB'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log('Bot running on port', PORT));

connectDB().then(() => {
  console.log('New bot started with MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  // Keep trying every 30s
  setInterval(() => {
    connectDB().catch(e => console.error('Retry MongoDB failed:', e.message));
  }, 30000);
});
