import type { UserI } from "../models/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user: UserI;
    }
  }
}

export {};
