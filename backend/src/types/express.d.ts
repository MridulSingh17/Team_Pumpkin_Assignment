import { Types } from "mongoose";
import { IUser } from "./interfaces";

declare global {
  namespace Express {
    interface Request {
      userId?: Types.ObjectId;
      user?: IUser;
      deviceId?: string;
    }
  }
}

export {};
