import * as faceapi from "face-api.js";

export const loadModels = async () => {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
  ]);
  console.log("FaceAPI モデルロード完了");
};

export const detectFace = async (videoElement: HTMLVideoElement) => {
  if (!videoElement) return null;

  const detection = await faceapi.detectSingleFace(
    videoElement,
    new faceapi.TinyFaceDetectorOptions()
  ).withFaceLandmarks(true);

  return detection;
};

/**
 * 額の領域（ROI: Region of Interest）を取得する
 */
export const getForeheadRegion = async (videoElement: HTMLVideoElement) => {
  const detection = await detectFace(videoElement);
  if (!detection) return null;

  const landmarks = detection.landmarks.positions;

  // 額の領域（両目の間の少し上の位置）
  return {
    x: landmarks[21].x, // 左目の上
    y: landmarks[21].y - 20, // 少し上にずらす
    width: landmarks[22].x - landmarks[21].x, // 両目の間の幅
    height: 20, // 縦幅
  };
};
