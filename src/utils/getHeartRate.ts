export const getHeartRateFromROI = (canvas: HTMLCanvasElement, region: { x: number; y: number; width: number; height: number }) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Canvasのコンテキストが取得できません");
      return;
    }
  
    const rgbValues: number[] = [];
  
    const captureFrame = () => {
      const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
      const data = imageData.data; // RGBA配列
      let rTotal = 0, gTotal = 0, bTotal = 0;
  
      // RGB値を集計
      for (let i = 0; i < data.length; i += 4) {
        rTotal += data[i];
        gTotal += data[i + 1];
        bTotal += data[i + 2];
      }
  
      // RGBの平均値
      const rAvg = rTotal / (data.length / 4);
      const gAvg = gTotal / (data.length / 4);
      const bAvg = bTotal / (data.length / 4);
  
      // Gチャネルを使用（最も安定した脈拍信号が得られる）
      rgbValues.push(gAvg);
  
      if (rgbValues.length > 300) rgbValues.shift(); // データが多すぎる場合は古いデータを削除
  
      requestAnimationFrame(captureFrame);
    };
  
    captureFrame();
  
    // シンプルなピーク検出
    setInterval(() => {
      if (rgbValues.length < 150) return;
  
      const peaks = detectPeaks(rgbValues);
      const bpm = (peaks.length / (rgbValues.length / 30)) * 60; // 30fpsベースの変換
      console.log(`推定脈拍: ${Math.round(bpm)} bpm`);
    }, 1000);
  };
  
  // ピーク検出関数 (シンプルなロジック)
  export const detectPeaks = (data: number[]) => {
    const peaks: number[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  };
  