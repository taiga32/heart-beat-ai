<script setup lang="ts">
import { ref, onMounted } from "vue";

const video = ref<HTMLVideoElement | null>(null);

const startCapture = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  if (video.value) video.value.srcObject = stream;
};

onMounted(() => {
  startCapture();
});
</script>

<template>
    <div>
      <video ref="video" autoplay></video>
      <button @click="startCapture">カメラ開始</button>
    </div>
  </template>
  

  