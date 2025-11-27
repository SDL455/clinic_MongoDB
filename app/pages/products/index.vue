<script setup lang="ts">
import type { Product, ProductCategory } from "~/types";

definePageMeta({
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();
const { success, error } = useNotification();

const products = ref<Product[]>([]);
const categories = ref<ProductCategory[]>([]);
const isLoading = ref(true);
const search = ref("");
const selectedCategory = ref<number | null>(null);
const filter = ref("");

// Modal states
const showModal = ref(false);
const isEditing = ref(false);
const editingProduct = ref<Product | null>(null);

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

// Fetch data
const fetchData = async () => {
  isLoading.value = true;
  try {
    const query = new URLSearchParams();
    if (search.value) query.set("search", search.value);
    if (selectedCategory.value) query.set("categoryId", String(selectedCategory.value));
    if (filter.value) query.set("filter", filter.value);

    const [productsRes, categoriesRes] = await Promise.all([
      $fetch<{ success: boolean; data: Product[] }>(`/api/products?${query}`, {
        headers: getAuthHeaders(),
      }),
      $fetch<{ success: boolean; data: ProductCategory[] }>("/api/categories", {
        headers: getAuthHeaders(),
      }),
    ]);

    if (productsRes.success) products.value = productsRes.data || [];
    if (categoriesRes.success) categories.value = categoriesRes.data || [];
  } catch (err) {
    error("ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດຂໍ້ມູນ");
  } finally {
    isLoading.value = false;
  }
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

// Open modal for new product
const openNewModal = () => {
  isEditing.value = false;
  editingProduct.value = null;
  selectedImages.value = [];
  previewUrls.value = [];
  existingImages.value = [];
  Object.assign(form, {
    name: "",
    description: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    minStock: 5,
    categoryId: categories.value[0]?.id || 0,
  });
  // Reset errors
  Object.assign(errors, {
    name: "",
    price: "",
    categoryId: "",
    images: "",
  });
  showModal.value = true;
};

// Open modal for editing
const openEditModal = (product: Product) => {
  isEditing.value = true;
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
  showModal.value = true;
};

// Save product
const saveProduct = async () => {
  if (!validateForm()) {
    error("ກະລຸນາກວດສອບຂໍ້ມູນທີ່ປ້ອນ");
    return;
  }

  try {
    const url = isEditing.value ? `/api/products/${editingProduct.value?.id}` : "/api/products";
    const method = isEditing.value ? "PUT" : "POST";

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

    await $fetch(url, {
      method,
      headers,
      body: formData,
    });

    success(isEditing.value ? "ອັບເດດສິນຄ້າສຳເລັດ" : "ເພີ່ມສິນຄ້າສຳເລັດ");
    showModal.value = false;
    fetchData();
  } catch (err: any) {
    error(err?.data?.message || "ເກີດຂໍ້ຜິດພາດ");
  }
};

// Delete product
const deleteProduct = async (product: Product) => {
  if (!confirm(`ຕ້ອງການລຶບ "${product.name}" ບໍ່?`)) return;

  try {
    await $fetch(`/api/products/${product.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    success("ລຶບສິນຄ້າສຳເລັດ");
    fetchData();
  } catch (err) {
    error("ເກີດຂໍ້ຜິດພາດ");
  }
};

// Format currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("lo-LA", {
    style: "currency",
    currency: "LAK",
    minimumFractionDigits: 0,
  }).format(value);

// Cleanup preview URLs
const cleanupPreviews = () => {
  previewUrls.value.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  previewUrls.value = [];
};

// Watch for modal close to cleanup
watch(showModal, (newVal) => {
  if (!newVal) {
    cleanupPreviews();
  }
});

// Watch for search changes
watch([search, selectedCategory, filter], () => {
  fetchData();
});

onMounted(() => {
  fetchData();
});

onUnmounted(() => {
  cleanupPreviews();
});
</script>

<template>
  <div>
    <PageHeader title="ສິນຄ້າ" description="ຈັດການສິນຄ້າ ແລະ Stock">
      <template #actions>
        <button @click="openNewModal" class="btn btn-primary">
          <Icon name="lucide:plus" class="w-4 h-4" />
          ເພີ່ມສິນຄ້າ
        </button>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="card p-4 mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <input
            v-model="search"
            type="text"
            class="input"
            placeholder="ຄົ້ນຫາສິນຄ້າ..."
          />
        </div>
        <div>
          <select v-model="selectedCategory" class="select">
            <option :value="null">ທຸກປະເພດ</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div>
          <select v-model="filter" class="select">
            <option value="">ທັງໝົດ</option>
            <option value="low-stock">Stock ໃກ້ໝົດ</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Products Table -->
    <div class="card">
      <div class="table-container border-0">
        <table class="table">
          <thead>
            <tr>
              <th>ຊື່ສິນຄ້າ</th>
              <th>ປະເພດ</th>
              <th class="text-right">ລາຄາ</th>
              <th class="text-right">Stock</th>
              <th>ສະຖານະ</th>
              <th class="text-right">ຈັດການ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-8">
                <Icon name="lucide:loader-2" class="w-6 h-6 animate-spin mx-auto text-clinic-accent" />
              </td>
            </tr>
            <tr v-else-if="products.length === 0">
              <td colspan="6" class="text-center py-8 text-gray-400">
                ບໍ່ມີສິນຄ້າ
              </td>
            </tr>
            <tr v-for="product in products" :key="product.id">
              <td>
                <div>
                  <p class="font-medium text-white">{{ product.name }}</p>
                  <p v-if="product.description" class="text-sm text-gray-500 truncate max-w-xs">
                    {{ product.description }}
                  </p>
                </div>
              </td>
              <td>
                <span class="badge badge-info">
                  {{ product.category?.name }}
                </span>
              </td>
              <td class="text-right font-medium">
                {{ formatCurrency(product.price) }}
              </td>
              <td class="text-right">
                <span
                  :class="
                    product.stock === 0
                      ? 'text-red-400'
                      : product.stock <= product.minStock
                      ? 'text-amber-400'
                      : 'text-white'
                  "
                >
                  {{ product.stock }} {{ product.category?.unit }}
                </span>
              </td>
              <td>
                <span
                  v-if="product.stock === 0"
                  class="badge badge-danger"
                >
                  ໝົດ Stock
                </span>
                <span
                  v-else-if="product.stock <= product.minStock"
                  class="badge badge-warning"
                >
                  ໃກ້ໝົດ
                </span>
                <span v-else class="badge badge-success">ປົກກະຕິ</span>
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="openEditModal(product)"
                    class="p-2 hover:bg-clinic-dark rounded-lg transition-colors text-gray-400 hover:text-white"
                  >
                    <Icon name="lucide:pencil" class="w-4 h-4" />
                  </button>
                  <button
                    @click="deleteProduct(product)"
                    class="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                  >
                    <Icon name="lucide:trash-2" class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Modal :show="showModal" :title="isEditing ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າ'" size="xl" @close="showModal = false; cleanupPreviews()">
      <form @submit.prevent="saveProduct" class="space-y-4">
        <div>
          <label class="input-label">ຊື່ສິນຄ້າ *</label>
          <input v-model="form.name" type="text" class="input" :class="{ 'border-red-500': errors.name }" required />
          <p v-if="errors.name" class="text-red-400 text-sm mt-1">{{ errors.name }}</p>
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
          <p v-if="errors.categoryId" class="text-red-400 text-sm mt-1">{{ errors.categoryId }}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="input-label">ລາຄາຂາຍ *</label>
            <input v-model.number="form.price" type="number" class="input" :class="{ 'border-red-500': errors.price }" required min="0" />
            <p v-if="errors.price" class="text-red-400 text-sm mt-1">{{ errors.price }}</p>
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
                  <Icon name="lucide:trash-2" class="w-5 h-5 text-red-400" />
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
                  <Icon name="lucide:trash-2" class="w-5 h-5 text-red-400" />
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
              <span class="text-sm text-gray-400">
                ({{ previewUrls.length + existingImages.length }}/10)
              </span>
            </div>
            <p v-if="errors.images" class="text-red-400 text-sm">{{ errors.images }}</p>
            <p v-else-if="previewUrls.length + existingImages.length >= 10" class="text-amber-400 text-sm">
              ເຖິງຈຳນວນສູງສຸດແລ້ວ (10 ຮູບ)
            </p>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <button type="button" @click="showModal = false" class="btn btn-secondary flex-1">
            ຍົກເລີກ
          </button>
          <button type="submit" class="btn btn-primary flex-1">
            {{ isEditing ? "ບັນທຶກ" : "ເພີ່ມ" }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>

