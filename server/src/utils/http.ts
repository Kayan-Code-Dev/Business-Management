import { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function parseNumber(value: any, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

export function parseDate(value: any): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}
