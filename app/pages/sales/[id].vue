<script setup lang="ts">
import type { Sale } from "~/types";

definePageMeta({
  middleware: "auth",
});

const route = useRoute();
const { getAuthHeaders } = useAuth();

const sale = ref<Sale | null>(null);
const isLoading = ref(true);

// Fetch sale
const fetchSale = async () => {
  isLoading.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: Sale }>(
      `/api/sales/${route.params.id}`,
      { headers: getAuthHeaders() }
    );
    if (res.success) {
      sale.value = res.data;
      // Auto print if requested
      if (route.query.print === "true") {
        setTimeout(() => {
          window.print();
        }, 500);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

// Format currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("lo-LA", {
    style: "currency",
    currency: "LAK",
    minimumFractionDigits: 0,
  }).format(value);

// Format date
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("lo-LA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Payment status
const getStatusBadge = (status: string) => {
  switch (status) {
    case "PAID":
      return { class: "badge-success", label: "ຈ່າຍແລ້ວ" };
    case "TRANSFER":
      return { class: "badge-info", label: "ໂອນ" };
    default:
      return { class: "badge-warning", label: "ຍັງບໍ່ຈ່າຍ" };
  }
};

// Print invoice
const printInvoice = () => {
  window.print();
};

onMounted(() => {
  fetchSale();
});
</script>

<template>
  <div>
    <!-- Back Button (no print) -->
    <div class="flex items-center justify-between mb-4 no-print">
      <NuxtLink to="/sales" class="inline-flex items-center gap-2 text-black hover:text-black">
        <Icon name="lucide:arrow-left" class="w-4 h-4" />
        ກັບຄືນ
      </NuxtLink>
      <button @click="printInvoice" class="btn btn-secondary">
        <Icon name="lucide:printer" class="w-4 h-4" />
        ພິມໃບບິນ
      </button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center h-64">
      <Icon name="lucide:loader-2" class="w-10 h-10 animate-spin text-black" />
    </div>

    <template v-else-if="sale">
      <!-- Invoice Card -->
      <div class="card max-w-2xl mx-auto">
        <!-- Header -->
        <div class="p-6 border-b border-clinic-border text-center">
          <div class="flex items-center justify-center gap-3 mb-2">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-clinic-accent to-cyan-500 flex items-center justify-center">
              <Icon name="lucide:activity" class="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 class="text-2xl font-bold text-black">Clinic Pro</h1>
              <p class="text-black text-sm">ລະບົບຈັດການຄລີນິກ</p>
            </div>
          </div>
        </div>

        <!-- Invoice Info -->
        <div class="p-6 border-b border-clinic-border">
          <div class="flex flex-col sm:flex-row sm:justify-between gap-4">
            <div>
              <p class="text-black text-sm">ເລກບິນ</p>
              <p class="font-mono text-xl font-bold text-black">
                {{ sale.invoiceNumber }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-black text-sm">ວັນທີ</p>
              <p class="text-black">{{ formatDate(sale.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="p-6 border-b border-clinic-border">
          <h3 class="text-black text-sm mb-2">ລູກຄ້າ</h3>
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-clinic-accent/20 flex items-center justify-center">
              <Icon name="lucide:user" class="w-6 h-6 text-black" />
            </div>
            <div>
              <p class="font-semibold text-black text-lg">
                {{ sale.customer?.firstName }} {{ sale.customer?.lastName }}
              </p>
              <p class="text-black">{{ sale.customer?.phone }}</p>
            </div>
          </div>
        </div>

        <!-- Items -->
        <div class="p-6 border-b border-clinic-border">
          <h3 class="text-black text-sm mb-4">ລາຍການ</h3>
          <div class="space-y-3">
            <div
              v-for="item in sale.items"
              :key="item.id"
              class="flex items-center justify-between py-2"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center"
                  :class="
                    item.product
                      ? 'bg-clinic-accent/20 text-black'
                      : 'bg-pink-500/20 text-black'
                  "
                >
                  <Icon
                    :name="item.product ? 'lucide:package' : 'lucide:heart-handshake'"
                    class="w-4 h-4"
                  />
                </div>
                <div>
                  <p class="text-black">
                    {{ item.product?.name || item.service?.name }}
                  </p>
                  <p class="text-sm text-black">
                    {{ formatCurrency(item.price) }} x {{ item.quantity }}
                  </p>
                </div>
              </div>
              <p class="font-semibold text-black">
                {{ formatCurrency(item.total) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="p-6 space-y-3">
          <div class="flex justify-between text-black">
            <span>ຍອດລວມ</span>
            <span>{{ formatCurrency(sale.subtotal) }}</span>
          </div>

          <div v-if="sale.discount > 0" class="flex justify-between text-black">
            <span>
              ສ່ວນຫຼຸດ
              <span v-if="sale.promotion" class="text-sm">({{ sale.promotion.name }})</span>
            </span>
            <span>-{{ formatCurrency(sale.discount) }}</span>
          </div>

          <div class="flex justify-between text-xl font-bold text-black pt-4 border-t border-clinic-border">
            <span>ຍອດຈ່າຍ</span>
            <span class="text-black">{{ formatCurrency(sale.total) }}</span>
          </div>

          <div class="flex justify-center pt-4">
            <span class="badge text-lg px-4 py-2" :class="getStatusBadge(sale.status).class">
              {{ getStatusBadge(sale.status).label }}
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-clinic-border text-center text-black text-sm">
          <p>ຂອບໃຈທີ່ໃຊ້ບໍລິການ</p>
          <p class="mt-1">ພະນັກງານ: {{ sale.user?.name }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }

  /* Reset page padding for print */
  :deep(main) {
    padding: 0 !important;
  }

  /* Invoice card print styles */
  .card {
    border: none !important;
    box-shadow: none !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Text colors for thermal printer */
  .text-black,
  .text-black {
    color: black !important;
  }

  .text-black,
  .text-black {
    color: #666 !important;
  }

  /* Clean borders */
  .border-clinic-border {
    border-color: #ddd !important;
  }

  /* Icon backgrounds */
  .bg-clinic-accent\/20,
  .bg-pink-500\/20 {
    background: #f3f4f6 !important;
  }

  /* Gradient header */
  .bg-gradient-to-br {
    background: #10b981 !important;
  }
}
</style>

