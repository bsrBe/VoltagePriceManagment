import "dotenv/config";
import mongoose from "mongoose";
import { UserModel, ProductModel, CategoryModel } from "../shared/schema";

async function seedDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");

    // Check if admin user exists
    const existingAdmin = await UserModel.findOne({ username: "admin" });
    if (!existingAdmin) {
      // Create default admin user
      const adminUser = new UserModel({
        username: "admin",
        password: "admin", // In production, this should be hashed
        role: "admin"
      });
      await adminUser.save();
      console.log("Default admin user created");
    } else {
      console.log("Admin user already exists");
    }

    // Check if worker user exists
    const existingWorker = await UserModel.findOne({ username: "worker" });
    if (!existingWorker) {
      // Create default worker user
      const workerUser = new UserModel({
        username: "worker",
        password: "worker", // In production, this should be hashed
        role: "worker"
      });
      await workerUser.save();
      console.log("Default worker user created");
    } else {
      console.log("Worker user already exists");
    }

    // Check if categories exist
    const existingCategories = await CategoryModel.find({});
    if (existingCategories.length === 0) {
      // Create sample categories
      const categories = [
        { name: "Electronics" },
        { name: "Clothing" },
        { name: "Books" },
        { name: "Home & Garden" },
        { name: "Sports" }
      ];

      for (const category of categories) {
        const newCategory = new CategoryModel(category);
        await newCategory.save();
      }
      console.log("Sample categories created");
    } else {
      console.log("Categories already exist");
    }

    // Check if products exist
    const existingProducts = await ProductModel.find({});
    if (existingProducts.length === 0) {
      // Create sample products
      const products = [
        { name: "Wireless Bluetooth Headphones", category: "Electronics", price: 89.99 },
        { name: "Cotton T-Shirt", category: "Clothing", price: 19.99 },
        { name: "Programming Book", category: "Books", price: 49.99 },
        { name: "Garden Hose", category: "Home & Garden", price: 24.99 },
        { name: "Yoga Mat", category: "Sports", price: 34.99 },
        { name: "Smartphone Case", category: "Electronics", price: 15.99 },
        { name: "Running Shoes", category: "Sports", price: 79.99 },
        { name: "Coffee Table Book", category: "Books", price: 29.99 }
      ];

      for (const product of products) {
        const newProduct = new ProductModel(product);
        await newProduct.save();
      }
      console.log("Sample products created");
    } else {
      console.log("Products already exist");
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed");
  }
}

seedDatabase();