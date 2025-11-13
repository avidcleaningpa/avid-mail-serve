import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

app.use(express.json());
app.use(cors());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

app.post("/api/booking", async (req, res) => {
  const {
    name,
    phone,
    email,
    address,
    service,
    date,
    time,
    message,
  } = req.body;

  try {
    await transporter.sendMail({
      from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "Новая заявка с сайта",
      text:
        `Новая заявка:\n\n` +
        `Имя: ${name || "-"}\n` +
        `Телефон: ${phone || "-"}\n` +
        `Email: ${email || "-"}\n` +
        `Адрес: ${address || "-"}\n` +
        `Услуга: ${service || "-"}\n` +
        `Дата: ${date || "-"}\n` +
        `Время: ${time || "-"}\n` +
        `Комментарий: ${message || "-"}\n`,
    });

    if (email) {
      await transporter.sendMail({
        from: `"Avid Carpet Cleaning" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "Ваша заявка получена",
        text:
          `Спасибо за заявку в Avid Carpet Cleaning!\n\n` +
          `Мы свяжемся с вами по телефону ${phone || ""} ` +
          `для подтверждения времени и стоимости.\n\n` +
          `Если заказ делали не вы — просто игнорируйте это письмо.`,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при отправке письма:", err);
    res.status(500).json({ ok: false, error: "Email send failed" });
  }
});

app.get("/", (req, res) => {
  res.send("Avid API is running");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
