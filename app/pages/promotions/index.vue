<script setup lang="ts">
import type { Promotion, Service } from "~/types";

definePageMeta({
  middleware: "auth",
});

const { getAuthHeaders } = useAuth();
const { success, error } = useNotification();

const promotions = ref<Promotion[]>([]);
const services = ref<Service[]>([]);
const isLoading = ref(true);
const showModal = ref(false);
const isEditing = ref(false);
const editingPromotion = ref<Promotion | null>(null);
const activeTab = ref<"active" | "history">("active");

// Image handling
const imageInput = ref<HTMLInputElement | null>(null);
const imagePreviews = ref<string[]>([]);
const newImageFiles = ref<File[]>([]);
const existingImages = ref<string[]>([]);

const form = reactive({
  name: "",
  description: "",
  discount: 0,
  isPercent: false,
  startDate: "",
  endDate: "",
});

// Fetch services for dropdown
const fetchServices = async () => {
  try {
    const res = await $fetch<{ success: boolean; data: Service[] }>("/api/services", {
      headers: getAuthHeaders(),
    });
    if (res.success) services.value = res.data || [];
  } catch (err) {
    console.error("Failed to fetch services:", err);
  }
};

// Fetch promotions
const fetchPromotions = async () => {
  isLoading.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: Promotion[] }>("/api/promotions", {
      headers: getAuthHeaders(),
    });
    if (res.success) promotions.value = res.data || [];
  } catch (err) {
    error("ເກີດຂໍ້ຜິດພາດ");
  } finally {
    isLoading.value = false;
  }
};

// Check if promotion is active
const isActive = (promo: Promotion) => {
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);
  return promo.isActive && now >= start && now <= end;
};

// Filter promotions by tab
const activePromotions = computed(() => promotions.value.filter(isActive));
const historyPromotions = computed(() => promotions.value.filter((p) => !isActive(p)));

