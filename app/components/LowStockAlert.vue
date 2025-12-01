<script setup lang="ts">
import type { Product, ProductCategory } from "~/types";

const { getAuthHeaders, isLoggedIn } = useAuth();
const { refreshTrigger, refresh } = useLowStockAlert();
const { success, error } = useNotification();

const lowStockProducts = ref<Product[]>([]);
const isOpen = ref(false);
const isLoading = ref(false);

// Modal states
const showProductModal = ref(false);
const editingProduct = ref<Product | null>(null);
const categories = ref<ProductCategory[]>([]);

const form = reactive({
  name: "",
  description: "",
  price: 0,
  costPrice: 0,
  stock: 0,
  minStock: 5,
  categoryId: 0,
});

// Image upload
const fileInput = ref<HTMLInputElement | null>(null);
const selectedImages = ref<File[]>([]);
const previewUrls = ref<string[]>([]);
const existingImages = ref<string[]>([]);

// Form validation errors
const errors = reactive({
  name: "",
  price: "",
  categoryId: "",
  images: "",
});

// Fetch low stock products
const fetchLowStock = async () => {
  if (!isLoggedIn.value) return;

  isLoading.value = true;
  try {
    const response = await $fetch<{ success: boolean; data: Product[] }>(
      "/api/products/low-stock",
      {
        headers: getAuthHeaders(),
      }
    );

    if (response.success) {
      lowStockProducts.value = response.data || [];
    }
  } catch (error) {
    console.error("Failed to fetch low stock products:", error);
  } finally {
    isLoading.value = false;
  }
};

// Fetch categories
const fetchCategories = async () => {
  try {
    const response = await $fetch<{ success: boolean; data: ProductCategory[] }>(
      "/api/categories",
      {
        headers: getAuthHeaders(),
      }
    );

    if (response.success) {
      categories.value = response.data || [];
    }
  } catch (error) {
    console.error("Failed to fetch categories:", error);
  }
};

// Open product edit modal
const openProductModal = async (product: Product) => {
  editingProduct.value = product;
  selectedImages.value = [];
  previewUrls.value = [];
  existingImages.value = product.images ? [...product.images] : [];
  
  Object.assign(form, {
    name: product.name,
    description: product.description || "",
    price: product.price,
    costPrice: product.costPrice,
    stock: product.stock,
    minStock: product.minStock,
    categoryId: product.categoryId,
  });
  
  // Reset errors
  Object.assign(errors, {
    name: "",
    price: "",
    categoryId: "",
    images: "",
  });
  
  // Fetch categories if not already loaded
  if (categories.value.length === 0) {
    await fetchCategories();
  }
  
  showProductModal.value = true;
  isOpen.value = false; // Close dropdown
};

// Handle image selection
const handleImageSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const files = Array.from(target.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    
    if (imageFiles.length === 0) {
      error("ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ");
      return;
    }

    const totalImages = selectedImages.value.length + existingImages.value.length + imageFiles.length;
    if (totalImages > 10) {
      error("ບໍ່ສາມາດເພີ່ມຮູບພາບເກີນ 10 ຮູບ");
      return;
    }

    selectedImages.value.push(...imageFiles);
    imageFiles.forEach((file) => {
      previewUrls.value.push(URL.createObjectURL(file));
    });

    // Reset input
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  }
};

// Remove selected image
const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1);
  URL.revokeObjectURL(previewUrls.value[index]);
  previewUrls.value.splice(index, 1);
};

// Remove existing image
const removeExistingImage = (index: number) => {
  existingImages.value.splice(index, 1);
};

// Validate form
const validateForm = (): boolean => {
  let isValid = true;
  
  // Reset errors
  errors.name = "";
  errors.price = "";
  errors.categoryId = "";
  errors.images = "";

  if (!form.name || !form.name.trim()) {
    errors.name = "ກະລຸນາປ້ອນຊື່ສິນຄ້າ";
    isValid = false;
  }

  if (!form.price || form.price <= 0) {
    errors.price = "ກະລຸນາປ້ອນລາຄາທີ່ຖືກຕ້ອງ";
    isValid = false;
  }

  if (!form.categoryId || form.categoryId === 0) {
    errors.categoryId = "ກະລຸນາເລືອກປະເພດ";
    isValid = false;
  }

  const totalImages = selectedImages.value.length + existingImages.value.length;
  if (totalImages > 10) {
    errors.images = "ບໍ່ສາມາດເພີ່ມຮູບພາບເກີນ 10 ຮູບ";
    isValid = false;
  }

  return isValid;
};

