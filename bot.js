const { Telegraf, Markup } = require('telegraf');

// הכנס כאן את הטוקן שקיבלת מ-BotFather
const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');

// מסד נתונים זמני בזיכרון (מומלץ בהמשך לחבר ל-MongoDB או קובץ JSON מסודר)
const db = {
    users: new Map() // מפתח: Telegram ID, ערך: { package, expiryDate }
};

// פקודת התחלה
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const user = db.users.get(userId);
    const now = new Date();

    // בדיקה האם המשתמש קיים והמנוי שלו בתוקף
    if (user && new Date(user.expiryDate) > now) {
        const daysLeft = Math.ceil((new Date(user.expiryDate) - now) / (1000 * 60 * 60 * 24));
        
        return ctx.reply(
            `👋 שלום ${ctx.from.first_name}!\n\n` +
            `✅ אתה רשום במערכת.\n` +
            `📦 חבילה: ${user.package}\n` +
            `⏳ זמן שנותר: כ-${daysLeft} ימים (עד ${user.expiryDate.toLocaleDateString('he-IL')})\n\n` +
            `להלן האפשרויות הנוספות שנפתחו עבורך:`,
            Markup.keyboard([
                ['📄 צפייה בעמודים המוגנים', '⚙️ הגדרות חשבון'],
                ['📞 תמיכה טכנית']
            ]).resize()
        );
    }

    // אם המשתמש לא רשום או פג תוקפו
    return ctx.reply(
        `👋 שלום ${ctx.from.first_name}!\n\n` +
        `❌ כרגע אינך רשום למערכת או שמנויך פג.\n\n` +
        `בחר חבילה כדי לפתוח את גישת העמודים המלאה:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('⭐ רכשו חבילה מלאה (100 כוכבים)', 'pay_package')]
        ])
    );
});

// טיפול בלחיצה על כפתור הרכישה - יצירת חשבונית בכוכבים
bot.action('pay_package', async (ctx) => {
    await ctx.answerCbQuery();
    
    // שליחת חשבונית בטלגרם עבור Telegram Stars (המטבע הוא XTR)
    await ctx.replyWithInvoice({
        title: 'חבילת מנוי מלאה לבוט',
        description: 'גישה מלאה לכל העמודים והתכנים במערכת למשך 30 יום',
        payload: 'monthly_subscription_30_days',
        currency: 'XTR', // מטבע כוכבי טלגרם
        prices: [{ label: 'מנוי חודשי', amount: 100 }] // עלות: 100 כוכבים
    });
});

// אישור מקדים לפני ביצוע העסקה (חובה בטלגרם)
bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
});

// טיפול בהצלחת התשלום בכוכבים
bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id.toString();
    const payment = ctx.message.successful_payment;

    // חישוב תאריך תפוגה (30 יום מהיום)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // שמירת הנתונים במערכת
    db.users.set(userId, {
        package: 'חבילה מלאה (כוכבים)',
        expiryDate: expiryDate
    });

    await ctx.reply(
        `🎉 התשלום בוצע בהצלחה בשווי ${payment.total_amount} כוכבים!\n\n` +
        `כעת אתה רשום רשמית במערכת. הגישה לעמודים ולתפריט המלא נפתחה עבורך. לחץ על /start כדי להתחיל.`,
        Markup.keyboard([
            ['📄 צפייה בעמודים המוגנים', '⚙️ הגדרות חשבון'],
            ['📞 תמיכה טכנית']
        ]).resize()
    );
});

// הפעלת הבוט
bot.launch().then(() => {
    console.log('Bot is running successfully!');
});

// עצירה נקייה של הבוט
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
const { Telegraf, Markup } = require('telegraf');

// 1. הגדרת הבוט
const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN');

// 2. מזהה הטלגרם שלך (המנהל) - שים כאן את ה-ID שלך
const ADMIN_ID = 'הכנס_כאן_את_ה-ID_שליך'; 

// מסד נתונים זמני (או חיבור ל-MongoDB בהמשך)
const db = {
    users: new Map()
};

// 3. פקודת התחלה (/start)
bot.start(async (ctx) => {
    // ... (כל הקוד של פקודת סטארט שהיה קודם)
});

// 4. פקודת ניהול להוספה ידנית (/add) - כאן המקום שלה!
bot.command('add', async (ctx) => {
    const senderId = ctx.from.id.toString();

    if (senderId !== ADMIN_ID) {
        return ctx.reply('❌ אין לך הרשאה להשתמש בפקודה זו.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    const targetUserId = args[0];
    const days = parseInt(args[1]) || 30;

    if (!targetUserId) {
        return ctx.reply('⚠️ שימוש שגוי. הפורמט הנכון:\n`/add <מזהה_משתמש> <מספר_ימים>`');
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    db.users.set(targetUserId, {
        package: `חבילה ידנית (${days} ימים)`,
        expiryDate: expiryDate
    });

    return ctx.reply(
        `✅ הלקוח עודכן בהצלחה!\n\n` +
        `👤 מזהה: ${targetUserId}\n` +
        `⏳ בתוקף למשך: ${days} ימים`
    );
});

// 5. שאר הפקודות (תשלומים, כפתורים וכו')
bot.action('pay_package', async (ctx) => {
    // ...
});

bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
});

bot.on('successful_payment', async (ctx) => {
    // ...
});

// 6. הפעלת הבוט - תמיד בסוף הקובץ!
bot.launch().then(() => {
    console.log('Bot is running successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
