<script setup lang="ts">
interface Props {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:currentPage", page: number): void;
}>();

const goToPage = (page: number) => {
  if (page >= 1 && page <= props.totalPages) {
    emit("update:currentPage", page);
  }
};

const startItem = computed(() => {
  if (props.total === 0) return 0;
  return (props.currentPage - 1) * props.limit + 1;
});

const endItem = computed(() => {
  return Math.min(props.currentPage * props.limit, props.total);
});
</script>

<template>
  <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-clinic-border">
    <div class="text-sm text-gray-400">
      ສະແດງ {{ startItem }}-{{ endItem }} ຈາກ {{ total }} ລາຍການ
    </div>
    <div class="flex items-center gap-2">
      <button
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage === 1"
        class="p-2 rounded-lg border border-clinic-border hover:bg-clinic-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Icon name="lucide:chevron-left" class="w-4 h-4" />
      </button>
      
      <div class="flex items-center gap-1">
        <button
          v-for="page in totalPages"
          :key="page"
          @click="goToPage(page)"
          class="px-3 py-1 rounded-lg border transition-colors"
          :class="
            page === currentPage
              ? 'bg-clinic-accent text-white border-clinic-accent'
              : 'border-clinic-border hover:bg-clinic-dark text-gray-300'
          "
        >
          {{ page }}
        </button>
      </div>
      
      <button
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="p-2 rounded-lg border border-clinic-border hover:bg-clinic-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Icon name="lucide:chevron-right" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

