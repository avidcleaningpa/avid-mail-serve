// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ---- базовая настройка ----
app.use(cors());
app.use(express.json());

// ---- загрузка файлов в память ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 5 * 1024 * 1024, // 5MB на фото
  },
});

// ---- SMTP-транспорт для Gmail ----
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // app password
  },
});

// Простой health-check, чтобы видеть, что API жив
app.get("/", (req, res) => {
  res.send("Avid API is running");
});

// ---- основной endpoint бронирования ----
app.post("/api/booking", upload.array("photos", 10), async (req, res) => {
  try {
    const {
      name,
      email,
      address,
      phone,
      service,
      items,
      comments,
    } = req.body;

    const files = req.files || [];

    console.log("New booking:", {
      name,
      email,
      address,
      phone,
      service,
      items,
      comments,
      fileCount: files.length,
    });

    // Текст письма для админа
    const adminTextLines = [
      `Новая заявка с сайта Avid Carpet Cleaning:`,
      "",
      `Имя: ${name || "-"}`,
      `Email клиента: ${email || "-"}`,
      `Телефон: ${phone || "-"}`,
      `Адрес: ${address || "-"}`,
      `Услуга: ${service || "-"}`,
      "",
      `Предметы для чистки:`,
      items || "-",
      "",
      `Комментарий клиента:`,
      comments || "-",
      "",
      `Фото во вложениях: ${files.length}`,
    ];

    const adminMail = {
      from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.MAIL_USER,
      subject: "Новая заявка с сайта Avid Carpet Cleaning",
      text: adminTextLines.join("\n"),
      attachments:
        files.length > 0
          ? files.map((f, idx) => ({
              filename: f.originalname || `photo-${idx + 1}.jpg`,
              content: f.buffer,
            }))
          : [],
    };

    // Письмо для клиента (подтверждение)
    let clientMail = null;
    if (email) {
      const clientText =
        `Спасибо за заявку в Avid Carpet Cleaning!\n\n` +
        `Мы получили ваш запрос и свяжемся с вами по телефону ${phone || "-"} ` +
        `для подтверждения времени и стоимости.\n\n` +
        `Если вы не оставляли эту заявку — просто игнорируйте это письмо.`;

      clientMail = {
        from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "We received your cleaning request",
        text: clientText,
      };
    }

    // ----- ОТВЕЧАЕМ КЛИЕНТУ СРАЗУ -----
    res.json({ success: true });

    // ----- А ПИСЬМА ОТПРАВЛЯЕМ В ФОНЕ -----
    transporter
      .sendMail(adminMail)
      .then(() => console.log("Admin email sent"))
      .catch((err) => console.error("Admin email failed:", err));

    if (clientMail) {
      transporter
        .sendMail(clientMail)
        .then(() => console.log("Client email sent"))
        .catch((err) => console.error("Client email failed:", err));
    }
  } catch (err) {
    console.error("Booking handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
});

// ---- старт сервера ----
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
