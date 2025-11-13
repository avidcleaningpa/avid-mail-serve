import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ---- CORS ----
const allowedOrigins = [
  "http://localhost:4173",
  "http://localhost:5173",
  "https://tranquil-scone-233ac7.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

// ---- Multer (фотографии) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 10,
  },
});

// ---- Проверка, что сервер жив ----
app.get("/", (req, res) => {
  res.send("Avid API is running");
});

// ---- Основной маршрут бронирования ----
app.post("/send", upload.array("photos", 10), async (req, res) => {
  const {
    name,
    email,
    phone,
    serviceType,
    items,
    date,
    time,
    address,
    comments,
  } = req.body;

  console.log("Incoming booking:", { name, email, phone, serviceType });

  if (!phone || !items) {
    return res
      .status(400)
      .json({ success: false, message: "Phone and items are required." });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const attachments = (req.files || []).map((file) => ({
    filename: file.originalname,
    content: file.buffer,
  }));

  const adminText =
    `Новая заявка с сайта Avid Carpet Cleaning\n\n` +
    `Имя: ${name || "-"}\n` +
    `Телефон: ${phone || "-"}\n` +
    `Email: ${email || "-"}\n` +
    `Тип услуги: ${serviceType || "-"}\n` +
    `Адрес: ${address || "-"}\n` +
    `Дата: ${date || "-"}\n` +
    `Время: ${time || "-"}\n\n` +
    `Что чистим:\n${items || "-"}\n\n` +
    `Комментарий:\n${comments || "-"}\n`;

  try {
    // 1) Письмо клиенту (если указал email)
    if (email) {
      const infoClient = await transporter.sendMail({
        from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "We received your booking request",
        text:
          `Hi${name ? " " + name : ""}!\n\n` +
          `Thank you for your request at Avid Carpet Cleaning.\n` +
          `We will contact you within a few hours to confirm the time and final price.\n\n` +
          `If this was not you, please ignore this email.\n\n` +
          `Avid Carpet Cleaning`,
      });

      console.log("Client mail sent:", infoClient.messageId);
    }

    // 2) Письмо себе
    const infoAdmin = await transporter.sendMail({
      from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.MAIL_USER,
      subject: "Новая заявка с сайта",
      text: adminText,
      attachments,
    });

    console.log("Admin mail sent:", infoAdmin.messageId);

    return res.json({ success: true });
  } catch (err) {
    console.error("Email sending error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send email." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
