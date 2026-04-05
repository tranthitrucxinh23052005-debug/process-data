// frontend/src/fileWorker.js

self.onmessage = function (e) {
  const file = e.data;
  
  // Chỉ cắt 64KB đầu tiên của file để đọc preview, tránh lag
  const chunkSize = 64 * 1024; 
  const blob = file.slice(0, chunkSize);

  const reader = new FileReader();
  
  reader.onload = function (event) {
    const text = event.target.result;
    // Tách theo dòng và lấy 5 dòng đầu tiên
    const lines = text.split('\n').slice(0, 5);
    
    // Gửi kết quả về lại cho luồng chính (App.jsx)
    self.postMessage({ status: 'success', preview: lines });
  };

  reader.onerror = function () {
    self.postMessage({ status: 'error', message: 'Lỗi khi đọc file' });
  };

  reader.readAsText(blob);
};