// Save product
const saveProduct = async () => {
  if (!validateForm()) {
    error("ກະລຸນາກວດສອບຂໍ້ມູນທີ່ປ້ອນ");
    return;
  }

  if (!editingProduct.value) return;

  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("description", form.description || "");
    formData.append("price", form.price.toString());
    formData.append("costPrice", form.costPrice.toString());
    formData.append("stock", form.stock.toString());
    formData.append("minStock", form.minStock.toString());
    formData.append("categoryId", form.categoryId.toString());
    
    // Append existing images
    if (existingImages.value.length > 0) {
      formData.append("existingImages", JSON.stringify(existingImages.value));
    }

    // Append new images
    selectedImages.value.forEach((file) => {
      formData.append("images", file);
    });

    const authHeaders = getAuthHeaders();
    // Create headers object without Content-Type to let browser set it with boundary for FormData
    const headers: Record<string, string> = {};
    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    await $fetch(`/api/products/${editingProduct.value.id}`, {
      method: "PUT",
      headers,
      body: formData,
    });

    success("ອັບເດດສິນຄ້າສຳເລັດ");
    showProductModal.value = false;
    cleanupPreviews();
    // Refresh low stock products
    fetchLowStock();
    // Trigger alert refresh
    refresh();
  } catch (err: any) {
    error(err?.data?.message || "ເກີດຂໍ້ຜິດພາດ");
  }
};

// Cleanup preview URLs
const cleanupPreviews = () => {
  previewUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  previewUrls.value = [];
  selectedImages.value = [];
};

// Watch for modal close to cleanup
watch(showProductModal, (newVal) => {
  if (!newVal) {
    cleanupPreviews();
  }
});

// Fetch on mount
onMounted(() => {
  fetchLowStock();
  // Refresh every 5 minutes
  const interval = setInterval(fetchLowStock, 5 * 60 * 1000);
  
  // Watch for refresh trigger changes
  watch(refreshTrigger, () => {
    fetchLowStock();
  });

  // Cleanup interval on unmount
  onUnmounted(() => {
    clearInterval(interval);
    cleanupPreviews();
  });
});
</script>

