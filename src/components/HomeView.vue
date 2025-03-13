<script setup lang="ts">
import { ref } from "vue";
import FaceDetection from "./FaceDetection.vue";

const heartRate = ref<number | null>(null);

const handleHeartRateUpdate = (bpm: number) => {
  heartRate.value = bpm;
};
</script>
<template>
  <div>
    <FaceDetection @updateHeartRate="handleHeartRateUpdate" />
    <p>推定脈拍: {{ heartRate }} bpm</p>
  </div>
</template>
