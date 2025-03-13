import * as faceapi from "face-api.js";

/**
 * FaceAPIのモデルをロード
 */
export const loadModels = async () => {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights"),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights"),
    faceapi.nets.ssdMobilenetv1.loadFromUri("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights"),
  ]);
  console.log("FaceAPI モデルロード完了");
};

/**
 * 顔の検出を行う
 */
export const detectFace = async (videoElement: HTMLVideoElement) => {
  if (!videoElement) return null;

  const detection = await faceapi
    .detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options())
    .withFaceLandmarks(true);

  return detection;
};

/**
 * 額の領域（ROI: Region of Interest）を取得する
 */
export const getForeheadRegion = async (videoElement: HTMLVideoElement) => {
  const detection = await detectFace(videoElement);
  if (!detection) return null;

  const landmarks = detection.landmarks;

  // 眉の中央部分（左眉：19, 右眉：24）
  const leftEyebrow = landmarks.positions[19];
  const rightEyebrow = landmarks.positions[24];

  if (!leftEyebrow || !rightEyebrow) return null;

  // 額の中心座標
  const foreheadX = (leftEyebrow.x + rightEyebrow.x) / 2;
  const foreheadY = (leftEyebrow.y + rightEyebrow.y) / 2 - 30; // 少し上にずらす

  // 座標を左右反転
  const videoWidth = videoElement.videoWidth;
  const flippedForeheadX = videoWidth - foreheadX;

  return {
    x: flippedForeheadX - 50, // 額の中心から左右に広げる
    y: foreheadY - 20, // 額の中心から上下に広げる
    width: 100, // 額の幅
    height: 40, // 額の高さ
  };
};