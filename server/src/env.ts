import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  uploadDir: path.resolve(process.env.UPLOAD_DIR || "./uploads"),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
};
