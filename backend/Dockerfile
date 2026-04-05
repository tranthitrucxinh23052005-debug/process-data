# Sử dụng Python bản ổn định
FROM python:3.10-slim

# Thiết lập thư mục làm việc trong máy ảo
WORKDIR /code

# Copy file thư viện vào và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code backend vào
COPY . .

# Hugging Face Spaces chạy ở cổng 7860 mặc định
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]