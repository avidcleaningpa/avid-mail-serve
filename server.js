// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ---- CORS ----
const allowedOrigins = [
  "http://localhost:4173",
  "http://localhost:5173",
  "https://tranquil-scene-233ac7.netlify.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // На всякий случай, чтобы запросы без origin (например, из Postman) тоже проходили
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }
  })
);

// Чтобы парсить JSON без файлов (на всякий случай)
app.use(express.json());

// ---- Multer: файлы в память ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB на файл
    files: 10
  }
});

// ---- Nodemailer ----
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// простая проверка, что API жив
app.get("/", (req, res) => {
  res.send("Avid API is running");
});

// ---- Основной маршрут бронирования ----
app.post("/api/booking", upload.array("photos", 10), async (req, res) => {
  try {
    const {
      serviceType,
      serviceDate,
      serviceTime,
      firstName,
      lastName,
      phone,
      email,
      address,
      itemsToClean,
      additionalComments
    } = req.body;

    // Куда отправляем заявки
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;

    // Текст письма для администратора
    const adminText = `
New booking request:

Service type: ${serviceType || "-"}
Preferred date: ${serviceDate || "-"}
Preferred time: ${serviceTime || "-"}

Name: ${firstName || ""} ${lastName || ""}
Phone: ${phone || "-"}
Email: ${email || "-"}

Address:
${address || "-"}

Items to clean:
${itemsToClean || "-"}

Additional comments:
${additionalComments || "-"}
    `;

    // прикрепляем файлы (если есть)
    const attachments =
      (req.files || []).map((file) => ({
        filename: file.originalname || "photo.jpg",
        content: file.buffer
      })) || [];

    // ---- письмо админу ----
    await transporter.sendMail({
      from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: "New booking request",
      text: adminText,
      attachments
    });

    // ---- письмо клиенту (подтверждение) ----
    if (email) {
      const clientText = `
Hi ${firstName || ""},

Thank you for your booking request with Avid Carpet Cleaning.
We received your request and will contact you within a few hours to confirm details.

Best regards,
Avid Carpet Cleaning
      `;

      await transporter.sendMail({
        from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "We received your booking request",
        text: clientText
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error while handling booking:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ---- Запуск ----
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
