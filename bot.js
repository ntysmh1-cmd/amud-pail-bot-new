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
