<script setup lang="ts">
interface Props {
  title: string;
  value: string | number;
  icon: string;
  trend?: number;
  trendLabel?: string;
  color?: "emerald" | "cyan" | "amber" | "red" | "purple";
}

const props = withDefaults(defineProps<Props>(), {
  color: "emerald",
});

const colorClasses = computed(() => {
  switch (props.color) {
    case "cyan":
      return "from-cyan-500/20 to-cyan-600/5 text-black";
    case "amber":
      return "from-amber-500/20 to-amber-600/5 text-black";
    case "red":
      return "from-red-500/20 to-red-600/5 text-black";
    case "purple":
      return "from-purple-500/20 to-purple-600/5 text-black";
    default:
      return "from-emerald-500/20 to-emerald-600/5 text-black";
  }
});
</script>

<template>
  <div class="card p-5 relative overflow-hidden group">
    <!-- Background Glow -->
    <div
      class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br rounded-full -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-150"
      :class="colorClasses"
    />

    <div class="relative">
      <!-- Icon -->
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br"
        :class="colorClasses"
      >
        <Icon :name="icon" class="w-6 h-6" />
      </div>

      <!-- Title -->
      <p class="text-black text-sm mb-1">{{ title }}</p>

      <!-- Value -->
      <p class="text-2xl font-bold text-black">{{ value }}</p>

      <!-- Trend -->
      <div v-if="trend !== undefined" class="mt-2 flex items-center gap-1 text-sm">
        <Icon
          :name="trend >= 0 ? 'lucide:trending-up' : 'lucide:trending-down'"
          class="w-4 h-4 text-black"
        />
        <span class="text-black">
          {{ Math.abs(trend) }}%
        </span>
        <span v-if="trendLabel" class="text-black">{{ trendLabel }}</span>
      </div>
    </div>
  </div>
</template>

