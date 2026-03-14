import mongoose from "mongoose";
import { type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory, UserModel, ProductModel, CategoryModel } from "@shared/schema";

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Initialize connection
connectDB();

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(username: string): Promise<boolean>;

  // Products
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | null>;
  deleteProduct(id: string): Promise<boolean>;

  // Categories
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(name: string): Promise<boolean>;
}

export class MongoStorage implements IStorage {
  async getUser(id: string): Promise<User | null> {
    return await UserModel.findById(id);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return await UserModel.findOne({ username });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = new UserModel(insertUser);
    return await user.save();
  }

  async getAllUsers(): Promise<User[]> {
    return await UserModel.find();
  }

  async deleteUser(username: string): Promise<boolean> {
    const result = await UserModel.deleteOne({ username });
    return result.deletedCount > 0;
  }

  async getAllProducts(): Promise<Product[]> {
    return await ProductModel.find();
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product = new ProductModel(insertProduct);
    return await product.save();
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | null> {
    return await ProductModel.findByIdAndUpdate(id, product, { new: true });
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const result = await ProductModel.deleteOne({ _id: id });
      return result.deletedCount > 0;
    } catch (error) {
      return false;
    }
  }

  async getAllCategories(): Promise<Category[]> {
    return await CategoryModel.find();
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const category = new CategoryModel(insertCategory);
    return await category.save();
  }

  async deleteCategory(name: string): Promise<boolean> {
    const result = await CategoryModel.deleteOne({ name });
    return result.deletedCount > 0;
  }
}

export const storage = new MongoStorage();
