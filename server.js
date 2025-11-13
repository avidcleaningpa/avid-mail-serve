import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";

const app = express();

// Парсим JSON (на будущее) и включаем CORS
app.use(express.json());
app.use(cors());

// Multer для приёма фото (в память)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 10 * 1024 * 1024 // 10 MB на файл
  },
});

// Транспорт Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Маршрут приёма формы с сайта
app.post("/api/booking", upload.array("photos", 10), async (req, res) => {
  const {
    name,
    email,
    address,
    phone,
    service,
    items,
    comments,
  } = req.body;

  // Прикрепляем фото к письму админу
  const attachments = (req.files || []).map((file, index) => ({
    filename: file.originalname || `photo-${index + 1}.jpg`,
    content: file.buffer,
  }));

  try {
    // Письмо тебе (админу)
    await transporter.sendMail({
      from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "Новая заявка с сайта Avid Carpet Cleaning",
      text:
        `Новая заявка:\n\n` +
        `Имя: ${name || "-"}\n` +
        `Email: ${email || "-"}\n` +
        `Телефон: ${phone || "-"}\n` +
        `Адрес: ${address || "-"}\n` +
        `Услуга: ${service || "-"}\n` +
        `Предметы к чистке: ${items || "-"}\n` +
        `Комментарий: ${comments || "-"}\n`,
      attachments,
    });

    // Письмо клиенту (без вложений)
    if (email) {
      await transporter.sendMail({
        from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "We received your cleaning request",
        text:
          `Thank you for contacting Avid Carpet Cleaning!\n\n` +
          `We received your request and photos and will get back to you ` +
          `within a few hours with a quote and recommendations.\n\n` +
          `If you didn't submit this request, you can simply ignore this email.`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка при отправке письма:", err);
    res.status(500).json({ success: false, error: "Email send failed" });
  }
});

// Проверка, что сервер жив
app.get("/", (req, res) => {
  res.send("Avid API is running");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
