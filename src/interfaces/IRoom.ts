import { User } from "./IUser.js";

export interface Room {
    name: string;
    users: User[];
}