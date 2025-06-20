const axios = require("axios");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");
const tough = require("tough-cookie");

const config = require("./config");

const bot = new TelegramBot(config.telegramBotToken, { polling: true });

let lastOtpCode = null;
const cookieJar = new tough.CookieJar();
let cookie = "";

async function login() {
  const payload = new URLSearchParams({
    username: config.seven1telUsername,
    password: config.seven1telPassword,
  });

  const res = await axios.post(
    "http://94.23.120.156/ints/client/processing",
    payload.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const setCookie = res.headers["set-cookie"];
  if (setCookie && setCookie.length) {
    cookie = setCookie[0].split(";")[0]; // Get PHPSESSID
  }
}

async function fetchLatestOtp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;

  const payload = new URLSearchParams({
    fdate1: `${date} 00:00:00`,
    fdate2: `${date} 23:59:59`,
    frange: "",
    fnum: "",
    fcli: "",
  });

  const res = await axios.post(
    "http://94.23.120.156/ints/client/SMSCDRStats",
    payload.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
    }
  );

  const $ = cheerio.load(res.data);
  const rows = $("table tbody tr");

  if (rows.length === 0) return;

  const lastRow = $(rows[0])
    .find("td")
    .map((i, el) => $(el).text().trim())
    .get();

  const [_, time, number, , service, code, msg] = lastRow;

  if (code && code !== lastOtpCode) {
    lastOtpCode = code;
    const message = `✨ OTP Received ✨

⏰ Time: ${time}
📞 Number: ${number}
🔧 Service: ${service}
🔐 OTP Code: ${code}
📝 Msg: ${msg}`;

    bot.sendMessage(config.telegramGroupId, message);
  }
}

(async () => {
  console.log("🔐 Logging in to Seven1tel...");
  await login();
  console.log("✅ Logged in successfully. Starting OTP fetch...");

  await fetchLatestOtp(); // Send last OTP once

  setInterval(fetchLatestOtp, 1000); // Check every second
})();
