import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { apiRequest } from "./queryClient";

type Role = "admin" | "worker" | null;

interface User {
  _id: string;
  username: string;
  password: string;
  role: Role;
}

interface AuthContextType {
  role: Role;
  users: User[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (username: string, password: string, role: Role) => Promise<boolean>;
  removeUser: (username: string) => Promise<boolean>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // use sessionStorage instead of localStorage so each tab can have its own role
  const [role, setRole] = useState<Role>(() => {
    const storedRole = sessionStorage.getItem("role");
    return storedRole === "admin" || storedRole === "worker" ? (storedRole as Role) : null;
  });

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (role) {
      refreshUsers();
    }
  }, [role]);

  const refreshUsers = async () => {
    try {
      const res = await apiRequest("GET", "/api/users");
      const usersData = await res.json();
      setUsers(usersData);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await apiRequest("POST", "/api/login", { username, password });
      const user = await res.json();
      const loginRole = user.role === "admin" || user.role === "worker" ? user.role : "worker";
      setRole(loginRole);
      sessionStorage.setItem("role", loginRole);
      await refreshUsers();
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    setRole(null);
    setUsers([]);
    sessionStorage.removeItem("role");
  };

  const addUser = async (username: string, password: string, role: Role): Promise<boolean> => {
    try {
      await apiRequest("POST", "/api/users", { username, password, role });
      await refreshUsers();
      return true;
    } catch (error) {
      console.error("Failed to add user:", error);
      return false;
    }
  };

  const removeUser = async (username: string): Promise<boolean> => {
    if (username === "kidus") return false; // Can't delete admin
    try {
      await apiRequest("DELETE", `/api/users/${username}`);
      await refreshUsers();
      return true;
    } catch (error) {
      console.error("Failed to remove user:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ role, users, login, logout, addUser, removeUser, refreshUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
