export const getHeartRateFromROI = (rgbValues: number[]): number => {
    // 正規化
    const minVal = Math.min(...rgbValues);
    const maxVal = Math.max(...rgbValues);
    const normalizedValues = rgbValues.map(val => (val - minVal) / (maxVal - minVal + 1));
  
    // バンドパスフィルタ
    const filteredValues = bandpassFilter(normalizedValues, 0.8, 3.0, 30);
  
    // ピーク検出
    const peaks = detectPeaks(filteredValues);
  
    // BPM計算
    const bpm = (peaks.length / (filteredValues.length / 30)) * 60;
  
    return bpm;
  };
  
  /**
   * バンドパスフィルタ
   */
  const bandpassFilter = (signal: number[], lowCut: number, highCut: number, fps: number): number[] => {
    const nyquist = 0.5 * fps;
    const low = lowCut / nyquist;
    const high = highCut / nyquist;
  
    return signal.map((val, idx) => {
      const t = idx / fps;
      return val * (Math.sin(2 * Math.PI * high * t) - Math.sin(2 * Math.PI * low * t));
    });
  };
  
  /**
   * ピーク検出
   */
  const detectPeaks = (data: number[]): number[] => {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  };
  