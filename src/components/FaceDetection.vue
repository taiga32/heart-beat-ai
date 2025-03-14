<template>
  <div class="container">
    <div class="video-container">
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas"></canvas>
    </div>
    <button @click="startCamera">カメラ開始</button>
    <button @click="stopCamera">カメラ停止</button>
    <button @click="exportCsv">ファイルエクスポート</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineEmits } from "vue";
import { loadModels, getForeheadRegion } from "../utils/faceDetection";
import { getHeartRateFromROI } from "../utils/getHeartRate";
import { mean, standardDeviation, sampleKurtosis, sampleSkewness } from 'simple-statistics';
import { loadModel, predictHeartRate } from "../utils/modelPredictor";

const emit = defineEmits(["updateHeartRate"]);

const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;
const rgbValues: { R: number[], G: number[], B: number[] } = { R: [], G: [], B: [] };
let mediaStream: MediaStream | null = null;
let isCameraActive = false;

/**
 * RGBごとに最大値、最小値、標準偏差、尖度、歪度
 * R-G, R-B, G-B
 * 脈拍周波数帯とノイズ周波数帯のパワー比（RGBごとに) 
 */
const calculateFeatures = () => {
  const features = {
    maxR: Math.max(...rgbValues.R),
    maxG: Math.max(...rgbValues.G),
    maxB: Math.max(...rgbValues.B),

    minR: Math.min(...rgbValues.R),
    minG: Math.min(...rgbValues.G),
    minB: Math.min(...rgbValues.B),

    stdR: standardDeviation(rgbValues.R),
    stdG: standardDeviation(rgbValues.G),
    stdB: standardDeviation(rgbValues.B),

    kurtosisR: sampleKurtosis(rgbValues.R),
    kurtosisG: sampleKurtosis(rgbValues.G),
    kurtosisB: sampleKurtosis(rgbValues.B),

    skewR: sampleSkewness(rgbValues.R),
    skewG: sampleSkewness(rgbValues.G),
    skewB: sampleSkewness(rgbValues.B),

    rgCorr: mean(rgbValues.R.map((r, i) => r - rgbValues.G[i])),
    rbCorr: mean(rgbValues.R.map((r, i) => r - rgbValues.B[i])),
    gbCorr: mean(rgbValues.G.map((g, i) => g - rgbValues.B[i])),
  };

  return features;
};

const exportCsv = () => {
  const features = calculateFeatures();
  const csvContent = Object.keys(features).join(",") + "\n" + Object.values(features).join(",");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "features.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('csvがエクスポートされました。')
};

const predictHeartRateFromRGB = async () => {
  const features = calculateFeatures();
  const featureValues = Object.values(features);

  const predictedHeartRate = predictHeartRate(featureValues);
  if (predictedHeartRate !== null) {
    const roundedHeartRate = Math.round(predictedHeartRate); // 四捨五入
    emit("updateHeartRate", roundedHeartRate);
    console.log(`推定脈拍数: ${roundedHeartRate} bpm`);
  }
};

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

      for (let i = 0; i < data.length; i += 4) {
        rgbValues.R.push(data[i]);     // Rチャネル
        rgbValues.G.push(data[i + 1]);     // Gチャネル
        rgbValues.B.push(data[i + 2]);     // Bチャネル

        // サイズオーバー防止のため、配列のサイズを10000に制限
        if (rgbValues.R.length > 10000) rgbValues.R.shift();
        if (rgbValues.G.length > 10000) rgbValues.G.shift();
        if (rgbValues.B.length > 10000) rgbValues.B.shift();
      }

      const bpm = getHeartRateFromROI(rgbValues.G);
      console.log(`推定脈拍: ${Math.round(bpm)} bpm`);
      emit("updateHeartRate", Math.round(bpm));

      // 額領域の描画
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(forehead.x, forehead.y, forehead.width, forehead.height);

      predictHeartRateFromRGB();

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


onMounted(async () => {
  await loadModel();
});

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
