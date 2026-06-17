import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { env } from "./env";

import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import specialistRoutes from "./routes/specialists";
import projectRoutes from "./routes/projects";
import financialRoutes from "./routes/financial";
import fileRoutes from "./routes/files";
import dashboardRoutes from "./routes/dashboard";
import reportRoutes from "./routes/reports";
import activityRoutes from "./routes/activity";
import userRoutes from "./routes/users";
import roleRoutes from "./routes/roles";
import lookupRoutes from "./routes/lookups";
import settingsRoutes from "./routes/settings";
import invoiceRoutes from "./routes/invoices";

const app = express();

app.use(
  cors({
    origin: env.clientOrigin === "*" ? true : env.clientOrigin.split(","),
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(env.uploadDir)) fs.mkdirSync(env.uploadDir, { recursive: true });

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/specialists", specialistRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/financial", financialRoutes);
app.use("/api", fileRoutes); // /api/projects/:id/files , /api/files/:id...
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/lookups", lookupRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/invoices", invoiceRoutes);

// تقديم واجهة الإنتاج إن وُجدت
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// معالج الأخطاء العام
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.code === "P2002") {
    return res.status(400).json({ message: "قيمة مكررة، تحقق من البيانات" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "حجم الملف كبير جداً (الحد 25 ميجابايت)" });
  }
  res.status(err?.status || 500).json({ message: err?.message || "حدث خطأ في الخادم" });
});

app.listen(env.port, () => {
  console.log(`✅ الخادم يعمل على http://localhost:${env.port}`);
});