// Handle image selection
const handleImageSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files) return;

  const totalImages = existingImages.value.length + newImageFiles.value.length + files.length;
  if (totalImages > 10) {
    error("ບໍ່ສາມາດເພີ່ມຮູບພາບເກີນ 10 ຮູບ");
    return;
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      error("ກະລຸນາເລືອກໄຟລ໌ຮູບພາບເທົ່ານັ້ນ");
      continue;
    }
    newImageFiles.value.push(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreviews.value.push(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
  target.value = "";
};

// Remove new image
const removeNewImage = (index: number) => {
  newImageFiles.value.splice(index, 1);
  imagePreviews.value.splice(index, 1);
};

// Remove existing image
const removeExistingImage = (index: number) => {
  existingImages.value.splice(index, 1);
};

// Reset image state
const resetImageState = () => {
  imagePreviews.value = [];
  newImageFiles.value = [];
  existingImages.value = [];
};

// Open new modal
const openNewModal = () => {
  isEditing.value = false;
  editingPromotion.value = null;
  const today = new Date().toISOString().split("T")[0];
  Object.assign(form, {
    name: "",
    description: "",
    discount: 0,
    isPercent: false,
    startDate: today,
    endDate: today,
  });
  resetImageState();
  showModal.value = true;
};

// Open edit modal
const openEditModal = (promo: Promotion) => {
  isEditing.value = true;
  editingPromotion.value = promo;
  Object.assign(form, {
    name: promo.name,
    description: promo.description || "",
    discount: promo.discount,
    isPercent: promo.isPercent,
    startDate: new Date(promo.startDate).toISOString().split("T")[0],
    endDate: new Date(promo.endDate).toISOString().split("T")[0],
  });
  resetImageState();
  existingImages.value = promo.images ? [...promo.images] : [];
  showModal.value = true;
};

// Reuse promotion (copy and create new with updated dates)
const reusePromotion = (promo: Promotion) => {
  isEditing.value = false;
  editingPromotion.value = null;
  const today = new Date().toISOString().split("T")[0];
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  Object.assign(form, {
    name: promo.name,
    description: promo.description || "",
    discount: promo.discount,
    isPercent: promo.isPercent,
    startDate: today,
    endDate: nextMonth.toISOString().split("T")[0],
  });
  resetImageState();
  existingImages.value = promo.images ? [...promo.images] : [];
  showModal.value = true;
};

// Save promotion
const savePromotion = async () => {
  if (!form.name || !form.discount || !form.startDate || !form.endDate) {
    error("ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("description", form.description);
    formData.append("discount", form.discount.toString());
    formData.append("isPercent", form.isPercent.toString());
    formData.append("startDate", form.startDate);
    formData.append("endDate", form.endDate);

    if (isEditing.value) {
      formData.append("existingImages", JSON.stringify(existingImages.value));
    }

    for (const file of newImageFiles.value) {
      formData.append("images", file);
    }

    const url = isEditing.value ? `/api/promotions/${editingPromotion.value?.id}` : "/api/promotions";
    const method = isEditing.value ? "PUT" : "POST";

    await $fetch(url, {
      method,
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    success(isEditing.value ? "ອັບເດດໂປຣໂມຊັ່ນສຳເລັດ" : "ເພີ່ມໂປຣໂມຊັ່ນສຳເລັດ");
    showModal.value = false;
    fetchPromotions();
  } catch (err) {
    error("ເກີດຂໍ້ຜິດພາດ");
  }
};

// Delete promotion
const deletePromotion = async (promo: Promotion) => {
  if (!confirm(`ຕ້ອງການລຶບ "${promo.name}" ບໍ່?`)) return;

  try {
    await $fetch(`/api/promotions/${promo.id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    success("ລຶບໂປຣໂມຊັ່ນສຳເລັດ");
    fetchPromotions();
  } catch (err) {
    error("ເກີດຂໍ້ຜິດພາດ");
  }
};

// Format date
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("lo-LA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// Format discount
const formatDiscount = (promo: Promotion) => {
  if (promo.isPercent) {
    return `${promo.discount}%`;
  }
  return new Intl.NumberFormat("lo-LA", {
    style: "currency",
    currency: "LAK",
    minimumFractionDigits: 0,
  }).format(promo.discount);
};

onMounted(() => {
  fetchPromotions();
  fetchServices();
});
</script>

<template>
  <div>
    <PageHeader title="ໂປຣໂມຊັ່ນ" description="ຈັດການໂປຣໂມຊັ່ນ ແລະ ສ່ວນຫຼຸດ">
      <template #actions>
        <button @click="openNewModal" class="btn btn-primary">
          <Icon name="lucide:plus" class="w-4 h-4" />
          ເພີ່ມໂປຣໂມຊັ່ນ
        </button>
      </template>
    </PageHeader>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        @click="activeTab = 'active'"
        :class="[
          'px-4 py-2 rounded-lg font-medium transition-all',
          activeTab === 'active'
            ? 'bg-clinic-primary text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ]"
      >
        <Icon name="lucide:zap" class="w-4 h-4 inline mr-1" />
        ກຳລັງໃຊ້ງານ ({{ activePromotions.length }})
      </button>
      <button
        @click="activeTab = 'history'"
        :class="[
          'px-4 py-2 rounded-lg font-medium transition-all',
          activeTab === 'history'
            ? 'bg-gray-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ]"
      >
        <Icon name="lucide:history" class="w-4 h-4 inline mr-1" />
        ປະຫວັດ ({{ historyPromotions.length }})
      </button>
    </div>

    <!-- Promotions Grid -->
    <div v-if="isLoading" class="flex items-center justify-center h-64">
      <Icon name="lucide:loader-2" class="w-10 h-10 animate-spin text-black" />
    </div>

    <div v-else>
      <!-- Active Promotions -->
      <div v-if="activeTab === 'active'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="promo in activePromotions"
          :key="promo.id"
          class="card p-5 hover:border-clinic-accent/50 transition-all group relative overflow-hidden"
        >
          <!-- Status Badge -->
          <div class="absolute top-4 right-4">
            <span class="badge badge-success animate-pulse">ກຳລັງໃຊ້ງານ</span>
          </div>

          <!-- Image Preview -->
          <div v-if="promo.images && promo.images.length > 0" class="mb-4 -mx-5 -mt-5">
            <div class="relative aspect-video bg-gray-100 overflow-hidden">
              <img
                :src="promo.images[0]"
                :alt="promo.name"
                class="w-full h-full object-cover"
              />
              <div v-if="promo.images.length > 1" class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                +{{ promo.images.length - 1 }} ຮູບ
              </div>
            </div>
          </div>

          <div v-else class="mb-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Icon name="lucide:percent" class="w-6 h-6 text-black" />
            </div>
          </div>

          <h3 class="text-lg font-semibold text-black mb-2">{{ promo.name }}</h3>
          <p v-if="promo.description" class="text-black text-sm mb-4 line-clamp-2">
            {{ promo.description }}
          </p>

          <!-- Discount -->
          <div class="text-3xl font-bold text-black mb-4">
            {{ formatDiscount(promo) }}
          </div>

          <!-- Date Range -->
          <div class="text-sm text-black mb-4">
            <Icon name="lucide:calendar" class="w-4 h-4 inline mr-1" />
            {{ formatDate(promo.startDate) }} - {{ formatDate(promo.endDate) }}
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-4 border-t border-clinic-border">
            <button @click="openEditModal(promo)" class="btn btn-secondary btn-sm flex-1">
              <Icon name="lucide:pencil" class="w-4 h-4" />
              ແກ້ໄຂ
            </button>
            <button
              @click="deletePromotion(promo)"
              class="btn btn-sm px-3 hover:bg-red-500/20 text-black hover:text-black"
            >
              <Icon name="lucide:trash-2" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="activePromotions.length === 0" class="col-span-full text-center py-12 text-black">
          <Icon name="lucide:percent" class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>ບໍ່ມີໂປຣໂມຊັ່ນທີ່ກຳລັງໃຊ້ງານ</p>
        </div>
      </div>

      <!-- History Promotions -->
      <div v-if="activeTab === 'history'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="promo in historyPromotions"
          :key="promo.id"
          class="card p-5 transition-all group relative overflow-hidden opacity-75 hover:opacity-100"
        >
          <!-- Status Badge -->
          <div class="absolute top-4 right-4">
            <span class="badge badge-warning">ໝົດອາຍຸ</span>
          </div>

          <!-- Image Preview -->
          <div v-if="promo.images && promo.images.length > 0" class="mb-4 -mx-5 -mt-5">
            <div class="relative aspect-video bg-gray-100 overflow-hidden grayscale">
              <img
                :src="promo.images[0]"
                :alt="promo.name"
                class="w-full h-full object-cover"
              />
              <div v-if="promo.images.length > 1" class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                +{{ promo.images.length - 1 }} ຮູບ
              </div>
            </div>
          </div>

          <div v-else class="mb-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-300/20 to-gray-400/20 flex items-center justify-center">
              <Icon name="lucide:percent" class="w-6 h-6 text-gray-500" />
            </div>
          </div>

          <h3 class="text-lg font-semibold text-black mb-2">{{ promo.name }}</h3>
          <p v-if="promo.description" class="text-black text-sm mb-4 line-clamp-2">
            {{ promo.description }}
          </p>

          <!-- Discount -->
          <div class="text-3xl font-bold text-gray-500 mb-4">
            {{ formatDiscount(promo) }}
          </div>

          <!-- Date Range -->
          <div class="text-sm text-gray-500 mb-4">
            <Icon name="lucide:calendar" class="w-4 h-4 inline mr-1" />
            {{ formatDate(promo.startDate) }} - {{ formatDate(promo.endDate) }}
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-4 border-t border-clinic-border">
            <button @click="reusePromotion(promo)" class="btn btn-primary btn-sm flex-1">
              <Icon name="lucide:refresh-cw" class="w-4 h-4" />
              ນຳມາໃຊ້ຄືນ
            </button>
            <button @click="openEditModal(promo)" class="btn btn-secondary btn-sm px-3">
              <Icon name="lucide:pencil" class="w-4 h-4" />
            </button>
            <button
              @click="deletePromotion(promo)"
              class="btn btn-sm px-3 hover:bg-red-500/20 text-black hover:text-black"
            >
              <Icon name="lucide:trash-2" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="historyPromotions.length === 0" class="col-span-full text-center py-12 text-black">
          <Icon name="lucide:history" class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>ບໍ່ມີປະຫວັດໂປຣໂມຊັ່ນ</p>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <Modal :show="showModal" :title="isEditing ? 'ແກ້ໄຂໂປຣໂມຊັ່ນ' : 'ເພີ່ມໂປຣໂມຊັ່ນ'" @close="showModal = false">
      <form @submit.prevent="savePromotion" class="space-y-4">
        <div>
          <label class="input-label">ເລືອກບໍລິການສຳລັບໂປຣໂມຊັ່ນ *</label>
          <select v-model="form.name" class="select" required>
            <option value="" disabled>-- ເລືອກບໍລິການ --</option>
            <option v-for="service in services" :key="service.id" :value="service.name">
              {{ service.name }} ({{ new Intl.NumberFormat("lo-LA").format(service.price) }} ₭)
            </option>
          </select>
          <p v-if="services.length === 0" class="text-sm text-amber-600 mt-1">
            <Icon name="lucide:alert-circle" class="w-4 h-4 inline" />
            ບໍ່ມີບໍລິການ - ກະລຸນາເພີ່ມບໍລິການກ່ອນ
          </p>
        </div>

        <div>
          <label class="input-label">ລາຍລະອຽດ</label>
          <textarea v-model="form.description" class="input" rows="2" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="input-label">ສ່ວນຫຼຸດ *</label>
            <input v-model.number="form.discount" type="number" class="input" min="0" required />
          </div>
          <div>
            <label class="input-label">ປະເພດ</label>
            <select v-model="form.isPercent" class="select">
              <option :value="false">ຈຳນວນເງິນ (LAK)</option>
              <option :value="true">ເປີເຊັນ (%)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="input-label">ວັນເລີ່ມຕົ້ນ *</label>
            <input v-model="form.startDate" type="date" class="input" required />
          </div>
          <div>
            <label class="input-label">ວັນສິ້ນສຸດ *</label>
            <input v-model="form.endDate" type="date" class="input" required />
          </div>
        </div>

        <!-- Image Upload -->
        <div>
          <label class="input-label">ຮູບພາບໂປຣໂມຊັ່ນ (ສູງສຸດ 10 ຮູບ)</label>
          <div class="mt-2">
            <!-- Existing Images -->
            <div v-if="existingImages.length > 0" class="grid grid-cols-4 gap-2 mb-3">
              <div
                v-for="(img, index) in existingImages"
                :key="'existing-' + index"
                class="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
              >
                <img :src="img" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="removeExistingImage(index)"
                  class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <Icon name="lucide:x" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- New Image Previews -->
            <div v-if="imagePreviews.length > 0" class="grid grid-cols-4 gap-2 mb-3">
              <div
                v-for="(preview, index) in imagePreviews"
                :key="'new-' + index"
                class="relative aspect-square rounded-lg overflow-hidden border border-green-300 bg-green-50"
              >
                <img :src="preview" class="w-full h-full object-cover" />
                <div class="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 rounded">ໃໝ່</div>
                <button
                  type="button"
                  @click="removeNewImage(index)"
                  class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <Icon name="lucide:x" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Upload Button -->
            <div
              v-if="existingImages.length + newImageFiles.length < 10"
              @click="imageInput?.click()"
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-clinic-primary hover:bg-clinic-primary/5 transition-all"
            >
              <Icon name="lucide:upload" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p class="text-sm text-gray-600">ຄລິກເພື່ອເລືອກຮູບພາບ</p>
              <p class="text-xs text-gray-400 mt-1">ສາມາດເລືອກຫຼາຍຮູບໄດ້</p>
            </div>
            <input
              ref="imageInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleImageSelect"
            />
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
