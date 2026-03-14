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
    mutationFn: async (product: Omit<Product, "_id">) => {
      const res = await apiRequest("POST", "/api/products", product);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
    // optimistic update: immediately adjust cache before server responds
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
        // also refetch in background to be safe
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.refetchQueries({ queryKey: ["products"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("DELETE", `/api/categories/${name}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}