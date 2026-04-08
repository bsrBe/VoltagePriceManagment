import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import mongoose from "mongoose";
import { type User, type InsertUser, type Product, type InsertProduct, type Category, type InsertCategory, UserModel, ProductModel, CategoryModel } from "@shared/schema";

let storageMode: "mongo" | "file" | "memory" = "mongo";

const fallbackStoragePath = path.resolve(process.cwd(), "server", "storage-fallback.json");

// Connect to MongoDB
export async function initDB(): Promise<void> {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    console.warn("MONGODB_URI is not set. Starting fallback file storage mode.");
    storageMode = "file";
    return;
  }

  const mongoUri = rawUri.trim().replace(/^['"]+|['"]+$/g, "");
  if (!mongoUri) {
    console.warn("MONGODB_URI is empty after trimming surrounding quotes. Starting fallback file storage mode.");
    storageMode = "file";
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      connectTimeoutMS: 8000,
      serverSelectionTimeoutMS: 8000,
    });
    console.log("MongoDB connected successfully");
    storageMode = "mongo";
  } catch (error) {
    if (error instanceof Error) {
      console.error("MongoDB connection error:", error.message);
    } else {
      console.error("MongoDB connection error:", error);
    }
    console.warn("Falling back to persistent local file storage for development.");
    storageMode = "file";
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(username: string): Promise<boolean>;
  clearUsers(): Promise<void>; // Add this method

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

class MongoStorage implements IStorage {
  async getUser(id: string): Promise<User | null> {
    try {
      return await UserModel.findById(id);
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      return await UserModel.findOne({ username });
    } catch (error) {
      console.error("Error getting user by username:", error);
      return null;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const newUser = new UserModel(user);
      return await newUser.save();
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await UserModel.find();
    } catch (error) {
      console.error("Error getting all users:", error);
      return [];
    }
  }

  async deleteUser(username: string): Promise<boolean> {
    try {
      const result = await UserModel.deleteOne({ username });
      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async clearUsers(): Promise<void> {
    try {
      await UserModel.deleteMany({});
    } catch (error) {
      console.error("Error clearing users:", error);
    }
  }

  async getAllProducts(): Promise<Product[]> {
    try {
      return await ProductModel.find();
    } catch (error) {
      console.error("Error getting all products:", error);
      return [];
    }
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    try {
      const newProduct = new ProductModel(product);
      return await newProduct.save();
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | null> {
    try {
      return await ProductModel.findByIdAndUpdate(id, product, { new: true });
    } catch (error) {
      console.error("Error updating product:", error);
      return null;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const result = await ProductModel.deleteOne({ _id: id });
      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting product:", error);
      return false;
    }
  }

  async getAllCategories(): Promise<Category[]> {
    try {
      return await CategoryModel.find();
    } catch (error) {
      console.error("Error getting all categories:", error);
      return [];
    }
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    try {
      const newCategory = new CategoryModel(category);
      return await newCategory.save();
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }

  async deleteCategory(name: string): Promise<boolean> {
    try {
      const result = await CategoryModel.deleteOne({ name });
      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting category:", error);
      return false;
    }
  }
}

interface StorageFileShape {
  users: User[];
  products: Product[];
  categories: Category[];
  nextId: number;
}

class FileStorage implements IStorage {
  private data: StorageFileShape = {
    users: [],
    products: [],
    categories: [],
    nextId: 1,
  };

  constructor() {
    this.loadFileSync();
  }

  private loadFileSync() {
    try {
      if (!fs.existsSync(fallbackStoragePath)) {
        fs.mkdirSync(path.dirname(fallbackStoragePath), { recursive: true });
        fs.writeFileSync(fallbackStoragePath, JSON.stringify(this.data, null, 2), "utf8");
        return;
      }

      const raw = fs.readFileSync(fallbackStoragePath, "utf8");
      const parsed = JSON.parse(raw) as StorageFileShape;
      this.data = {
        ...parsed,
        users: parsed.users.map((user) => ({ ...user } as User)),
        products: parsed.products.map((product) => ({ ...product } as Product)),
        categories: parsed.categories.map((category) => ({ ...category } as Category)),
        nextId: parsed.nextId || 1,
      };
    } catch (error) {
      console.error("Error loading fallback storage file:", error);
    }
  }

  private async saveFile() {
    try {
      await fsPromises.writeFile(fallbackStoragePath, JSON.stringify(this.data, null, 2), "utf8");
    } catch (error) {
      console.error("Error saving fallback storage file:", error);
    }
  }

  private createEntity<T>(entity: T): T & { _id: string } {
    return {
      ...entity,
      _id: this.data.nextId.toString(),
      createdAt: new Date(),
    } as T & { _id: string };
  }

  async getUser(id: string): Promise<User | null> {
    return this.data.users.find((user) => String(user._id) === id) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.data.users.find((user) => user.username === username) || null;
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser = this.createEntity(user) as unknown as User;
    this.data.users.push(newUser);
    this.data.nextId += 1;
    await this.saveFile();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.data.users];
  }

  async deleteUser(username: string): Promise<boolean> {
    const index = this.data.users.findIndex((user) => user.username === username);
    if (index !== -1) {
      this.data.users.splice(index, 1);
      await this.saveFile();
      return true;
    }
    return false;
  }

  async clearUsers(): Promise<void> {
    this.data.users = [];
    await this.saveFile();
  }

  async getAllProducts(): Promise<Product[]> {
    return [...this.data.products];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const newProduct = this.createEntity(product) as unknown as Product;
    this.data.products.push(newProduct);
    this.data.nextId += 1;
    await this.saveFile();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | null> {
    const index = this.data.products.findIndex((p) => String(p._id) === id);
    if (index === -1) {
      return null;
    }
    const updated = { ...this.data.products[index], ...product } as Product;
    this.data.products[index] = updated;
    await this.saveFile();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const index = this.data.products.findIndex((product) => String(product._id) === id);
    if (index !== -1) {
      this.data.products.splice(index, 1);
      await this.saveFile();
      return true;
    }
    return false;
  }

  async getAllCategories(): Promise<Category[]> {
    return [...this.data.categories];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const newCategory = this.createEntity(category) as unknown as Category;
    this.data.categories.push(newCategory);
    this.data.nextId += 1;
    await this.saveFile();
    return newCategory;
  }

  async deleteCategory(name: string): Promise<boolean> {
    const index = this.data.categories.findIndex((category) => category.name === name);
    if (index !== -1) {
      this.data.categories.splice(index, 1);
      await this.saveFile();
      return true;
    }
    return false;
  }
}

class InMemoryStorage implements IStorage {
  private users: User[] = [];
  private products: Product[] = [];
  private categories: Category[] = [];
  private nextId = 1;

  async getUser(id: string): Promise<User | null> {
    return this.users.find(user => String(user._id) === id) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.users.find(user => user.username === username) || null;
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser = {
      ...user,
      _id: this.nextId.toString(),
      createdAt: new Date(),
    } as unknown as User;
    this.users.push(newUser);
    this.nextId++;
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return this.users;
  }

  async deleteUser(username: string): Promise<boolean> {
    const index = this.users.findIndex(user => user.username === username);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  async clearUsers(): Promise<void> {
    this.users = [];
  }

  async getAllProducts(): Promise<Product[]> {
    return this.products;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const newProduct = {
      ...product,
      _id: this.nextId.toString(),
      createdAt: new Date(),
    } as unknown as Product;
    this.products.push(newProduct);
    this.nextId++;
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | null> {
    const index = this.products.findIndex(p => String(p._id) === id);
    if (index !== -1) {
      this.products[index] = { ...this.products[index], ...product } as unknown as Product;
      return this.products[index];
    }
    return null;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const index = this.products.findIndex(product => String(product._id) === id);
    if (index !== -1) {
      this.products.splice(index, 1);
      return true;
    }
    return false;
  }

  async getAllCategories(): Promise<Category[]> {
    return this.categories;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const newCategory = {
      ...category,
      _id: this.nextId.toString(),
      createdAt: new Date(),
    } as unknown as Category;
    this.categories.push(newCategory);
    this.nextId++;
    return newCategory;
  }

  async deleteCategory(name: string): Promise<boolean> {
    const index = this.categories.findIndex(category => category.name === name);
    if (index !== -1) {
      this.categories.splice(index, 1);
      return true;
    }
    return false;
  }
}

let storage: IStorage;

export function getStorage(): IStorage {
  if (!storage) {
    switch (storageMode) {
      case "mongo":
        storage = new MongoStorage();
        break;
      case "file":
        storage = new FileStorage();
        break;
      default:
        storage = new InMemoryStorage();
        break;
    }
  }
  return storage;
}

export async function ensureDefaultUsers(): Promise<void> {
  const storage = getStorage();
  const existingUsers = await storage.getAllUsers();

  // Check if we need to update existing users with roles
  const needsUpdate = existingUsers.some(user => !user.role);

  if (existingUsers.length > 0 && !needsUpdate) {
    console.log("Users already exist with roles, skipping seeding");
    return;
  }

  // If users exist but don't have roles, clear them first
  if (needsUpdate) {
    console.log("Clearing existing users to recreate with roles...");
    await storage.clearUsers();
  }

  // Create default admin user
  try {
    await storage.createUser({
      username: "kidus",
      password: "123456", // In production, this should be hashed
      role: "admin"
    });
    console.log("Default admin user created");
  } catch (error) {
    console.error("Error creating default user:", error);
  }

  // Create default worker user
  try {
    await storage.createUser({
      username: "worker",
      password: "worker123", // In production, this should be hashed
      role: "worker"
    });
    console.log("Default worker user created");
  } catch (error) {
    console.error("Error creating default worker user:", error);
  }
}

export async function ensureDefaultProducts(): Promise<void> {
  const storage = getStorage();
  const existingProducts = await storage.getAllProducts();

  if (existingProducts.length > 0) {
    console.log("Products already exist, skipping seeding");
    return;
  }

  // Seed categories and products from the requested item list
  const baseProducts = [
    { name: "BZ4x front bumper fog lhs", category: "TOYOTA BZ4X" },
    { name: "BZ4x front bumper fog rhs", category: "TOYOTA BZ4X" },
    { name: "BZ4x front bumper hook cover lhs", category: "TOYOTA BZ4X" },
    { name: "BZ4x front bumper hook cover rhs", category: "TOYOTA BZ4X" },
    { name: "BZ4x front bumper lower grill", category: "TOYOTA BZ4X" },
    { name: "Bz4x Front bumper upper", category: "TOYOTA BZ4X" },
    { name: "Bz4x Headlight lhs", category: "TOYOTA BZ4X" },
    { name: "Bz4x Headlight rhs", category: "TOYOTA BZ4X" },
    { name: "Bz4x Rear bumper", category: "TOYOTA BZ4X" },
    { name: "Bz4x Rear bumper extention lhs", category: "TOYOTA BZ4X" },
    { name: "Bz4x Rear bumper extention rhs", category: "TOYOTA BZ4X" },
    { name: "Bz4x Tail light bar", category: "TOYOTA BZ4X" },
    { name: "Bz4x taillight lhs", category: "TOYOTA BZ4X" },
    { name: "Bz4x taillight rhs", category: "TOYOTA BZ4X" },
    { name: "Bz4x wheel eyebrow front rhs", category: "TOYOTA BZ4X" },
    { name: "AC CONDENSER", category: "CHANGAN E-STAR" },
    { name: "Air CLEANER", category: "CHANGAN E-STAR" },
    { name: "DOOR", category: "CHANGAN E-STAR" },
    { name: "ENGIN HOOD", category: "CHANGAN E-STAR" },
    { name: "FAN & SHROUD", category: "CHANGAN E-STAR" },
    { name: "FENDER LHS", category: "CHANGAN E-STAR" },
    { name: "FENDER rhs", category: "CHANGAN E-STAR" },
    { name: "FRONT BREAK PAD", category: "CHANGAN E-STAR" },
    { name: "FRONT BUMPER SUPPORT RHS", category: "CHANGAN E-STAR" },
    { name: "FRONT BUMPER SUPPORT lhs", category: "CHANGAN E-STAR" },
    { name: "FRONT CONTROL ARM lhs", category: "CHANGAN E-STAR" },
    { name: "FRONT CONTROL ARM rhs", category: "CHANGAN E-STAR" },
    { name: "FRONT SHOCK ABSORBER RHS", category: "CHANGAN E-STAR" },
    { name: "FRONT SHOCK ABSORBER lhs", category: "CHANGAN E-STAR" },
    { name: "FRONT WHEEL LINER lhs", category: "CHANGAN E-STAR" },
    { name: "FRONT WHEEL LINER rhs", category: "CHANGAN E-STAR" },
    { name: "PARKING SENSOR", category: "CHANGAN E-STAR" },
    { name: "RADIATOR", category: "CHANGAN E-STAR" },
    { name: "REAR VIEW MIRROR LHS", category: "CHANGAN E-STAR" },
    { name: "REAR VIEW MIRROR RHS", category: "CHANGAN E-STAR" },
    { name: "RHS REFLECTOR", category: "CHANGAN E-STAR" },
    { name: "SIGNAL LAMP", category: "CHANGAN E-STAR" },
    { name: "TAIL GATE DOOR HANDLE", category: "CHANGAN E-STAR" },
    { name: "WASHER JAR", category: "CHANGAN E-STAR" },
    { name: "rear BUMPER SUPPORT lhs", category: "CHANGAN E-STAR" },
    { name: "rear BUMPER SUPPORT rhs", category: "CHANGAN E-STAR" },
    { name: "rear WHEEL LINER lhs", category: "CHANGAN E-STAR" },
    { name: "rear WHEEL LINER rhs", category: "CHANGAN E-STAR" },
    { name: "AC PIPE INLET", category: "BYD E2" },
    { name: "AIR DEFLECTOR LHS", category: "BYD E2" },
    { name: "AIR DEFLECTOR RHS", category: "BYD E2" },
    { name: "Ac condenser", category: "BYD E2" },
    { name: "BUMPER STRIP", category: "BYD E2" },
    { name: "Back door", category: "BYD E2" },
    { name: "Back door glass", category: "BYD E2" },
    { name: "Charging port holder", category: "BYD E2" },
    { name: "Co-pilot airbag", category: "BYD E2" },
    { name: "Control arm rhs", category: "BYD E2" },
    { name: "Driver airbag", category: "BYD E2" },
    { name: "ENGINE HOOD HINGE", category: "BYD E2" },
    { name: "FRONT BREAK PAD", category: "BYD E2" },
    { name: "FRONT BUMPER REINFORCEMENT BAR", category: "BYD E2" },
    { name: "Fan", category: "BYD E2" },
    { name: "Front bumper air vent lhs", category: "BYD E2" },
    { name: "Front bumper air vent rhs", category: "BYD E2" },
    { name: "Front bumper upper", category: "BYD E2" },
    { name: "HEADLIGHT LOWER MOLDING LHS", category: "BYD E2" },
    { name: "HEADLIGHT LOWER MOLDING RHS", category: "BYD E2" },
    { name: "HEADLIGHT MOLDINGS", category: "BYD E2" },
    { name: "Headlights LHS", category: "BYD E2" },
    { name: "Headlights RHS", category: "BYD E2" },
    { name: "RADIATOR CARRIER", category: "BYD E2" },
    { name: "REAR BREAK PAD", category: "BYD E2" },
    { name: "REAR BUMPER REFLECTOR LHS", category: "BYD E2" },
    { name: "REAR BUMPER REFLECTOR RHS", category: "BYD E2" },
    { name: "Radiator", category: "BYD E2" },
    { name: "Rear view Mirror lhs", category: "BYD E2" },
    { name: "Rear view Mirror rhs", category: "BYD E2" },
    { name: "Shock absorber front rhs", category: "BYD E2" },
    { name: "Tail light bar", category: "BYD E2" },
    { name: "WIPER JAR MOTOR", category: "BYD E2" },
    { name: "aluminum wheel", category: "BYD E2" },
    { name: "curtain airbag", category: "BYD E2" },
    { name: "doors", category: "BYD E2" },
    { name: "engine hood", category: "BYD E2" },
    { name: "fender rhs", category: "BYD E2" },
    { name: "front bumper support bracket lhs", category: "BYD E2" },
    { name: "front bumper support bracket rhs", category: "BYD E2" },
    { name: "front wheel liner lhs", category: "BYD E2" },
    { name: "front wheel liner rhs", category: "BYD E2" },
    { name: "rear bumper lower support bracket lhs", category: "BYD E2" },
    { name: "rear bumper lower support bracket rhs", category: "BYD E2" },
    { name: "rear bumper support bracket lhs", category: "BYD E2" },
    { name: "rear bumper support bracket rhs", category: "BYD E2" },
    { name: "rear bumper upper support bracket lhs", category: "BYD E2" },
    { name: "rear bumper upper support bracket rhs", category: "BYD E2" },
    { name: "rear wheel liner lhs", category: "BYD E2" },
    { name: "rear wheel liner rhs", category: "BYD E2" },
    { name: "steering gear", category: "BYD E2" },
    { name: "tail light lhs", category: "BYD E2" },
    { name: "tail light rhs", category: "BYD E2" },
    { name: "water tank", category: "BYD E2" },
    { name: "windshield glass", category: "BYD E2" },
    { name: "FRONT BUMPER CENTER COVER", category: "VW ID 4" },
    { name: "FRONT BUMPER FOG COVER LHS", category: "VW ID 4" },
    { name: "FRONT BUMPER FOG COVER RHS", category: "VW ID 4" },
    { name: "FRONT BUMPER LOWER GRILL", category: "VW ID 4" },
    { name: "FRONT BUMPER LOWER MOLDING", category: "VW ID 4" },
    { name: "FRONT BUMPER UPPER", category: "VW ID 4" },
    { name: "FRONT CONTROL ARM lhs", category: "VW ID 4" },
    { name: "FRONT CONTROL ARM rhs", category: "VW ID 4" },
    { name: "FRONT WHEEL EYEBROW LHS", category: "VW ID 4" },
    { name: "FRONT WHEEL EYEBROW RHS", category: "VW ID 4" },
    { name: "HEADLIGHT LHS", category: "VW ID 4" },
    { name: "HEADLIGHT RHS", category: "VW ID 4" },
    { name: "HEADLIGHT SUPPORT", category: "VW ID 4" },
    { name: "REAR BUMPER", category: "VW ID 4" },
    { name: "REAR BUMPER EXTENSION LHS", category: "VW ID 4" },
    { name: "REAR BUMPER EXTENSION RHS", category: "VW ID 4" },
    { name: "REAR BUMPER LOWER CHROM", category: "VW ID 4" },
    { name: "REAR BUMPER LOWER MOLDING", category: "VW ID 4" },
    { name: "CHARGING DOOR ACTUATOR", category: "VW ID 6" },
    { name: "FRONT BUMPER AIR VENT LHS", category: "VW ID 6" },
    { name: "FRONT BUMPER AIR VENT RHS", category: "VW ID 6" },
    { name: "FRONT BUMPER CENTER COVER", category: "VW ID 6" },
    { name: "FRONT BUMPER FOG COVER LHS", category: "VW ID 6" },
    { name: "FRONT BUMPER FOG COVER RHS", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWER", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWER GRIL", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWER GRILL", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWER MOLDING", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWER RHS SUPPORT", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWR AIR DIFLECTOR LHS", category: "VW ID 6" },
    { name: "FRONT BUMPER LOWR AIR DIFLECTOR RHS", category: "VW ID 6" },
    { name: "FRONT BUMPER TOW COVER", category: "VW ID 6" },
    { name: "FRONT BUMPER UPPER", category: "VW ID 6" },
    { name: "FRONT BUMPER UPPER SUPPORT lhs", category: "VW ID 6" },
    { name: "FRONT BUMPER UPPER SUPPORT rhs", category: "VW ID 6" },
    { name: "FRONT DOOR MOLDING LHS", category: "VW ID 6" },
    { name: "FRONT DOOR MOLDING RHS", category: "VW ID 6" },
    { name: "FRONT LOGO(EMBLEM )", category: "VW ID 6" },
    { name: "FRONT WHEEL EYEBROW LHS", category: "VW ID 6" },
    { name: "FRONT WHEEL EYEBROW RHS", category: "VW ID 6" },
    { name: "FRONT WHEEL LINER LHS", category: "VW ID 6" },
    { name: "FRONT WHEEL LINER RHS", category: "VW ID 6" },
    { name: "HEADLIGHT LHS", category: "VW ID 6" },
    { name: "HEADLIGHT RHS", category: "VW ID 6" },
    { name: "PARKING SENSOR", category: "VW ID 6" },
    { name: "REAR BUMPER CROME", category: "VW ID 6" },
    { name: "REAR BUMPER CROME LHS", category: "VW ID 6" },
    { name: "REAR BUMPER CROME RHS", category: "VW ID 6" },
    { name: "REAR BUMPER IMPACT ABSORBER", category: "VW ID 6" },
    { name: "REAR BUMPER LOWER", category: "VW ID 6" },
    { name: "REAR BUMPER LOWER SUPPORT lhs", category: "VW ID 6" },
    { name: "REAR BUMPER MOLDING", category: "VW ID 6" },
    { name: "REAR BUMPER UPPER", category: "VW ID 6" },
    { name: "REAR BUMPER UPPER SUPPORT rhs", category: "VW ID 6" },
    { name: "REAR DOOR MOLDING LHS", category: "VW ID 6" },
    { name: "REAR DOOR MOLDING RHS", category: "VW ID 6" },
    { name: "REAR WHEEL EYEBROW LHS", category: "VW ID 6" },
    { name: "REAR WHEEL EYEBROW RHS", category: "VW ID 6" },
    { name: "REAR WHEEL LINER LHS", category: "VW ID 6" },
    { name: "REAR WHEEL LINER RHS", category: "VW ID 6" },
    { name: "air cleaner", category: "VW ID 6" },
    { name: "AIR DEFLECTOR", category: "BYD SEAGULL" },
    { name: "AIR FILTER", category: "BYD SEAGULL" },
    { name: "BALL JOINT", category: "BYD SEAGULL" },
    { name: "BRAKE PADS", category: "BYD SEAGULL" },
    { name: "CONTROL ARM", category: "BYD SEAGULL" },
    { name: "DRIVE SHAFT", category: "BYD SEAGULL" },
    { name: "FAN & SHROUD", category: "BYD SEAGULL" },
    { name: "FENDER lhs", category: "BYD SEAGULL" },
    { name: "FENDER rHS", category: "BYD SEAGULL" },
    { name: "FRONT CONTROL ARM LHS", category: "BYD SEAGULL" },
    { name: "FRONT CONTROL ARM RHS", category: "BYD SEAGULL" },
    { name: "FRONT DOOR MOLDING LHS", category: "BYD SEAGULL" },
    { name: "FRONT DOOR MOLDING RHS", category: "BYD SEAGULL" },
    { name: "FRONT SHOCK ABSORBER LHS", category: "BYD SEAGULL" },
    { name: "FRONT SHOCK ABSORBER RHS", category: "BYD SEAGULL" },
    { name: "FRONT SHOCK ABSORBER lhs", category: "BYD SEAGULL" },
    { name: "FRONT SHOCK ABSORBER rhs", category: "BYD SEAGULL" },
    { name: "FRONT/rear BREAK PAD", category: "BYD SEAGULL" },
    { name: "HEAD LIGHT SUPPORT lhs", category: "BYD SEAGULL" },
    { name: "HEAD LIGHT SUPPORT rhs", category: "BYD SEAGULL" },
    { name: "RADIATOR", category: "BYD SEAGULL" },
    { name: "REAR AIR VENT RHS", category: "BYD SEAGULL" },
    { name: "REAR DOOR MOLDING LHS", category: "BYD SEAGULL" },
    { name: "REAR DOOR MOLDING RHS", category: "BYD SEAGULL" },
    { name: "RHS FRONT WHEEL LINER", category: "BYD SEAGULL" },
    { name: "SENSOR", category: "BYD SEAGULL" },
    { name: "SRS ECU", category: "BYD SEAGULL" },
    { name: "STABLIZER LINK", category: "BYD SEAGULL" },
    { name: "STEERING KNUCLE(DISC) PROTECTOR", category: "BYD SEAGULL" },
    { name: "TAI ROAD END", category: "BYD SEAGULL" },
    { name: "TIE ROD", category: "BYD SEAGULL" },
    { name: "WATER JAR", category: "BYD SEAGULL" },
    { name: "FENDER EXTENSION", category: "BYD SONG PLUS" },
    { name: "FENDER LHS", category: "BYD SONG PLUS" },
    { name: "FOG LAMP COVER", category: "BYD SONG PLUS" },
    { name: "FRONT BUMPER SUPPORT RHS", category: "BYD SONG PLUS" },
    { name: "FRONT WHEEL EYEBROW LHS", category: "BYD SONG PLUS" },
    { name: "FRONT WHEEL EYEBROW RHS", category: "BYD SONG PLUS" },
    { name: "Ac condenser", category: "BYD SEAGULL" },
    { name: "Back door", category: "BYD SEAGULL" },
    { name: "Back door glass", category: "BYD SEAGULL" },
    { name: "Charging port cover", category: "BYD SEAGULL" },
    { name: "Co-pilot airbag", category: "BYD SEAGULL" },
    { name: "Driver airbag", category: "BYD SEAGULL" },
    { name: "Headlights LHS", category: "BYD SEAGULL" },
    { name: "Headlights RHS", category: "BYD SEAGULL" },
    { name: "Rear bumper", category: "BYD SEAGULL" },
    { name: "Rear view Mirror lhs", category: "BYD SEAGULL" },
    { name: "Rear view Mirror rhs", category: "BYD SEAGULL" },
    { name: "Spoiler", category: "BYD SEAGULL" },
    { name: "Tail light bar", category: "BYD SEAGULL" },
    { name: "aluminum wheel", category: "BYD SEAGULL" },
    { name: "curtain airbag", category: "BYD SEAGULL" },
    { name: "doors", category: "BYD SEAGULL" },
    { name: "engine hood", category: "BYD SEAGULL" },
    { name: "front bumper support bracket lhs", category: "BYD SEAGULL" },
    { name: "front bumper support bracket rhs", category: "BYD SEAGULL" },
    { name: "rear bumper lower support bracket lhs", category: "BYD SEAGULL" },
    { name: "rear bumper lower support bracket rhs", category: "BYD SEAGULL" },
    { name: "rear bumper upper support bracket lhs", category: "BYD SEAGULL" },
    { name: "rear bumper upper support bracket rhs", category: "BYD SEAGULL" },
    { name: "steering gear", category: "BYD SEAGULL" },
    { name: "steering knuckle hub", category: "BYD SEAGULL" },
    { name: "tail light LHS", category: "BYD SEAGULL" },
    { name: "tail light RHS", category: "BYD SEAGULL" },
    { name: "wheel eyebrow front lhs", category: "BYD SEAGULL" },
    { name: "wheel eyebrow front rhs", category: "BYD SEAGULL" },
    { name: "wheel eyebrow rear lhs", category: "BYD SEAGULL" },
    { name: "wheel eyebrow rear rhs", category: "BYD SEAGULL" },
    { name: "wheel liner front lhs", category: "BYD SEAGULL" },
    { name: "wheel liner front rhs", category: "BYD SEAGULL" },
    { name: "wheel liner rear lhs", category: "BYD SEAGULL" },
    { name: "wheel liner rear rhs", category: "BYD SEAGULL" },
    { name: "windshield glass", category: "BYD SEAGULL" },
    { name: "Rear view Mirror lhs", category: "BYD SONG PLUS" },
    { name: "Rear view Mirror only lhs", category: "BYD SONG PLUS" },
    { name: "Rear view Mirror only rhs", category: "BYD SONG PLUS" },
    { name: "Rear view Mirror rhs", category: "BYD SONG PLUS" },
    { name: "front bumper upper", category: "BYD SONG PLUS" },
    { name: "headlight lhs", category: "BYD SONG PLUS" },
    { name: "headlight rhs", category: "BYD SONG PLUS" },
    { name: "rear bumper upper", category: "BYD SONG PLUS" },
    { name: "tail light bar", category: "BYD SONG PLUS" },
    { name: "tail light lhs", category: "BYD SONG PLUS" },
    { name: "tail light rhs", category: "BYD SONG PLUS" },
    { name: "ENGINE HOOD", category: "BYD YUAN UP" },
    { name: "FRONT BUMPER STRIP MIDDLE", category: "BYD YUAN UP" },
    { name: "FRONT DOOR MOLDING LHS", category: "BYD YUAN UP" },
    { name: "FRONT DOOR MOLDING RHS", category: "BYD YUAN UP" },
    { name: "FRONT WHEEL EYEBROW LHS", category: "BYD YUAN UP" },
    { name: "FRONT WHEEL EYEBROW RHS", category: "BYD YUAN UP" },
    { name: "FRONT WHEEL LINER LHS", category: "BYD YUAN UP" },
    { name: "FRONT WHEEL LINER RHS", category: "BYD YUAN UP" },
    { name: "REAR BUMPER STRIP MOLDING LHS", category: "BYD YUAN UP" },
    { name: "REAR DOOR MOLDING LHS", category: "BYD YUAN UP" },
    { name: "REAR DOOR MOLDING RHS", category: "BYD YUAN UP" },
    { name: "REAR WHEEL EYEBROW LHS", category: "BYD YUAN UP" },
    { name: "REAR WHEEL EYEBROW RHS", category: "BYD YUAN UP" },
    { name: "REAR WHEEL LINER LHS", category: "BYD YUAN UP" },
    { name: "REAR WHEEL LINER RHS", category: "BYD YUAN UP" },
    { name: "TAILGATE", category: "BYD YUAN UP" },
    { name: "rear bumper lower", category: "BYD YUAN UP" },
    { name: "front bumper Camera holder", category: "BYD YUAN UP" },
    { name: "front bumper fog cover lhs", category: "BYD YUAN UP" },
    { name: "front bumper fog cover rhs", category: "BYD YUAN UP" },
    { name: "front bumper lower", category: "BYD YUAN UP" },
    { name: "front bumper upper", category: "BYD YUAN UP" },
    { name: "headlight lhs", category: "BYD YUAN UP" },
    { name: "headlight rhs", category: "BYD YUAN UP" },
    { name: "lhs Rear view Mirror", category: "BYD YUAN UP" },
    { name: "rear bumper", category: "BYD YUAN UP" },
    { name: "rear bumper extension lhs", category: "BYD YUAN UP" },
    { name: "rear bumper extension rhs", category: "BYD YUAN UP" },
    { name: "rhs Rear view Mirror", category: "BYD YUAN UP" },
    { name: "tail light bar", category: "BYD YUAN UP" },
    { name: "tail light lhs", category: "BYD YUAN UP" },
    { name: "tail light rhs", category: "BYD YUAN UP" },
    { name: "front bumper extension lhs", category: "TOYOTA BZ4X" },
    { name: "front bumper extension rhs", category: "TOYOTA BZ4X" },
    { name: "rear view mirror only lhs", category: "TOYOTA BZ4X" },
    { name: "rear view mirror only rhs", category: "TOYOTA BZ4X" },
    { name: "wheel eyebrow front lhs", category: "TOYOTA BZ4X" },
    { name: "wheel eyebrow rear lhs", category: "TOYOTA BZ4X" },
    { name: "wheel eyebrow rear rhs", category: "TOYOTA BZ4X" },
    { name: "front bumper charge door", category: "CHANGAN E-STAR" },
    { name: "front bumper fog molding lhs", category: "CHANGAN E-STAR" },
    { name: "front bumper fog molding rhs", category: "CHANGAN E-STAR" },
    { name: "front bumper grill", category: "CHANGAN E-STAR" },
    { name: "front bumper hook cover", category: "CHANGAN E-STAR" },
    { name: "front bumper support middel", category: "CHANGAN E-STAR" },
    { name: "front bumper upper", category: "CHANGAN E-STAR" },
    { name: "front bumper upper molding", category: "CHANGAN E-STAR" },
    { name: "front/rear logo", category: "CHANGAN E-STAR" },
    { name: "headlight lhs", category: "CHANGAN E-STAR" },
    { name: "headlight rhs", category: "CHANGAN E-STAR" },
    { name: "rear bumper", category: "CHANGAN E-STAR" },
    { name: "rear bumper hook cover", category: "CHANGAN E-STAR" },
    { name: "rear bumper reflector lhs", category: "CHANGAN E-STAR" },
    { name: "rear bumper reflector rhs", category: "CHANGAN E-STAR" },
    { name: "tail gate", category: "CHANGAN E-STAR" },
    { name: "tail gate glass", category: "CHANGAN E-STAR" },
    { name: "tail light lhs", category: "CHANGAN E-STAR" },
    { name: "tail light rhs", category: "CHANGAN E-STAR" },
    { name: "windshield", category: "CHANGAN E-STAR" },
    { name: "control arm lhs", category: "BYD E2" },
    { name: "fender lhs", category: "BYD E2" },
    { name: "front bumper fog molding lhs", category: "BYD E2" },
    { name: "front bumper fog molding rhs", category: "BYD E2" },
    { name: "front bumper hook cover", category: "BYD E2" },
    { name: "front bumper logo", category: "BYD E2" },
    { name: "front bumper lower", category: "BYD E2" },
    { name: "front bumper upper molding", category: "BYD E2" },
    { name: "rear bumper lower", category: "BYD E2" },
    { name: "rear bumper upper", category: "BYD E2" },
    { name: "rear bumper vent molding lhs", category: "BYD E2" },
    { name: "rear bumper vent molding rhs", category: "BYD E2" },
    { name: "shock absorber front lhs", category: "BYD E2" },
    { name: "shock absorber rear lhs", category: "BYD E2" },
    { name: "shock absorber rear rhs", category: "BYD E2" },
    { name: "door handel front lhs", category: "VW ID 4" },
    { name: "tail light rhs", category: "VW ID 4" },
    { name: "charging door cover", category: "VW ID 6" },
    { name: "curtain air bag", category: "VW ID 6" },
    { name: "front bumper vent grill lhs", category: "VW ID 6" },
    { name: "front bumper vent grill rhs", category: "VW ID 6" },
    { name: "front harnes cabel", category: "VW ID 6" },
    { name: "headlight support lhs", category: "VW ID 6" },
    { name: "headlight support rhs", category: "VW ID 6" },
    { name: "engine hood hinge lhs", category: "BYD SEAGULL" },
    { name: "engine hood hinge rhs", category: "BYD SEAGULL" },
    { name: "front bumper logo", category: "BYD SEAGULL" },
    { name: "front bumper lower", category: "BYD SEAGULL" },
    { name: "front bumper molding lhs", category: "BYD SEAGULL" },
    { name: "front bumper molding rhs", category: "BYD SEAGULL" },
    { name: "front bumper upper", category: "BYD SEAGULL" },
    { name: "front bumpert hook cover", category: "BYD SEAGULL" },
    { name: "rear bumper extension lhs", category: "BYD SEAGULL" },
    { name: "rear bumper extension rhs", category: "BYD SEAGULL" },
    { name: "rear bumper molding lhs", category: "BYD SEAGULL" },
    { name: "rear bumper molding rhs", category: "BYD SEAGULL" },
    { name: "rear bumper reflector lhs", category: "BYD SEAGULL" },
    { name: "rear bumper reflector rhs", category: "BYD SEAGULL" },
    { name: "rear view mirror only lhs", category: "BYD SEAGULL" },
    { name: "rear view mirror only rhs", category: "BYD SEAGULL" },
    { name: "Spoiler", category: "BYD SEAGULL" },
    { name: "Tail light bar", category: "BYD SEAGULL" },
    { name: "aluminum wheel", category: "BYD SEAGULL" },
    { name: "curtain airbag", category: "BYD SEAGULL" },
    { name: "doors", category: "BYD SEAGULL" },
    { name: "engine hood", category: "BYD SEAGULL" },
    { name: "front bumper support bracket lhs", category: "BYD SEAGULL" },
    { name: "front bumper support bracket rhs", category: "BYD SEAGULL" },
    { name: "rear bumper lower support bracket lhs", category: "BYD SEAGULL" },
    { name: "rear bumper lower support bracket rhs", category: "BYD SEAGULL" },
    { name: "rear bumper upper support bracket lhs", category: "BYD SEAGULL" },
    { name: "rear bumper upper support bracket rhs", category: "BYD SEAGULL" },
    { name: "steering gear", category: "BYD SEAGULL" },
    { name: "steering knuckle hub", category: "BYD SEAGULL" },
    { name: "tail light LHS", category: "BYD SEAGULL" },
    { name: "tail light RHS", category: "BYD SEAGULL" },
    { name: "wheel eyebrow front lhs", category: "BYD SEAGULL" },
    { name: "wheel eyebrow front rhs", category: "BYD SEAGULL" },
    { name: "wheel eyebrow rear lhs", category: "BYD SEAGULL" },
    { name: "wheel eyebrow rear rhs", category: "BYD SEAGULL" },
    { name: "wheel liner front lhs", category: "BYD SEAGULL" },
    { name: "wheel liner front rhs", category: "BYD SEAGULL" },
    { name: "wheel liner rear lhs", category: "BYD SEAGULL" },
    { name: "wheel liner rear rhs", category: "BYD SEAGULL" },
    { name: "windshield glass", category: "BYD SEAGULL" },
    { name: "FRONT BUMPER fog cover lhs", category: "BYD SONG PLUS" },
    { name: "FRONT BUMPER fog cover rhs", category: "BYD SONG PLUS" },
    { name: "FRONT BUMPER hook cover", category: "BYD SONG PLUS" },
    { name: "doors", category: "BYD SONG PLUS" },
    { name: "front bumper lower", category: "BYD SONG PLUS" },
    { name: "rear bumper Lower", category: "BYD SONG PLUS" },
    { name: "rear bumper lower molding", category: "BYD SONG PLUS" },
    { name: "rear vent molding lhs", category: "BYD SONG PLUS" },
    { name: "rear vent molding rhs", category: "BYD SONG PLUS" },
    { name: "wheel liner", category: "BYD SONG PLUS" },
    { name: "front bumper strip molding lhs", category: "BYD YUAN UP" },
    { name: "front bumper strip molding rhs", category: "BYD YUAN UP" },
    { name: "rear bumper strip molding", category: "BYD YUAN UP" },
    { name: "rear bumper strip molding rhs", category: "BYD YUAN UP" }
  ];

  const products = baseProducts.map(product => ({
    ...product,
    price: Math.floor(Math.random() * 450) + 50
  }));

  const categories = Array.from(new Set(products.map((product) => product.category))).map((name) => ({ name }));
  for (const category of categories) {
    const existingCategory = await getStorage().getAllCategories().then(cats => cats.find(c => c.name === category.name));
    if (!existingCategory) {
      await getStorage().createCategory(category);
    }
  }

  for (const product of products) {
    const existingProduct = await getStorage().getAllProducts().then(prods => prods.find(p => p.name === product.name && p.category === product.category));
    if (!existingProduct) {
      await getStorage().createProduct(product);
    }
  }
}
