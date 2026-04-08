import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

//
// ======================
// USER SCHEMA
// ======================
//
export interface IUser extends Document {
  username: string;
  password: string;
  role: string;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, default: "worker" }
});

//
// ======================
// PRODUCT SCHEMA (FIXED)
// ======================
//
export interface IProduct extends Document {
  name?: string;
  category?: string;
  price?: number;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String },
  category: { type: String },
  price: { type: Number }
});

//
// ======================
// CATEGORY SCHEMA
// ======================
//
export interface ICategory extends Document {
  name: string;
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true }
});

//
// ======================
// ZOD VALIDATION (FIXED)
// ======================
//
export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.string().default("worker")
});

//Product validation: allow partial but require at least one field
export const insertProductSchema = z
  .object({
    name: z.string().optional(),
    category: z.string().optional(),
    price: z.number().min(0).optional()
  })
  .refine((data) => {
    return data.name || data.category || data.price !== undefined;
  }, {
    message: "At least one field must be provided"
  });

export const insertCategorySchema = z.object({
  name: z.string().min(1)
});

//======================
//
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type User = IUser;
export type Product = IProduct;
export type Category = ICategory;

//
// =========
export const UserModel = mongoose.model<IUser>("User", UserSchema);
export const ProductModel = mongoose.model<IProduct>("Product", ProductSchema);
export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);