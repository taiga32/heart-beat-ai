<template>
  <div class="container">
    <video ref="video" autoplay playsinline></video>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineEmits } from "vue";
import { loadModels, getForeheadRegion } from "../utils/faceDetection";
import { getHeartRateFromROI } from "../utils/getHeartRate";

const emit = defineEmits(["updateHeartRate"]);

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;

/**
 * 額の枠を描画する関数
 */
const drawForeheadBox = async () => {
  if (!video.value || !canvas.value) return;

  const ctx = canvas.value.getContext("2d");
  if (!ctx) {
    console.error("Canvas のコンテキストが取得できません");
    return;
  }

  canvas.value.width = video.value?.videoWidth || 640;
  canvas.value.height = video.value?.videoHeight || 480;

  const rgbValues: number[] = [];

  const update = async () => {
    if (!video.value || !canvas.value) return;

    const forehead = await getForeheadRegion(video.value);
    if (forehead) {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(forehead.x, forehead.y, forehead.width, forehead.height);

      // ROIの中央部分のみを取得
      const margin = 5;
      const roiX = forehead.x + margin;
      const roiY = forehead.y + margin;
      const roiWidth = forehead.width - margin * 2;
      const roiHeight = forehead.height - margin * 2;

      const imageData = ctx.getImageData(roiX, roiY, roiWidth, roiHeight);
      const data = imageData.data;

      let gTotal = 0;
      for (let i = 0; i < data.length; i += 4) {
        gTotal += data[i + 1]; // Gチャネル
      }

      const gAvg = gTotal / (data.length / 4);
      rgbValues.push(gAvg);

      if (rgbValues.length > 300) rgbValues.shift();
　　　　　　　　　　　　　　　　　　　
      // `getHeartRateFromROI` で脈拍推定
      if (rgbValues.length >= 150) {
        const bpm = getHeartRateFromROI(rgbValues);
        console.log(`推定脈拍: ${Math.round(bpm)} bpm`);
        emit("updateHeartRate", Math.round(bpm));
      }
    } else {
      console.warn("額の座標が取得できません");
    }

    animationFrameId = requestAnimationFrame(update);
  };

  update();
};


/**
 * カメラを起動し、映像を取得
 */
const startCapture = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (video.value) {
      video.value.srcObject = stream;
      video.value.onloadedmetadata = () => {
        video.value?.play();
        drawForeheadBox();
      };
    }
  } catch (error) {
    console.error("カメラの取得に失敗しました", error);
  }
};

onMounted(async () => {
  await loadModels();
  await startCapture();
});

onUnmounted(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
});
</script>

<style scoped>
.container {
  position: relative;
  display: inline-block;
}
video {
  width: 100%;
  transform: scaleX(-1);
}
canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
  z-index: 10;
}
</style>