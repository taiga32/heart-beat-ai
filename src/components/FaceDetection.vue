<template>
  <div class="container">
    <div class="video-container">
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas"></canvas>
    </div>
    <button @click="startCamera">カメラ開始</button>
    <button @click="stopCamera">カメラ停止</button>
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
const rgbValues: { R: number[], G: number[], B: number[] } = { R: [], G: [], B: [] };
let mediaStream: MediaStream | null = null;
let isCameraActive = false;

const drawForeheadBox = async () => {
  if (!video.value || !canvas.value) return;

  const ctx = canvas.value.getContext("2d");
  if (!ctx) {
    console.error("Canvas のコンテキストが取得できません");
    return;
  }

  canvas.value.width = video.value.videoWidth || 640;
  canvas.value.height = video.value.videoHeight || 480;

  const offscreenCanvas = new OffscreenCanvas(canvas.value.width, canvas.value.height);
  const offscreenCtx = offscreenCanvas.getContext("2d");

  const update = async () => {
    if (!video.value || !canvas.value || !offscreenCtx || !isCameraActive) return;

    const forehead = await getForeheadRegion(video.value);
    if (forehead) {
      offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      offscreenCtx.drawImage(video.value, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

      const margin = 5;
      const roiX = forehead.x + margin;
      const roiY = forehead.y + margin;
      const roiWidth = forehead.width - margin * 2;
      const roiHeight = forehead.height - margin * 2;

      const imageData = offscreenCtx.getImageData(roiX, roiY, roiWidth, roiHeight);
      const data = imageData.data;

      let rTotal = 0, gTotal = 0, bTotal = 0;
      for (let i = 0; i < data.length; i += 4) {
        rTotal += data[i];     // Rチャネル
        gTotal += data[i + 1]; // Gチャネル
        bTotal += data[i + 2]; // Bチャネル
      }

      const rAvg = rTotal / (data.length / 4);
      const gAvg = gTotal / (data.length / 4);
      const bAvg = bTotal / (data.length / 4);

      rgbValues.R.push(rAvg);
      rgbValues.G.push(gAvg);
      rgbValues.B.push(bAvg);

      if (rgbValues.R.length > 300) rgbValues.R.shift();
      if (rgbValues.G.length > 300) rgbValues.G.shift();
      if (rgbValues.B.length > 300) rgbValues.B.shift();

      if (rgbValues.G.length >= 150) {
        const bpm = getHeartRateFromROI(rgbValues.G);
        console.log(`推定脈拍: ${Math.round(bpm)} bpm`);
        emit("updateHeartRate", Math.round(bpm));
      }

      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(forehead.x, forehead.y, forehead.width, forehead.height);
    } else {
      console.warn("額の座標が取得できません");
    }

    animationFrameId = requestAnimationFrame(update);
  };

  update();
};

const startCamera = async () => {
  await loadModels();
  if (video.value) {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.value.srcObject = mediaStream;
    isCameraActive = true;
    video.value.addEventListener("loadeddata", drawForeheadBox);
  }
};

const stopCamera = () => {
  if (!video.value || !video.value.srcObject) return;

  const stream = video.value.srcObject as MediaStream;
  stream.getTracks().forEach(track => track.stop());

  video.value.srcObject = null;
  isCameraActive = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 🔹 キャンバスの内容をクリア
  const ctx = canvas.value?.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.value!.width, canvas.value!.height);
  }
};


onUnmounted(stopCamera);
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.video-container {
  position: relative;
  width: 640px;
  height: 480px;
}
video, canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
}
button {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #4CAF50;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #45a049;
}
</style>
