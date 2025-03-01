<template>
    <div class="container">
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas"></canvas>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onMounted, onUnmounted } from "vue";
  import { loadModels, getForeheadRegion } from "../utils/faceDetection";
  
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
  
    // Canvasサイズをvideoのサイズに設定
    canvas.value.width = video.value?.videoWidth || 640;
    canvas.value.height = video.value?.videoHeight || 480;

    console.log("Canvasサイズ:", canvas.value.width, canvas.value.height);

//   console.log("固定枠を描画しました", ctx);
    // const updateCanvasSize = () => {
    //   if (!video.value || !canvas.value) return;
    //   canvas.value.width = video.value.videoWidth;
    //   canvas.value.height = video.value.videoHeight;
    // };
  
    // ループ処理で額の枠を描画
    const update = async () => {
      if (!video.value || !canvas.value) return;
  
    //   updateCanvasSize(); // 動画サイズが変わったらCanvasを更新
    
    const forehead = await getForeheadRegion(video.value);
    if (forehead) {
        console.log("額の座標:", forehead); // デバッグ用ログ
        ctx.clearRect(0, 0, canvas.value.width, canvas.value.height); // 画面をクリア
        ctx.strokeStyle = "red"; // 枠の色
        ctx.lineWidth = 2;
        ctx.strokeRect(forehead.x, forehead.y, forehead.width, forehead.height);
        console.log('ctx', ctx)
    } else {
        console.warn("額の座標が取得できません");
    }
  
      animationFrameId = requestAnimationFrame(update); // 次のフレームへ

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
          drawForeheadBox(); // 額の枠を描画開始
        };
      }
    } catch (error) {
      console.error("カメラの取得に失敗しました", error);
    }
  };
  
  onMounted(async () => {
    await loadModels(); // FaceAPIのモデルをロード
    await startCapture(); // カメラを起動
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
    transform: scaleX(-1); /* ミラー反転 */
  }
  canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
    z-index: 10; /* canvasを前面に出す */
  }
  </style>
  