import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export interface Product {
  _id: string;
  name: string;
  category: string;
  price: number;
}

export interface Category {
  _id: string;
  name: string;
}

// Products hooks
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products");
      return res.json() as Promise<Product[]>;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: Partial<Omit<Product, "_id">>) => {
      const res = await apiRequest("POST", "/api/products", product);
      return res.json();
    },
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const previous = queryClient.getQueryData<Product[]>(["products"]);
      const tempProduct: Product = {
        _id: `temp-${Date.now()}`,
        name: product.name || "Untitled",
        category: product.category || "Uncategorized",
        price: product.price ?? 0,
      };
      queryClient.setQueryData<Product[]>(["products"], (old) =>
        old ? [...old, tempProduct] : [tempProduct],
      );
      return { previous, tempId: tempProduct._id };
    },
    onError: (err, product, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["products"], context.previous);
      }
    },
    onSuccess: (createdProduct: Product, _product, context: any) => {
      queryClient.setQueryData<Product[]>(["products"], (old) =>
        old
          ? old.map((p) => (p._id === context?.tempId ? createdProduct : p))
          : [createdProduct],
      );
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, product }: { id: string; product: Partial<Omit<Product, "_id">> }) => {
      const res = await apiRequest("PUT", `/api/products/${id}`, product);
      return res.json();
    },
    onMutate: async ({ id, product }) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const previous = queryClient.getQueryData<Product[]>(["products"]);
      queryClient.setQueryData<Product[]>(["products"], (old) =>
        old
          ? old.map((p) => (p._id === id ? { ...p, ...product } : p))
          : old,
      );
      return { previous };
    },
    onError: (err, vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["products"], context.previous);
      }
    },
    onSuccess: (updatedProduct: Product) => {
      queryClient.setQueryData<Product[]>(["products"], (old) =>
        old ? old.map((p) => (p._id === updatedProduct._id ? updatedProduct : p)) : [updatedProduct],
      );
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const previous = queryClient.getQueryData<Product[]>(["products"]);
      queryClient.setQueryData<Product[]>(["products"], (old) =>
        old ? old.filter((p) => p._id !== id) : old,
      );
      return { previous };
    },
    onError: (err, id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["products"], context.previous);
      }
    },
  });
}

// subscribe to server-sent events for product changes; invalidates cache on each event
export function useProductUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/products/stream");
    es.onopen = () => console.debug("Product stream connected");
    es.onmessage = (e) => {
      console.debug("Product stream event", e.data);
      try {
        const data = JSON.parse(e.data);
        // apply changes immediately based on payload
        queryClient.setQueryData<Product[]>(["products"], (old) => {
          if (!old) return old;
          switch (data.type) {
            case "create":
              return [...old, data.product];
            case "update":
              return old.map((p) => (p._id === data.product._id ? data.product : p));
            case "delete":
              return old.filter((p) => p._id !== data.id);
            default:
              return old;
          }
        });
        // Avoid repeated refetches from SSE events to keep UX responsive
      } catch (_err) {
        console.warn("Malformed product event", e.data);
      }
    };
    es.onerror = (err) => {
      console.error("Product stream error", err);
      // EventSource will auto-reconnect
    };
    return () => {
      es.close();
    };
  }, [queryClient]);
}

// Categories hooks
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/categories");
      return res.json() as Promise<Category[]>;
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: Omit<Category, "_id">) => {
      const res = await apiRequest("POST", "/api/categories", category);
      return res.json();
    },
    onMutate: async (category) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previous = queryClient.getQueryData<Category[]>(["categories"]);
      const tempCategory: Category = {
        _id: `temp-cat-${Date.now()}`,
        name: category.name,
      };
      queryClient.setQueryData<Category[]>(["categories"], (old) =>
        old ? [...old, tempCategory] : [tempCategory],
      );
      return { previous, tempId: tempCategory._id };
    },
    onError: (err, category, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["categories"], context.previous);
      }
    },
    onSuccess: (createdCategory: Category, _category, context: any) => {
      queryClient.setQueryData<Category[]>(["categories"], (old) =>
        old
          ? old.map((c) => (c._id === context?.tempId ? createdCategory : c))
          : [createdCategory],
      );
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("DELETE", `/api/categories/${name}`);
      return name;
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: ["categories"] });
      const previous = queryClient.getQueryData<Category[]>(["categories"]);
      queryClient.setQueryData<Category[]>(["categories"], (old) =>
        old ? old.filter((c) => c.name !== name) : old,
      );
      return { previous };
    },
    onError: (err, name, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["categories"], context.previous);
      }
    },
  });
}