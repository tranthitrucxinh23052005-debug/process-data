from fastapi import FastAPI, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import json
from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder
from sklearn.cluster import MiniBatchKMeans
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from statsmodels.tsa.arima.model import ARIMA
from sklearn.decomposition import PCA # THÊM DÒNG NÀY Ở ĐẦU FILE
from sklearn.cluster import KMeans

app = FastAPI()

# 1. Cấu hình CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CÁC HÀM BỔ TRỢ ---
def read_data(file: UploadFile):
    file.file.seek(0)
    if file.filename.endswith('.xlsx'):
        return pd.read_excel(file.file)
    return pd.read_csv(file.file)

def process_pipeline(df, mode, cols_to_scale, scale_type, encode_type, encode_cols):
    df_processed = df.copy()
    num_cols = [col for col in cols_to_scale if col in df_processed.columns]
    
    for col in num_cols:
        df_processed[col] = pd.to_numeric(df_processed[col], errors='coerce')

    # Cleaning [cite: 108]
    if mode == "drop": df_processed = df_processed.dropna(subset=num_cols)
    elif mode == "mean": df_processed[num_cols] = df_processed[num_cols].fillna(df_processed[num_cols].mean())
    elif mode == "mode": df_processed[num_cols] = df_processed[num_cols].apply(lambda x: x.fillna(x.mode()[0] if not x.mode().empty else 0))
    elif mode == "ffill": df_processed[num_cols] = df_processed[num_cols].ffill().bfill()

    # Encoding [cite: 108]
    valid_encode_cols = [col for col in encode_cols if col in df_processed.columns]
    if encode_type == "label" and valid_encode_cols:
        le = LabelEncoder()
        for col in valid_encode_cols: df_processed[col] = le.fit_transform(df_processed[col].astype(str))

    # Scaling [cite: 108, 109]
    if scale_type == "standard" and num_cols:
        df_processed[num_cols] = StandardScaler().fit_transform(df_processed[num_cols].fillna(0))
    elif scale_type == "minmax" and num_cols:
        df_processed[num_cols] = MinMaxScaler().fit_transform(df_processed[num_cols].fillna(0))

    return df_processed

# --- CÁC ENDPOINT API ---

# API 1: Upload & Phân tích lỗi [cite: 102, 107]
@app.post("/api/upload")
def upload_file(file: UploadFile = File(...)):
    try:
        df = read_data(file)
        total_rows = len(df)
        columns_info = []
        missing_stats = []

        for col in df.columns:
            sys_nan = int(df[col].isna().sum())
            dtype_str = str(df[col].dtype).lower()

            # --- NHẬN DIỆN THÔNG MINH ---
            if "datetime" in dtype_str:
                display_type = "THỜI GIAN"
            elif "int" in dtype_str or "float" in dtype_str:
                display_type = "SỐ"
            else:
                # Nếu là kiểu Chữ, thử quét xem có phải Ngày Tháng (Time) bị ẩn không
                sample = df[col].dropna().astype(str).head(50)
                if not sample.empty:
                    # Thử parse datetime, nếu thành công > 80% thì đây là cột THỜI GIAN
                    parsed = pd.to_datetime(sample, errors='coerce')
                    if parsed.notna().sum() > len(sample) * 0.8:
                        display_type = "THỜI GIAN"
                    else:
                        display_type = "CHỮ"
                else:
                    display_type = "CHỮ"

            # Ghi nhận kết quả
            columns_info.append({
                "name": col, 
                "type": display_type, # Sẽ trả về đúng "SỐ", "CHỮ", hoặc "THỜI GIAN"
                "nan_count": sys_nan
            })
            
            # Tính toán lỗi Missing do người dùng nhập ẩu (null, none, miss...)
            user_miss = sys_nan
            if display_type == "CHỮ":
                text_col = df[col].astype(str).str.lower().str.strip()
                user_miss = int(text_col.isin(['null', 'miss', 'none', '', 'nan']).sum())
            
            missing_stats.append({
                "column": col, 
                "System_NaN": sys_nan, 
                "User_Miss": max(0, user_miss - sys_nan)
            })

        return {"status": "success", "total_rows": total_rows, "columns_info": columns_info, "missing_stats": missing_stats}
    except Exception as e:
        return {"status": "error", "message": str(e)}
