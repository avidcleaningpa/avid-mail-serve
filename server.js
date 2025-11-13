// server.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";

dotenv.config();

// ================== БАЗОВАЯ НАСТРОЙКА ==================
const app = express();

// какие источники (сайты) могут слать запросы к серверу
const allowedOrigins = [
  "http://localhost:4173",
  "http://localhost:5173",
  "https://tranquil-scone-233ac7.netlify.app",
  "https://avidcarpetcleaning.com",            // <– добавили боевой домен
];

app.use(
  cors({
    origin(origin, callback) {
      // origin может быть undefined, если ты сам тестируешь из постмана и т.п.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------ Multer: загрузка фото в память -------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // до 10 МБ на файл
    files: 10,                  // до 10 файлов
  },
});

// ------------ Конфиг для отправки почты через Resend -----
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// кто ПОЛУЧАЕТ заявки (может быть Gmail)
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  process.env.MAIL_USER ||
  "avidcleaningpa@gmail.com";

// кто ОТПРАВЛЯЕТ (должен быть на твоём домене)
const SENDER_EMAIL =
  process.env.SENDER_EMAIL || "booking@avidcarpetcleaning.com";

// хелпер: отправка письма через Resend API
async function sendBookingEmail({ client, html, attachments }) {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY env variable");
  }

  const payload = {
    from: `Avid Carpet Cleaning <${SENDER_EMAIL}>`, // отправитель с твоего домена
    to: [ADMIN_EMAIL],                              // получатель — твоя gmail
    reply_to: client.email,                         // "Ответить" — на клиента
    subject: `New booking from ${client.name}`,
    html,
    attachments: attachments.map((file) => ({
      filename: file.originalname,
      content: file.buffer.toString("base64"), // Resend ждёт base64
    })),
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Resend API error:", data);
    throw new Error(data.message || "Resend API error");
  }

  console.log("Mail sent via Resend:", data);
  return data;
}

// ================== РОУТЫ ==================

// health-check, чтобы видеть "Avid API is running"
app.get("/", (req, res) => {
  res.send("Avid API is running");
});

// основной роут с формы
app.post("/api/booking", upload.array("photos", 10), async (req, res) => {
  try {
    const { name, email, address, phone, service, items, comments } = req.body;
    const files = req.files || [];

    console.log("New booking request:", {
      name,
      email,
      address,
      phone,
      service,
      items,
      comments,
      filesCount: files.length,
    });

    // простая проверка обязательных полей
    if (!name || !email || !address || !phone || !service || !items) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // HTML-содержимое письма
    const html = `
      <h2>New Booking Request</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Address:</b> ${address}</p>
      <p><b>Service:</b> ${service}</p>
      <p><b>Items:</b> ${items}</p>
      <p><b>Comments:</b> ${comments || "-"}</p>
      <p><b>Photos attached:</b> ${files.length}</p>
    `;

    // отправляем письмо через Resend
    await sendBookingEmail({
      client: { name, email },
      html,
      attachments: files,
    });

    // ответ фронту
    return res.json({ success: true });
  } catch (err) {
    console.error("Booking error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Mail error" });
  }
});

// ================== ЗАПУСК СЕРВЕРА ==================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log("Your service is live 🚀");
});
