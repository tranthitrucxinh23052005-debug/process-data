import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("TX Dashboard Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: '8px' }}>
          <h3>⚠️ Đã có lỗi xảy ra khi vẽ biểu đồ</h3>
          <p>Dữ liệu sau khi xử lý có thể chưa tương thích. Hãy thử chọn lại Mode Cleaning hoặc Scaler khác.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', cursor: 'pointer' }}>Tải lại trang</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default ErrorBoundary;