# API 2: Xử lý Pipeline & BI Dashboard [cite: 108, 111]

@app.post("/api/process-data")
async def process_data(
    file: UploadFile = File(...), 
    mode: str = Form("none"),
    scale_type: str = Form("none"),
    scale_cols: str = Form(""),
    group_by: str = Form(None),
    agg_col: str = Form(None), 
    agg_func: str = Form("none")
):
    try:
        df = read_data(file)
        
        # 1. Pipeline xử lý dữ liệu
        selected_cols = [c.strip() for c in scale_cols.split(",") if c.strip()]
        df_processed = process_pipeline(df, mode, selected_cols, scale_type, "none", [])

        # 2. Gom nhóm
        if group_by and group_by != "none" and agg_col and agg_func != "none":
            df_processed[agg_col] = pd.to_numeric(df_processed[agg_col], errors='coerce')
            df_display = df_processed.groupby(group_by)[agg_col].agg(agg_func).reset_index()
        else:
            df_display = df_processed.sample(n=min(100, len(df_processed)))

        # --- ⚔️ VŨ KHÍ TỐI THƯỢNG (BẢN V2 TẤT SÁT) ---
        # Bước 1: Ép toàn bộ bảng về kiểu "object" (cho phép chứa cả chữ, số, và None)
        df_display = df_display.astype(object)
        
        # Bước 2: Thay thế toàn bộ các giá trị lỗi/trống (NaN, NaT, Inf) bằng None
        # Vì đã là kiểu object, Pandas sẽ ngoan ngoãn giữ nguyên chữ None này.
        df_display = df_display.where(pd.notnull(df_display), None)
        
        # Làm tương tự với ma trận tương quan để chặn mọi rủi ro
        corr_matrix = df_processed.select_dtypes(include=[np.number]).corr().fillna(0)
        corr_matrix = corr_matrix.astype(object).where(pd.notnull(corr_matrix), None)
        # ----------------------------------------------

        return {
            "status": "success", 
            "data": df_display.to_dict(orient='records'),
            "correlation": corr_matrix.to_dict()
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# API 3: Phân cụm K-Means [cite: 113]
@app.post("/api/kmeans-pipeline")
async def kmeans_pipeline(
    k: int = 3, 
    file: UploadFile = File(...), 
    scale_type: str = Form("none"), 
    scale_cols: str = Form(""),
    kmeans_cols: str = Form("") # THÊM BIẾN NÀY ĐỂ NHẬN DỮ LIỆU ĐỘC LẬP
):
    try:
        df = read_data(file)
        # Vẫn chạy chuẩn hóa bình thường nếu TX có chọn ở Bước 4
        selected_scale = [c.strip() for c in scale_cols.split(",") if c.strip()]
        df_processed = process_pipeline(df, "drop", selected_scale, scale_type, "none", [])
        
        # --- LOGIC MỚI: DÙNG CỘT RIÊNG CỦA K-MEANS ---
        selected_k_cols = [c.strip() for c in kmeans_cols.split(",") if c.strip()]
        
        if len(selected_k_cols) < 2:
            return {"status": "error", "message": "Chọn ít nhất 2 biến SỐ ở khu vực K-Means để phân cụm nhé TX!"}
            
        data_to_cluster = df_processed[selected_k_cols].dropna()
        
        # 1. Chạy thuật toán K-Means
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(data_to_cluster)
        
        # 2. PCA để vẽ Scatter 2D
        pca = PCA(n_components=2)
        pca_result = pca.fit_transform(data_to_cluster)
        
        # 3. Gom dữ liệu
        scatter_data = []
        for i in range(len(pca_result)):
            scatter_data.append({
                "x": float(pca_result[i, 0]), 
                "y": float(pca_result[i, 1]), 
                "cluster": f"Cụm {int(clusters[i]) + 1}"
            })
            
        return {
            "status": "success", 
            "features": selected_k_cols, 
            "centers": kmeans.cluster_centers_.tolist(),
            "scatter_data": scatter_data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# API 4: Huấn luyện dự báo (RF & Linear) [cite: 88, 89]
@app.post("/api/predict")
def run_prediction(file: UploadFile = File(...), target_col: str = Form(...), feature_cols: str = Form(...), model_type: str = Form("linear")):
    try:
        df = read_data(file)
        features = [c.strip() for c in feature_cols.split(",") if c.strip()]
        for col in features + [target_col]: 
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df = df[features + [target_col]].dropna()
        
        if len(df) < 10: return {"status": "error", "message": "Không đủ dữ liệu"}

        X_train, X_test, y_train, y_test = train_test_split(df[features], df[target_col], test_size=0.2, random_state=42)
        model = RandomForestRegressor(n_estimators=100, random_state=42) if model_type == "rf" else LinearRegression()
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        metrics = {
            "r2": round(float(r2_score(y_test, y_pred)), 4),
            "mse": round(float(mean_squared_error(y_test, y_pred)), 4),
            "mae": round(float(mean_absolute_error(y_test, y_pred)), 4)
        }
        return {"status": "success", "metrics": metrics}
    except Exception as e: return {"status": "error", "message": str(e)}

# API 5: Dự báo giá trị tùy chỉnh [cite: 88]
@app.post("/api/predict-custom")
def predict_custom(file: UploadFile = File(...), target_col: str = Form(...), feature_cols: str = Form(...), model_type: str = Form("linear"), input_data: str = Form(...)):
    try:
        df = read_data(file)
        features = [c.strip() for c in feature_cols.split(",") if c.strip()]
        for col in features + [target_col]: df[col] = pd.to_numeric(df[col], errors='coerce')
        df = df[features + [target_col]].dropna()
        
        model = RandomForestRegressor(n_estimators=50, random_state=42) if model_type == "rf" else LinearRegression()
        model.fit(df[features], df[target_col])
        
        inputs = json.loads(input_data)
        X_custom = pd.DataFrame([inputs])
        pred = model.predict(X_custom)[0]
        return {"status": "success", "prediction": round(float(pred), 2)}
    except Exception as e: return {"status": "error", "message": str(e)}

# API 6: Dự báo chuỗi thời gian ARIMA [cite: 96]
@app.post("/api/forecast-arima")
async def forecast_arima(file: UploadFile = File(...), date_col: str = Form(...), target_col: str = Form(...), steps: int = Form(5)):
    try:
        df = read_data(file)
        
        # Chuyển đổi và xử lý cột Target
        series = pd.to_numeric(df[target_col], errors='coerce').dropna()
        
        if len(series) < 10:
            return {"status": "error", "message": "Cần ít nhất 10 điểm dữ liệu"}

        # Reset index để tránh lỗi "Unsupported Index" của statsmodels
        series = series.reset_index(drop=True)

        # Huấn luyện ARIMA với tham số an toàn (p=5, d=1, q=0)
        model = ARIMA(series, order=(5, 1, 0))
        model_fit = model.fit()
        forecast = model_fit.forecast(steps=int(steps))
        
        # Chuẩn bị dữ liệu vẽ biểu đồ
        # Lấy 20 điểm cuối làm lịch sử
        history_len = min(len(series), 20)
        history = []
        for i in range(len(series) - history_len, len(series)):
            history.append({
                "date": str(i), 
                "actual": float(series.iloc[i])
            })
            
        # Dữ liệu dự báo
        predictions = []
        last_idx = len(series) - 1
        for i, v in enumerate(forecast):
            predictions.append({
                "date": f"Dự báo {i+1}", 
                "forecast": float(v)
            })
            
        return {"status": "success", "historical": history, "predictions": predictions}
    except Exception as e:
        return {"status": "error", "message": str(e)}