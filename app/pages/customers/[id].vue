<script setup lang="ts">
import type { CustomerWithHistory } from "~/types";

definePageMeta({
  middleware: "auth",
});

const route = useRoute();
const { getAuthHeaders } = useAuth();

const customer = ref<CustomerWithHistory | null>(null);
const isLoading = ref(true);

// Fetch customer
const fetchCustomer = async () => {
  isLoading.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: CustomerWithHistory }>(
      `/api/customers/${route.params.id}`,
      { headers: getAuthHeaders() }
    );
    if (res.success) customer.value = res.data;
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
    month: "short",
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

// Calculate totals
const totalSpent = computed(() =>
  customer.value?.sales.filter((s) => s.status === "PAID").reduce((sum, s) => sum + s.total, 0) || 0
);

onMounted(() => {
  fetchCustomer();
});
</script>

<template>
  <div>
    <!-- Back Button -->
    <NuxtLink to="/customers" class="inline-flex items-center gap-2 text-black hover:text-black mb-4">
      <Icon name="lucide:arrow-left" class="w-4 h-4" />
      ກັບຄືນ
    </NuxtLink>

    <div v-if="isLoading" class="flex items-center justify-center h-64">
      <Icon name="lucide:loader-2" class="w-10 h-10 animate-spin text-black" />
    </div>

    <template v-else-if="customer">
      <!-- Customer Info -->
      <div class="card p-6 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-clinic-accent to-cyan-500 flex items-center justify-center">
            <Icon name="lucide:user" class="w-10 h-10 text-black" />
          </div>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-black">
              {{ customer.firstName }} {{ customer.lastName }}
            </h1>
            <p class="text-black mt-1">
              <Icon name="lucide:phone" class="w-4 h-4 inline mr-1" />
              {{ customer.phone }}
            </p>
            <p v-if="customer.address" class="text-black text-sm mt-1">
              <Icon name="lucide:map-pin" class="w-4 h-4 inline mr-1" />
              {{ customer.address }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-sm text-black">ຍອດໃຊ້ຈ່າຍທັງໝົດ</p>
            <p class="text-2xl font-bold text-black">
              {{ formatCurrency(totalSpent) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Purchase History -->
      <div class="card">
        <div class="card-header">
          <h2 class="font-semibold text-black">
            ປະຫວັດການໃຊ້ບໍລິການ ({{ customer.sales.length }} ຄັ້ງ)
          </h2>
        </div>

        <div v-if="customer.sales.length === 0" class="p-8 text-center text-black">
          <Icon name="lucide:receipt" class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>ຍັງບໍ່ມີປະຫວັດການໃຊ້ບໍລິການ</p>
        </div>

        <div v-else class="divide-y divide-clinic-border">
          <div
            v-for="sale in customer.sales"
            :key="sale.id"
            class="p-4 hover:bg-clinic-dark/30 transition-colors"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <NuxtLink
                  :to="`/sales/${sale.id}`"
                  class="font-mono text-black hover:underline"
                >
                  {{ sale.invoiceNumber }}
                </NuxtLink>
                <span class="text-black text-sm ml-2">
                  {{ formatDate(sale.createdAt) }}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <span class="badge" :class="getStatusBadge(sale.status).class">
                  {{ getStatusBadge(sale.status).label }}
                </span>
                <span class="font-semibold text-black">
                  {{ formatCurrency(sale.total) }}
                </span>
              </div>
            </div>

            <!-- Items -->
            <div class="pl-4 border-l-2 border-clinic-border space-y-1">
              <div
                v-for="item in sale.items"
                :key="item.id"
                class="text-sm text-black flex justify-between"
              >
                <span>
                  {{ item.product?.name || item.service?.name }}
                  <span class="text-black">x{{ item.quantity }}</span>
                </span>
                <span>{{ formatCurrency(item.total) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

