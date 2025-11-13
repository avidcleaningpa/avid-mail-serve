// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- CORS (разрешаем всем, чтобы не было блокировок в браузере) ----------
app.use(cors());
app.options("*", cors());

// ---------- Парсинг тела + загрузка файлов в память ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 10 * 1024 * 1024, // 10 MB на фото
  },
});

// ---------- Тестовый маршрут для проверки, что API жив ----------
app.get("/", (req, res) => {
  res.send("Avid API is running");
});

// Доп. health-маршрут (можно пинговать без ошибок в консоли)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- Нодмейлер через Gmail ----------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

if (!ADMIN_EMAIL || !MAIL_USER || !MAIL_PASS) {
  console.error("🚨 ENV ERROR: ADMIN_EMAIL / MAIL_USER / MAIL_PASS not set");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
});

// ---------- Основной маршрут бронирования ----------
app.post("/api/booking", upload.array("photos", 10), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log("📩 New booking request:", {
      email: req.body.email,
      name: req.body.name,
    });

    const {
      name,
      email,
      address,
      phone,
      service,
      items,
      comments,
    } = req.body;

    // Собираем вложения из загруженных фото
    const attachments = (req.files || []).map((file, index) => {
      const ext = (file.mimetype && file.mimetype.split("/")[1]) || "jpg";
      return {
        filename: `photo-${index + 1}.${ext}`,
        content: file.buffer,
        contentType: file.mimetype,
      };
    });

    const plainText = `
New booking request

Name: ${name}
Email: ${email}
Address: ${address}
Phone: ${phone}
Service type: ${service}

Items to clean:
${items}

Additional comments:
${comments || "—"}

Attached photos: ${attachments.length}
`.trim();

    const htmlBody = `
      <h2>New booking request</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Address:</b> ${address}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Service type:</b> ${service}</p>
      <p><b>Items to clean:</b><br>${(items || "")
        .replace(/\n/g, "<br>")}</p>
      <p><b>Additional comments:</b><br>${(comments || "—")
        .replace(/\n/g, "<br>")}</p>
      <p><b>Photos attached:</b> ${attachments.length}</p>
    `;

    const mailOptions = {
      from: `"Avid Carpet Cleaning" <${MAIL_USER}>`,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `New booking from ${name || "client"}`,
      text: plainText,
      html: htmlBody,
      attachments,
    };

    // Отправляем письмо, но не даём подвиснуть бесконечно
    const sendPromise = transporter.sendMail(mailOptions);

    // Ограничиваем ожидание, чтобы всегда ответить клиенту
    const MAIL_TIMEOUT = 20000; // 20 секунд
    await Promise.race([
      sendPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Mail timeout")), MAIL_TIMEOUT)
      ),
    ]);

    console.log(
      "✅ Booking processed in",
      Date.now() - startTime,
      "ms"
    );

    // ВАЖНО: всегда отвечаем JSON, иначе фронт будет висеть
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Booking error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Unknown server error",
    });
  }
});

// ---------- Старт сервера ----------
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
