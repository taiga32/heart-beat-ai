<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineEmits } from "vue";
import { loadModels, getForeheadRegion } from "../utils/faceDetection";
import { getHeartRateFromROI } from "../utils/getHeartRate";

const emit = defineEmits(["updateHeartRate"]);

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;
const rgbValues: number[] = [];
let isCameraActive = false;

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

      let gTotal = 0;
      for (let i = 0; i < data.length; i += 4) {
        gTotal += data[i + 1]; // Gチャネル
      }

      const gAvg = gTotal / (data.length / 4);
      rgbValues.push(gAvg);

      if (rgbValues.length > 300) rgbValues.shift();

      if (rgbValues.length >= 150) {
        const bpm = getHeartRateFromROI(rgbValues);
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

/**
 * カメラを開始する関数
 */
const startCamera = async () => {
  if (!video.value) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.value.srcObject = stream;
    video.value.play().then(() => {
      isCameraActive = true;
      drawForeheadBox();
    }).catch(err => {
      console.error("動画再生エラー:", err);
    });
  } catch (error) {
    console.error("カメラの取得に失敗しました", error);
  }
};

/**
 * カメラを停止する関数
 */
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

onMounted(async () => {
  await loadModels();
});

onUnmounted(() => {
  stopCamera();
});
</script>
<template>
  <div class="container">
    <div class="video-wrapper">
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas"></canvas>
    </div>

    <div class="controls">
      <button @click="startCamera">カメラ開始</button>
      <button @click="stopCamera">カメラ停止</button>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center; /* 中央配置 */
  gap: 16px; /* 要素間の余白 */
}

.video-wrapper {
  position: relative;
  width: 640px; /* ビデオの幅を固定 */
  height: 480px; /* ビデオの高さを固定 */
  border: 2px solid #ddd; /* ビデオ枠の視認性を向上 */
  border-radius: 12px;
  overflow: hidden; /* はみ出し防止 */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); /* 立体感 */
}

video, canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.controls {
  display: flex;
  gap: 12px;
}

button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s ease;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
</style>