<template>
  <div class="relative">
    <!-- Alert Button -->
    <button
      @click="isOpen = !isOpen"
      class="relative p-2 rounded-lg hover:bg-clinic-dark transition-colors"
      :class="{ 'text-black': lowStockProducts.length > 0 }"
    >
      <Icon name="lucide:bell" class="w-5 h-5" />
      <span
        v-if="lowStockProducts.length > 0"
        class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-black flex items-center justify-center animate-pulse"
      >
        {{ lowStockProducts.length > 9 ? "9+" : lowStockProducts.length }}
      </span>
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-80 bg-clinic-surface rounded-xl border border-clinic-border shadow-2xl overflow-hidden z-50"
      >
        <div class="p-4 border-b border-clinic-border">
          <h3 class="font-medium text-black flex items-center gap-2">
            <Icon name="lucide:alert-triangle" class="w-4 h-4 text-black" />
            ແຈ້ງເຕືອນ Stock ໃກ້ໝົດ
          </h3>
        </div>

        <div class="max-h-80 overflow-y-auto">
          <div v-if="isLoading" class="p-4 text-center text-black">
            <Icon name="lucide:loader-2" class="w-6 h-6 animate-spin mx-auto" />
          </div>

          <div
            v-else-if="lowStockProducts.length === 0"
            class="p-4 text-center text-black"
          >
            <Icon name="lucide:package-check" class="w-8 h-8 mx-auto mb-2 text-black" />
            <p class="text-sm">ບໍ່ມີສິນຄ້າທີ່ Stock ໃກ້ໝົດ</p>
          </div>

          <div v-else class="divide-y divide-clinic-border">
            <button
              v-for="product in lowStockProducts"
              :key="product.id"
              @click="openProductModal(product)"
              class="w-full p-4 flex items-center gap-3 hover:bg-clinic-dark transition-colors text-left"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="
                  product.stock === 0
                    ? 'bg-red-500/20 text-black'
                    : 'bg-amber-500/20 text-black'
                "
              >
                <Icon
                  :name="product.stock === 0 ? 'lucide:package-x' : 'lucide:package'"
                  class="w-5 h-5"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-black truncate">
                  {{ product.name }}
                </p>
                <p class="text-xs text-black">
                  ຍັງເຫຼືອ:
                  <span
                    :class="
                      product.stock === 0 ? 'text-black' : 'text-black'
                    "
                  >
                    {{ product.stock }} {{ product.category?.unit || "ອັນ" }}
                  </span>
                </p>
              </div>
              <span
                v-if="product.stock === 0"
                class="badge badge-danger"
              >
                ໝົດ
              </span>
              <span v-else class="badge badge-warning">ໃກ້ໝົດ</span>
            </button>
          </div>
        </div>

        <NuxtLink
          to="/products?filter=low-stock"
          class="block p-3 text-center text-sm text-black hover:bg-clinic-dark transition-colors border-t border-clinic-border"
          @click="isOpen = false"
        >
          ເບິ່ງທັງໝົດ
        </NuxtLink>
      </div>
    </Transition>

    <!-- Click outside to close -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    />

    <!-- Product Edit Modal -->
    <Modal :show="showProductModal" title="ແກ້ໄຂສິນຄ້າ" size="xl" @close="showProductModal = false; cleanupPreviews()">
      <form @submit.prevent="saveProduct" class="space-y-4">
        <div>
          <label class="input-label">ຊື່ສິນຄ້າ *</label>
          <input v-model="form.name" type="text" class="input" :class="{ 'border-red-500': errors.name }" required />
          <p v-if="errors.name" class="text-black text-sm mt-1">{{ errors.name }}</p>
        </div>

        <div>
          <label class="input-label">ລາຍລະອຽດ</label>
          <textarea v-model="form.description" class="input" rows="2" />
        </div>

        <div>
          <label class="input-label">ປະເພດ *</label>
          <select v-model="form.categoryId" class="select" :class="{ 'border-red-500': errors.categoryId }" required>
            <option :value="0">ເລືອກປະເພດ</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }} ({{ cat.unit }})
            </option>
          </select>
          <p v-if="errors.categoryId" class="text-black text-sm mt-1">{{ errors.categoryId }}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="input-label">ລາຄາຂາຍ *</label>
            <input v-model.number="form.price" type="number" class="input" :class="{ 'border-red-500': errors.price }" required min="0" />
            <p v-if="errors.price" class="text-black text-sm mt-1">{{ errors.price }}</p>
          </div>
          <div>
            <label class="input-label">ລາຄາຕົ້ນທຶນ</label>
            <input v-model.number="form.costPrice" type="number" class="input" min="0" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="input-label">Stock</label>
            <input v-model.number="form.stock" type="number" class="input" min="0" />
          </div>
          <div>
            <label class="input-label">Stock ຕ່ຳສຸດ (ແຈ້ງເຕືອນ)</label>
            <input v-model.number="form.minStock" type="number" class="input" min="0" />
          </div>
        </div>

        <!-- Image Upload -->
        <div>
          <label class="input-label">ຮູບພາບ (ສູງສຸດ 10 ຮູບ)</label>
          <div class="space-y-3">
            <!-- Image Preview Grid -->
            <div v-if="previewUrls.length > 0 || existingImages.length > 0" class="grid grid-cols-5 gap-3">
              <!-- Existing Images -->
              <div
                v-for="(image, index) in existingImages"
                :key="`existing-${index}`"
                class="relative group aspect-square rounded-lg overflow-hidden border border-gray-600 bg-clinic-dark"
              >
                <img :src="image" :alt="`Image ${index + 1}`" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="removeExistingImage(index)"
                  class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Icon name="lucide:trash-2" class="w-5 h-5 text-black" />
                </button>
              </div>
              <!-- New Images -->
              <div
                v-for="(url, index) in previewUrls"
                :key="`new-${index}`"
                class="relative group aspect-square rounded-lg overflow-hidden border border-gray-600 bg-clinic-dark"
              >
                <img :src="url" :alt="`New image ${index + 1}`" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="removeImage(index)"
                  class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Icon name="lucide:trash-2" class="w-5 h-5 text-black" />
                </button>
              </div>
            </div>

            <!-- Upload Button -->
            <div v-if="previewUrls.length + existingImages.length < 10" class="flex items-center gap-2">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                multiple
                @change="handleImageSelect"
                class="hidden"
                :disabled="previewUrls.length + existingImages.length >= 10"
              />
              <button
                type="button"
                @click="fileInput?.click()"
                class="btn btn-secondary flex items-center gap-2"
                :disabled="previewUrls.length + existingImages.length >= 10"
              >
                <Icon name="lucide:upload" class="w-4 h-4" />
                ເພີ່ມຮູບພາບ
              </button>
              <span class="text-sm text-black">
                ({{ previewUrls.length + existingImages.length }}/10)
              </span>
            </div>
            <p v-if="errors.images" class="text-black text-sm">{{ errors.images }}</p>
            <p v-else-if="previewUrls.length + existingImages.length >= 10" class="text-black text-sm">
              ເຖິງຈຳນວນສູງສຸດແລ້ວ (10 ຮູບ)
            </p>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <button type="button" @click="showProductModal = false; cleanupPreviews()" class="btn btn-secondary flex-1">
            ຍົກເລີກ
          </button>
          <button type="submit" class="btn btn-primary flex-1">
            ບັນທຶກ
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

