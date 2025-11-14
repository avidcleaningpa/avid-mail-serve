// server.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";

dotenv.config();

// ================== БАЗОВАЯ НАСТРОЙКА ==================
const app = express();

// какие источники могут слать запросы к серверу
const allowedOrigins = [
  "http://localhost:4173",
  "http://localhost:5173",
  "https://tranquil-scone-233ac7.netlify.app",
  "https://avidcarpetcleaning.com",
  "https://www.avidcarpetcleaning.com",
];

app.use(
  cors({
    origin(origin, callback) {
      // origin может быть undefined, если тестировать из Postman и т.п.
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

// ------------ Конфиг для Resend -------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// основной рабочий ящик
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "booking@avidcarpetcleaning.com";

if (!RESEND_API_KEY) {
  console.warn("⚠️ RESEND_API_KEY не задан в переменных окружения");
}

// ---------- Письмо админу (с фотками) ----------
async function sendBookingEmail({ client, html, attachments }) {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY env variable");
  }

  const payload = {
    from: `Avid Carpet Cleaning <${ADMIN_EMAIL}>`,
    to: [ADMIN_EMAIL],          // куда приходит заявка
    reply_to: client.email,     // ответ попадает клиенту
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
    console.error("Resend API error (admin):", data);
    throw new Error(data.message || "Resend API error (admin)");
  }

  console.log("Mail sent via Resend (admin):", data);
  return data;
}

// ---------- Письмо клиенту (без фоток) ----------
async function sendClientConfirmationEmail({ client, summaryHtml }) {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY env variable");
  }

  const payload = {
    from: `Avid Carpet Cleaning <${ADMIN_EMAIL}>`,
    to: [client.email],                        // письмо клиенту
    subject: "We received your booking request",
    html: summaryHtml,
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
    console.error("Resend API error (client):", data);
    throw new Error(data.message || "Resend API error (client)");
  }

  console.log("Mail sent via Resend (client):", data);
  return data;
}

// ================== РОУТЫ ==================

// health-check (для прогрева Render)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// просто корень
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

    // проверка обязательных полей
    if (!name || !email || !address || !phone || !service || !items) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // HTML для письма админу
    const adminHtml = `
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

    // HTML для письма клиенту
    const clientHtml = `
      <h2>Thank you, ${name}!</h2>
      <p>We’ve received your booking request and will get back to you within a few hours.</p>
      <h3>Summary of your request:</h3>
      <p><b>Service:</b> ${service}</p>
      <p><b>Items:</b> ${items}</p>
      <p><b>Address:</b> ${address}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Additional comments:</b> ${comments || "-"}</p>
      <p>If you didn’t make this request, please reply to this email.</p>
    `;

    // 1) письмо админу
    await sendBookingEmail({
      client: { name, email },
      html: adminHtml,
      attachments: files,
    });

    // 2) письмо клиенту
    await sendClientConfirmationEmail({
      client: { name, email },
      summaryHtml: clientHtml,
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
