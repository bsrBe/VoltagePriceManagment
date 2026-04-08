import type { Express } from "express";
import { createServer, type Server } from "http";
import { EventEmitter } from "events";
import { getStorage } from "./storage";
import { insertProductSchema, insertCategorySchema, insertUserSchema } from "@shared/schema";

// emitter used for notifying connected clients about product changes
export const productEvents = new EventEmitter();


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Products API
  app.get("/api/products", async (req, res) => {
    try {
      const products = await getStorage().getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Server‑Sent Events stream for product changes
  app.get("/api/products/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const onChange = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    productEvents.on("change", onChange);

    // clean up when client disconnects
    res.on("close", () => {
      productEvents.off("change", onChange);
      res.end();
    });
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await getStorage().createProduct(validatedData);
      // notify listeners
      productEvents.emit("change", { type: "create", product });
      console.log("[SSE] emitted create event", product._id);
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertProductSchema.parse(req.body);
      const product = await getStorage().updateProduct(id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      productEvents.emit("change", { type: "update", product });
      console.log("[SSE] emitted update event", product._id);
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await getStorage().deleteProduct(id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      productEvents.emit("change", { type: "delete", id });
      console.log("[SSE] emitted delete event", id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Categories API
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await getStorage().getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await getStorage().createCategory(validatedData);
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });

  app.delete("/api/categories/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const deleted = await getStorage().deleteCategory(name);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Auth API
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body as { username: string; password: string };

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await getStorage().getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({ username: user.username, role: user.role });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    try {
      const users = await getStorage().getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await getStorage().createUser(validatedData);
      res.json(user);
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(400).json({ error: "Invalid user data" });
      }
    }
  });

  app.delete("/api/users/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const deleted = await getStorage().deleteUser(username);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  return httpServer;
}
