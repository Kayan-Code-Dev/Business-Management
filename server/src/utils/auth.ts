import jwt from "jsonwebtoken";
import { env } from "../env";

export interface JwtPayload {
  userId: number;
  username: string;
  roleName: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
