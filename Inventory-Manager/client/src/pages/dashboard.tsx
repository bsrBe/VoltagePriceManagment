import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  LogOut, 
  Users, 
  Tags, 
  Save,
  X,
  MoreVertical,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useProducts, useCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, useCreateCategory, useDeleteCategory, useProductUpdates } from "@/hooks/api";

// helpers for formatting / parsing monetary values
// format number for display outside of inputs (always show two decimals)
const formatPriceDisplay = (num: number) =>
  num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// format a string that may be partially typed by the user; keeps commas and preserves decimal entry
const formatPriceInput = (val: string) => {
  if (val === null || val === undefined) return "";
  // strip existing commas then re-insert
  const [intPart, decPart] = val.replace(/,/g, "").split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
};

const parsePriceString = (val: string) => {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

export default function Dashboard() {
  const { role, logout, users, addUser, removeUser } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = role === "admin";

  // API hooks
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // subscribe to product stream for real-time updates
  useProductUpdates();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState<Record<string, any>>({});
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "" });
  const [newCategory, setNewCategory] = useState("");
  const [isAddWorkerDialogOpen, setIsAddWorkerDialogOpen] = useState(false);
  const [newWorker, setNewWorker] = useState({ username: "", password: "" });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Navigation state
  // remember which tab is open in this session; defaults to products
  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem("activeTab") || "products";
  });

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  // persist tab choice in sessionStorage
  useEffect(() => {
    sessionStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 180);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery) return products;

    const tokens = debouncedSearchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((p) =>
      tokens.every((tok) =>
        p.name.toLowerCase().includes(tok) ||
        p.category.toLowerCase().includes(tok),
      ),
    );
  }, [products, debouncedSearchQuery]);

  const toggleEditMode = () => {
    if (isEditMode) {
      setEditedProducts({});
      setIsEditMode(false);
    } else {
      // convert existing numbers to formatted strings for editing
      const currentEdits = products.reduce((acc, p) => {
        acc[p._id] = {
          ...p,
          price: formatPriceInput(p.price.toString()),
        };
        return acc;
      }, {} as Record<string, any>);
      setEditedProducts(currentEdits);
      setIsEditMode(true);
    }
  };

  const saveEdits = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(editedProducts)
        .map(([id, product]) => {
          const original = products.find((p) => p._id === id);
          if (!original) return null;

          const prodCopy = { ...product } as any;
          if (prodCopy.price && typeof prodCopy.price === "string") {
            prodCopy.price = parsePriceString(prodCopy.price);
          }

          const changes: Partial<Pick<typeof product, "name" | "category" | "price">> = {};
          if (prodCopy.name !== original.name) changes.name = prodCopy.name;
          if (prodCopy.category !== original.category) changes.category = prodCopy.category;
          if (prodCopy.price !== original.price) changes.price = prodCopy.price;

          if (Object.keys(changes).length === 0) {
            return null;
          }

          return updateProductMutation.mutateAsync({ id, product: changes });
        })
        .filter(Boolean) as Promise<unknown>[];

      if (promises.length > 0) {
        await Promise.all(promises);
      }
      setIsEditMode(false);
      setEditedProducts({});
    } catch (error) {
      console.error("Failed to save edits:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditChange = (id: string, field: string, value: string | number) => {
    setEditedProducts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]:
          field === "price"
            ? // always keep formatted string in state
              formatPriceInput(String(value))
            : value,
      },
    }));
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProductMutation.mutateAsync(id);
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  const handleAddProduct = async () => {
    const trimmedName = newProduct.name.trim();
    const trimmedCategory = newProduct.category.trim();
    const parsedPrice = newProduct.price ? parsePriceString(newProduct.price) : undefined;

    const payload: Partial<{
      name: string;
      category: string;
      price: number;
    }> = {};

    if (trimmedName) payload.name = trimmedName;
    if (trimmedCategory) payload.category = trimmedCategory;
    if (parsedPrice !== undefined && parsedPrice >= 0) payload.price = parsedPrice;

    if (!payload.name && !payload.category && payload.price === undefined) {
      console.error("At least one of Name, Category, or Price must be provided.");
      return;
    }

    try {
      await createProductMutation.mutateAsync(payload);
      setNewProduct({ name: "", category: "", price: "" });
      setIsAddProductDialogOpen(false);
    } catch (error) {
      console.error("Failed to add product:", error);
    }
  };

  const handleAddCategory = async () => {
    if (newCategory.trim() && !categories.some(c => c.name === newCategory)) {
      try {
        await createCategoryMutation.mutateAsync({ name: newCategory });
        setNewCategory("");
        setIsAddCategoryDialogOpen(false);
      } catch (error) {
        console.error("Failed to add category:", error);
      }
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    // Only allow deletion if no products use this category
    const isInUse = products.some(p => p.category === categoryName);
    if (!isInUse) {
      try {
        await deleteCategoryMutation.mutateAsync(categoryName);
      } catch (error) {
        console.error("Failed to delete category:", error);
      }
    }
  };

  const handleAddWorker = async () => {
    if (newWorker.username.trim() && newWorker.password.trim()) {
      const success = await addUser(newWorker.username, newWorker.password, "worker");
      if (success) {
        setNewWorker({ username: "", password: "" });
        setIsAddWorkerDialogOpen(false);
      } else {
        alert("Username already exists");
      }
    }
  };

  const handleDeleteWorker = async (username: string) => {
    const success = await removeUser(username);
    if (!success) {
      alert("Cannot delete this user");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground flex w-full">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-black/40 flex flex-col backdrop-blur-xl transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-2 text-primary">
            <Package className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-white">ProductFlow</span>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          <button 
            onClick={() => setActiveTab("products")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === "products" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
          >
            <Package className="w-5 h-5" />
            <span className="font-medium">Products</span>
          </button>
          <button 
            onClick={() => setActiveTab("categories")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === "categories" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
            data-testid="nav-categories"
          >
            <Tags className="w-5 h-5" />
            <span className="font-medium">Categories</span>
          </button>
          <button 
            onClick={() => setActiveTab("workers")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === "workers" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Workers</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between px-2 py-2 mb-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                {role?.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none capitalize">{role}</span>
                <span className="text-xs text-muted-foreground">Logged in</span>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              {isAdmin ? "Admin" : "Read-only"}
            </Badge>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-white hover:bg-white/5 border-0" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-white/10 bg-black/20 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-white"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg lg:text-xl font-semibold capitalize">{activeTab}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-full sm:w-64 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or category..." 
                className="pl-9 bg-black/40 border-white/10 h-10 w-full rounded-full focus-visible:ring-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          {activeTab === "products" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Price Management</h2>
                  <p className="text-muted-foreground mt-1">Manage your catalog and pricing.</p>
                </div>
                
                {isAdmin && (
                  <div className="flex items-center gap-3">
                    {isEditMode ? (
                      <>
                        <Button variant="ghost" onClick={toggleEditMode} className="text-muted-foreground hover:text-white" data-testid="button-cancel-edit">
                          <X className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                        <Button onClick={saveEdits} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20" data-testid="button-save-edits">
                          {isSaving ? (
                            <>
                              <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" /> Save
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={toggleEditMode} className="border-white/10 hover:bg-white/5" data-testid="button-bulk-edit">
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </Button>
                        <Button onClick={() => setIsAddProductDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20" data-testid="button-add-product">
                          <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <div className="bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                  <Table className="w-full table-fixed">
                    <TableHeader className="bg-black/40">
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="w-1/2 text-muted-foreground font-medium">Product Name</TableHead>
                        <TableHead className="w-1/4 text-muted-foreground font-medium">Category</TableHead>
                        <TableHead className="w-1/6 text-right text-muted-foreground font-medium">Price</TableHead>
                        {isAdmin && !isEditMode && <TableHead className="w-1/12 text-right text-muted-foreground font-medium">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableCell colSpan={isAdmin && !isEditMode ? 5 : 4} className="h-32 text-center text-muted-foreground">
                            No products found matching "{searchQuery}"
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map((product) => {
                          const isEditing = isEditMode;
                          const editData = editedProducts[product._id] || product;

                          return (
                            <TableRow key={product._id} className="border-white/10 hover:bg-white/[0.02] transition-colors group">
                              <TableCell className="font-medium">
                                {isEditing ? (
                                  <Input 
                                    value={editData.name} 
                                    onChange={(e) => handleEditChange(product._id, 'name', e.target.value)}
                                    className="h-9 bg-black/50 border-white/20 focus-visible:ring-primary/50 w-full"
                                    data-testid={`input-edit-name-${product._id}`}
                                  />
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary/70">
                                      <Package className="w-5 h-5" />
                                    </div>
                                    <span className="truncate">{product.name}</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select value={editData.category} onValueChange={(val) => handleEditChange(product._id, 'category', val)}>
                                    <SelectTrigger className="h-9 bg-black/50 border-white/20 focus-visible:ring-primary/50 w-full" data-testid={`select-edit-category-${product._id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-white/10">
                                      {categories.map((cat) => (
                                        <SelectItem key={cat._id} value={cat.name}>{cat.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white/80 font-normal border-0 truncate">
                                    {product.category}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <div className="flex justify-end">
                                    <Input 
                                      type="text"
                                      // display comma-separated value while editing
                                      value={formatPriceInput(editData.price)}
                                      onChange={(e) => {
                                        handleEditChange(product._id, 'price', e.target.value);
                                      }}
                                      className="h-9 pl-3 bg-black/50 border-white/20 focus-visible:ring-primary/50 text-right w-24"
                                      data-testid={`input-edit-price-${product._id}`}
                                    />
                                  </div>
                                ) : (
                                  <span className="font-mono">{product.price ? product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</span>
                                )}
                              </TableCell>
                              {isAdmin && !isEditMode && (
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-white">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-card border-white/10 text-foreground">
                                      <DropdownMenuItem className="gap-2 focus:bg-white/10" onClick={() => toggleEditMode()}>
                                        <Edit2 className="w-4 h-4" /> Edit Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive gap-2 focus:bg-destructive/20 focus:text-destructive" onClick={() => handleDelete(product._id)} disabled={deleteProductMutation.isPending}>
                                        {deleteProductMutation.isPending ? (
                                          <>
                                            <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Deleting...
                                          </>
                                        ) : (
                                          <>
                                            <Trash2 className="w-4 h-4" /> Delete Product
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="block lg:hidden">
                <div className="space-y-4">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-white/10 rounded-xl bg-black/20">
                      <Package className="w-12 h-12 opacity-30 mb-3" />
                      <p className="text-lg font-medium">No products found</p>
                      <p className="text-sm">No products match "{searchQuery}"</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const isEditing = isEditMode;
                      const editData = editedProducts[product._id] || product;

                      return (
                        <Card key={product._id} className="bg-card border border-white/10 shadow-xl">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <Input 
                                    value={editData.name} 
                                    onChange={(e) => handleEditChange(product._id, 'name', e.target.value)}
                                    className="h-10 bg-black/50 border-white/20 focus-visible:ring-primary/50 text-lg font-semibold"
                                    data-testid={`input-edit-name-${product._id}`}
                                  />
                                ) : (
                                  <CardTitle className="text-lg font-semibold text-white leading-tight">
                                    {product.name}
                                  </CardTitle>
                                )}
                              </div>
                              {isAdmin && !isEditMode && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white shrink-0">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-card border-white/10 text-foreground">
                                    <DropdownMenuItem className="gap-2 focus:bg-white/10" onClick={() => toggleEditMode()}>
                                      <Edit2 className="w-4 h-4" /> Edit Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive gap-2 focus:bg-destructive/20 focus:text-destructive" onClick={() => handleDelete(product._id)} disabled={deleteProductMutation.isPending}>
                                      {deleteProductMutation.isPending ? (
                                        <>
                                          <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        <>
                                          <Trash2 className="w-4 h-4" /> Delete Product
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {isEditing ? (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">Category</Label>
                                  <Select value={editData.category} onValueChange={(val) => handleEditChange(product._id, 'category', val)}>
                                    <SelectTrigger className="h-10 bg-black/50 border-white/20 focus-visible:ring-primary/50" data-testid={`select-edit-category-${product._id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-white/10">
                                      {categories.map((cat) => (
                                        <SelectItem key={cat._id} value={cat.name}>{cat.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-sm text-muted-foreground mb-2 block">Price</Label>
                                  <Input 
                                    type="text"
                                    value={formatPriceInput(editData.price)}
                                    onChange={(e) => handleEditChange(product._id, 'price', e.target.value)}
                                    className="h-10 bg-black/50 border-white/20 focus-visible:ring-primary/50 text-xl font-mono text-primary"
                                    data-testid={`input-edit-price-${product._id}`}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Category:</span>
                                  <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white/80 font-normal border-0">
                                    {product.category}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">Price:</span>
                                  <span className="text-xl font-mono font-bold text-primary">
                                    ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "categories" && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Categories Toolbar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Category Management</h2>
                  <p className="text-muted-foreground mt-1">Manage product categories and organize your inventory.</p>
                </div>
                
                {isAdmin && (
                  <Button onClick={() => setIsAddCategoryDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20" data-testid="button-add-category">
                    <Plus className="w-4 h-4 mr-2" /> Add Category
                  </Button>
                )}
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-48 text-muted-foreground border border-white/10 rounded-lg bg-black/20">
                    <Tags className="w-12 h-12 opacity-30 mb-3" />
                    <p className="text-lg font-medium">No categories yet</p>
                    <p className="text-sm">Create your first category to get started</p>
                  </div>
                ) : (
                  categories.map((category) => {
                    const productCount = products.filter(p => p.category === category.name).length;
                    return (
                      <div key={category._id} className="bg-card border border-white/10 rounded-lg p-4 hover:border-primary/30 transition-colors group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-white">{category.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{productCount} {productCount === 1 ? 'product' : 'products'}</p>
                          </div>
                          {isAdmin && productCount === 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteCategory(category.name)}
                              disabled={deleteCategoryMutation.isPending}
                              data-testid={`button-delete-category-${category.name}`}
                            >
                              {deleteCategoryMutation.isPending ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === "workers" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Workers Toolbar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Worker Management</h2>
                  <p className="text-muted-foreground mt-1">Manage worker accounts and access.</p>
                </div>
                
                {isAdmin && (
                  <Button onClick={() => setIsAddWorkerDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20" data-testid="button-add-worker">
                    <Plus className="w-4 h-4 mr-2" /> Add Worker
                  </Button>
                )}
              </div>

              {/* Workers Table */}
              <div className="bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                <Table>
                  <TableHeader className="bg-black/40">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-medium">Username</TableHead>
                      <TableHead className="text-muted-foreground font-medium">Role</TableHead>
                      {isAdmin && <TableHead className="w-[100px] text-right text-muted-foreground font-medium">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableCell colSpan={isAdmin ? 3 : 2} className="h-32 text-center text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.username} className="border-white/10 hover:bg-white/[0.02] transition-colors group">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary/70">
                                <Users className="w-5 h-5" />
                              </div>
                              <span className="truncate">{user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white/80 font-normal border-0 capitalize">
                              {user.role}
                            </Badge>
                          </TableCell>
                          {isAdmin && user.role !== "admin" && (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-white">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-white/10 text-foreground">
                                  <DropdownMenuItem className="text-destructive gap-2 focus:bg-destructive/20 focus:text-destructive" onClick={() => handleDeleteWorker(user.username)}>
                                    <Trash2 className="w-4 h-4" /> Delete Worker
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab !== "products" && activeTab !== "categories" && activeTab !== "workers" && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Package className="w-16 h-16 opacity-20 mb-4" />
              <p className="text-xl font-medium text-white/50">{activeTab} View Placeholder</p>
              <p className="text-sm mt-2">This section is coming soon.</p>
            </div>
          )}
        </div>
      </main>

      {/* Add Product Dialog */}
      <Dialog open={isAddProductDialogOpen} onOpenChange={setIsAddProductDialogOpen}>
        <DialogContent className="bg-card border-white/10 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Add New Product</DialogTitle>
            <DialogDescription>Enter product details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="e.g., Wireless Headphones"
                className="bg-black/40 border-white/10 focus-visible:ring-primary/50 h-10"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                data-testid="input-product-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                <SelectTrigger id="product-category" className="bg-black/40 border-white/10 focus-visible:ring-primary/50 h-10" data-testid="select-product-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="bg-card border-white/10">
                  {categories.map((cat) => (
                    <SelectItem key={cat._id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Price</Label>
              <Input
                id="product-price"
                type="text"
                placeholder="0.00"
                className="bg-black/40 border-white/10 focus-visible:ring-primary/50 h-10"
                value={formatPriceInput(newProduct.price)}
                onChange={(e) => {
                  const formatted = formatPriceInput(e.target.value);
                  setNewProduct({ ...newProduct, price: formatted });
                }}
                data-testid="input-product-price"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddProductDialogOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button 
              onClick={handleAddProduct}
              disabled={createProductMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              data-testid="button-confirm-add"
            >
              {createProductMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
        <DialogContent className="bg-card border-white/10 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Add New Category</DialogTitle>
            <DialogDescription>Create a new product category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="e.g., Electronics"
                className="bg-black/40 border-white/10 focus-visible:ring-primary/50 h-10"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                data-testid="input-category-name"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddCategoryDialogOpen(false)} data-testid="button-cancel-category">
              Cancel
            </Button>
            <Button 
              onClick={handleAddCategory}
              disabled={createCategoryMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              data-testid="button-confirm-category"
            >
              {createCategoryMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Category"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Worker Dialog */}
      <Dialog open={isAddWorkerDialogOpen} onOpenChange={setIsAddWorkerDialogOpen}>
        <DialogContent className="bg-card border-white/10 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Add New Worker</DialogTitle>
            <DialogDescription>Create a new worker account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="worker-username">Username</Label>
              <Input
                id="worker-username"
                placeholder="e.g., john_doe"
                className="bg-black/40 border-white/10 focus-visible:ring-primary/50 h-10"
                value={newWorker.username}
                onChange={(e) => setNewWorker({ ...newWorker, username: e.target.value })}
                data-testid="input-worker-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-password">Password</Label>
              <Input
                id="worker-password"
                type="password"
                placeholder="••••••••"
                className="bg-black/40 border-white/10 focus-visible:ring-primary/50 h-10"
                value={newWorker.password}
                onChange={(e) => setNewWorker({ ...newWorker, password: e.target.value })}
                data-testid="input-worker-password"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddWorkerDialogOpen(false)} data-testid="button-cancel-worker">
              Cancel
            </Button>
            <Button 
              onClick={handleAddWorker}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              data-testid="button-confirm-worker"
            >
              Add Worker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}