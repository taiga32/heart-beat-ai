interface ModelData {
  coefficients: number[];
  intercept: number;
  scaler_mean: number[];
  scaler_scale: number[];
}

let modelData: ModelData | null = null;

// モデルの読み込み
export const loadModel = async () => {
  const response = await fetch('/models/lasso_model.json');
  modelData = await response.json();
};

// 予測処理
export const predictHeartRate = (features: number[]) => {
  if (!modelData) {
    console.error("モデルデータが読み込まれていません");
    return null;
  }

  // 特徴量の標準化
  const standardizedFeatures = features.map((value, index) =>
    (value - modelData!.scaler_mean[index]) / modelData!.scaler_scale[index]
  );

  // Lasso回帰の予測計算
  const prediction = standardizedFeatures.reduce(
    (sum, feature, index) => sum + feature * modelData!.coefficients[index],
    modelData!.intercept
  );

  return prediction;
};
