// Composable to manage low stock alert refresh events
const refreshTrigger = ref(0);

export const useLowStockAlert = () => {
  const refresh = () => {
    refreshTrigger.value++;
  };

  return {
    refresh,
    refreshTrigger: readonly(refreshTrigger),
  };
};

