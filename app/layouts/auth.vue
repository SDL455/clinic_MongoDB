<script setup lang="ts">
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4"
    style="background: #ffffff;"
  >

    <!-- Content -->
    <div class="relative z-10 w-full max-w-md">
      <slot />
    </div>

    <!-- Notifications -->
    <NotificationContainer />
  </div>
</template>
