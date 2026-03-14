import mongoose, { Schema, Document, ObjectId } from "mongoose";
import { z } from "zod";

// User Schema
export interface IUser extends Document {
  username: string;
  password: string;
  role: string;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, default: 'worker' }
});

// Product Schema
export interface IProduct extends Document {
  name: string;
  category: string;
  price: number;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true }
});

// Category Schema
export interface ICategory extends Document {
  name: string;
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true }
});

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.string().default('worker')
});

export const insertProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().positive()
});

export const insertCategorySchema = z.object({
  name: z.string().min(1)
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type User = IUser;
export type Product = IProduct;
export type Category = ICategory;

// Export models
export const UserModel = mongoose.model<IUser>('User', UserSchema);
export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema);
