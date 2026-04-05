import React, { useState, useRef, useEffect } from 'react';
import FileWorker from './fileWorker.js?worker';
import { 
  BarChart, Bar, ScatterChart, Scatter, LineChart, Line, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis,Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


const MARIO = {
  sky: '#5C94FC', red: '#E4000F', green: '#00A651', yellow: '#F8D824', 
  brick: '#9C4A00', black: '#000000', white: '#FFFFFF'
};

const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function App() {
  const reportRef = useRef(null);
  const bgMusicRef = useRef(null);

  // --- States ---
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState('LET\'S-A GO! CHỌN FILE ĐI TX!');
  const [stepDataChecked, setStepDataChecked] = useState(false);
  const [stepProcessed, setStepProcessed] = useState(false);
  const [stepClustered, setStepClustered] = useState(false);
  const [columnsInfo, setColumnsInfo] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [missingData, setMissingData] = useState(null);
  const [processMode, setProcessMode] = useState('none');
  const [scaleType, setScaleType] = useState('none');
  const [selectedScaleCols, setSelectedScaleCols] = useState([]);
  const [biData, setBiData] = useState(null);
  const [corrMatrix, setCorrMatrix] = useState(null);
  const [chartType, setChartType] = useState('Bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [kClusters, setKClusters] = useState(3);
  const [kmeansData, setKmeansData] = useState(null);
  const [modelType, setModelType] = useState('rf');
  const [targetCol, setTargetCol] = useState('');
  const [modelMetrics, setModelMetrics] = useState(null);
  const [arimaDateCol, setArimaDateCol] = useState('');
  const [arimaTargetCol, setArimaTargetCol] = useState('');
  const [arimaSteps, setArimaSteps] = useState(5);
  const [arimaData, setArimaData] = useState(null);
  const [groupBy, setGroupBy] = useState('');
  const [aggFunc, setAggFunc] = useState('none');
// THÊM DÒNG NÀY VÀO ĐỂ REACT HIỂU BIẾN featureCols LÀ GÌ:
const [featureCols, setFeatureCols] = useState([]); 
const [kmeansCols, setKmeansCols] = useState([]);   // CÁI MỚI DÀNH RIÊNG CHO K-MEANS

  // --- Styles ---
  const brickBox = { background: MARIO.brick, border: '4px solid #000', padding: '30px', boxShadow: 'inset -4px -4px 0px #582800, 6px 6px 0px rgba(0,0,0,0.4)', marginBottom: '50px' };
  const questionBox = { background: MARIO.yellow, border: '4px solid #000', padding: '30px', boxShadow: 'inset -4px -4px 0px #BC8C00, 6px 6px 0px rgba(0,0,0,0.4)', color: '#000', marginBottom: '50px' };
  const pixelBtn = (bg) => ({ backgroundColor: bg, border: '4px solid #000', padding: '15px 25px', color: '#fff', fontSize: '18px', cursor: 'pointer', boxShadow: 'inset -4px -4px 0px rgba(0,0,0,0.3)', fontFamily: "'VT323'" });
  const pixelSelect = { border: '4px solid #000', padding: '10px', fontSize: '16px', fontFamily: "'VT323'", background: '#fff', color: '#000' };
  const pixelTableStyle = { width: '100%', borderCollapse: 'collapse', border: '4px solid #000', background: '#fff', color: '#000', fontFamily: "'VT323'" };
  const pixelTdThStyle = { border: '3px solid #000', padding: '12px', textAlign: 'center', fontSize: '16px' };

  // --- Effects & Sound ---
  useEffect(() => {
    bgMusicRef.current = new Audio('/assets/backgound.mp3');
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.3;
  }, []);

  const toggleMusic = () => {
    if (isMusicPlaying) bgMusicRef.current.pause();
    else bgMusicRef.current.play().catch(() => console.log("Music blocked"));
    setIsMusicPlaying(!isMusicPlaying);
  };

  const playEffect = (fileName) => {
    new Audio(`/assets/${fileName}`).play().catch(() => {});
  };

  // --- Handlers ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStepDataChecked(false); setStepProcessed(false);
      setLoadingStatus('🍄 FILE ĐÃ NHẬN! SOI LỖI ĐI TX!');
      const worker = new FileWorker();
      worker.onmessage = (e) => { if (e.data.status === 'success') setPreviewData(e.data.preview); worker.terminate(); };
      worker.postMessage(file);
    }
  };

  const runCheckData = async () => {
    setLoadingStatus('⌛ ĐANG QUÉT...');
    const formData = new FormData(); formData.append('file', selectedFile);
    try {
      const res = await fetch('https://tieuthetunhacongdang-tx-data-analytics-api.hf.space/api/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if(result.status === 'success') {
        setColumnsInfo(result.columns_info);
        setMissingData(result.missing_stats);
        setStepDataChecked(true);
        setLoadingStatus('⭐ METADATA SẴN SÀNG!');
        playEffect('finish_step.mp3');
      }
    } catch (e) { setLoadingStatus('❌ LỖI KẾT NỐI!'); }
  };

  const runProcessData = async () => {
    setLoadingStatus('⌛ ĐANG GOM NHÓM DỮ LIỆU...');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', processMode);
    formData.append('scale_type', scaleType);
    formData.append('scale_cols', selectedScaleCols.join(','));
    
    // GỬI THÊM CÁC THÔNG SỐ NHÓM
    formData.append('group_by', xAxis); // Lấy cột trục X làm cột nhóm
    formData.append('agg_col', yAxis);  // Lấy cột trục Y để tính toán
    formData.append('agg_func', aggFunc); // State aggFunc (sum/mean/count)

    try {
      const res = await fetch('https://tieuthetunhacongdang-tx-data-analytics-api.hf.space/api/process-data', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.status === 'success') {
        setBiData(result.data);
        setStepProcessed(true);
        playEffect('finish_step.mp3');
      }
    } catch (e) { alert("Lỗi kết nối!"); }
};

  const runKMeans = async () => {
  if (kmeansCols.length < 2) return alert("🍄 Chọn ít nhất 2 biến đầu vào nha TX ơi!");
  
  setLoadingStatus('⌛ ĐANG CHẠY K-MEANS...');
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('scale_type', scaleType); 
  formData.append('scale_cols', selectedScaleCols.join(',')); 
  formData.append('kmeans_cols', kmeansCols.join(','));

  try {
    const res = await fetch(`https://tieuthetunhacongdang-tx-data-analytics-api.hf.space/api/kmeans-pipeline?k=${kClusters}`, { 
      method: 'POST', 
      body: formData 
    });
    
    const result = await res.json();
    
    if (result.status === 'success') {
      // Nhận dữ liệu và vẽ biểu đồ Scatter
      setKmeansData({ 
        features: result.features, 
        centers: result.centers, 
        scatter: result.scatter_data 
      });
      setStepClustered(true);
      playEffect('finish_step.mp3');
      setLoadingStatus('⭐ PHÂN CỤM XONG!');
    } else {
      // Nếu Backend báo lỗi, sẽ hiện hộp thoại thông báo
      alert("Lỗi từ AI: " + result.message);
    }
  } catch (e) { 
    alert("Lỗi kết nối Server lúc chạy K-Means!"); 
  }
};

  const runTrainModel = async () => {
  // Báo lỗi ngay nếu TX quên chọn X hoặc Y
  if (!targetCol || featureCols.length === 0) return alert("Khoan đã TX! Chọn ít nhất một X và một Y đã!");
  
  setLoadingStatus('⌛ ĐANG HUẤN LUYỆN AI...');
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('target_col', targetCol);
  formData.append('feature_cols', featureCols.join(',')); // Lấy danh sách X vừa tick
  formData.append('model_type', modelType);
  
  try {
    const res = await fetch('https://tieuthetunhacongdang-tx-data-analytics-api.hf.space/api/predict', { method: 'POST', body: formData });
    const result = await res.json();
    if (result.status === 'success') {
      setModelMetrics(result.metrics);
      playEffect('finish_step.mp3');
      setLoadingStatus('⭐ AI ĐÃ HỌC XONG!');
    } else {
      alert("Lỗi AI: " + result.message);
    }
  } catch (e) { alert("Lỗi kết nối AI!"); }
};

  const runARIMA = async () => {
    if (!arimaDateCol || !arimaTargetCol) return alert("Chọn Ngày và Y đã!");
    setLoadingStatus('⌛ ĐANG CHẠY ARIMA...');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('date_col', arimaDateCol);
    formData.append('target_col', arimaTargetCol);
    formData.append('steps', arimaSteps);
    try {
      const res = await fetch('https://tieuthetunhacongdang-tx-data-analytics-api.hf.space/api/forecast-arima', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.status === 'success') {
        setArimaData([...result.historical, ...result.predictions]);
        playEffect('finish_step.mp3');
      }
    } catch (e) { alert("Lỗi ARIMA!"); }
  };

  const exportPDF = async () => {
    playEffect('dowload.mp3');
    const element = reportRef.current;
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('TX_Mario_Report.pdf');
  };

  return (
    <div style={{ padding: '40px', background: MARIO.sky, minHeight: '100vh', fontFamily: "'VT323', monospace", position: 'relative' }}>
      
      {/* MUSIC CONTROLLER */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <button onClick={toggleMusic} style={pixelBtn(isMusicPlaying ? MARIO.green : MARIO.red)}>
          {isMusicPlaying ? '🔊 ON' : '🔇 OFF'}
        </button>
      </div>

      <div ref={reportRef} className="max-w-[1200px] mx-auto">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h1 style={{ fontSize: '48px', textShadow: '4px 4px 0px #000', marginBottom: '15px', color: '#fff' }}>🧱 TX ADVANCED ANALYTICS 🧱</h1>
          <p style={{ color: MARIO.yellow, fontSize: '20px' }}>{loadingStatus}</p>
        </div>

        {/* 1. UPLOAD */}
        <div style={questionBox}>
          <h2 className="mb-6">🪙 1. TẢI TỆP DỮ LIỆU</h2>
          <label style={pixelBtn(MARIO.red)}> CHỌN FILE CSV <input type="file" className="hidden" onChange={handleFileUpload} /> </label>
          {previewData.length > 0 && (
            <div className="mt-10">
              <h3 className="mb-4 uppercase">📄 DỮ LIỆU THÔ (DÒNG 1-4):</h3>
              <div style={{ overflowX: 'auto', border: '4px solid #000', background: '#fff', maxWidth: '100%' }}>
                <table style={{ ...pixelTableStyle, border: 'none', marginBottom: 0 }}>
                  <thead style={{ background: '#000', color: '#fff' }}>
                    <tr>{previewData[0]?.split(',').map((h, i) => <th key={i} style={pixelTdThStyle}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {previewData.slice(1).map((line, idx) => (
                      <tr key={idx}>{line.split(',').map((cell, j) => <td key={j} style={pixelTdThStyle}>{cell || 'NULL'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={runCheckData} className="w-full mt-8" style={pixelBtn(MARIO.green)}>2. KIỂM TRA CẤU TRÚC</button>
            </div>
          )}
        </div>

        {/* 3. MISSING */}
        {stepDataChecked && (
          <div style={brickBox}>
            <h2 className="mb-8 uppercase">🔥 3. Thông tin & Lỗi dữ liệu</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                <table style={pixelTableStyle}>
                  <thead style={{ background: '#000', color: '#fff' }}>
                    <tr><th style={pixelTdThStyle}>CỘT</th><th style={pixelTdThStyle}>LOẠI</th><th style={pixelTdThStyle}>LỖI</th></tr>
                  </thead>
                  <tbody>
                    {columnsInfo.map((info, idx) => (
                      <tr key={idx}><td style={pixelTdThStyle}>{info.name}</td>
                      <td style={{...pixelTdThStyle,  color: info.type === 'CHỮ' ? MARIO.red : (info.type === 'SỐ' ? MARIO.sky : MARIO.green),fontWeight: 'bold'}}>{info.type}</td>
                      <td style={{...pixelTdThStyle, color: MARIO.red}}>{info.nan_count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white p-4 border-4 border-black h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={missingData}><CartesianGrid stroke="#eee" /><XAxis dataKey="column" fontSize={12} stroke="#000" /><YAxis stroke="#000" /><Tooltip/><Bar dataKey="System_NaN" name="Hệ thống" stackId="a" fill={MARIO.red} /><Bar dataKey="User_Miss" name="Nhập liệu" stackId="a" fill={MARIO.yellow} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 4. PIPELINE */}
        {stepDataChecked && (
          <div style={{...questionBox, background: MARIO.green, color:'#fff'}}>
            <h2 className="mb-8">🧱 4. CHUẨN HÓA DỮ LIỆU (ETL)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="bg-black/20 p-6 border-4 border-black">
                <label className="block mb-4 text-[14px]">BƯỚC A: LÀM SẠCH</label>
                <select value={processMode} onChange={e => setProcessMode(e.target.value)} style={pixelSelect} className="w-full">
                  <option value="none">GIỮ NGUYÊN</option>
                  <option value="drop">XOÁ DÒNG LỖI</option>
                  <option value="mean">ĐIỀN TRUNG BÌNH</option>
                </select>
              </div>
              <div className="bg-black/20 p-6 border-4 border-black">
                <label className="block mb-4 text-[14px]">BƯỚC B: CHUẨN HÓA (CỘT SỐ)</label>
                <select value={scaleType} onChange={e => setScaleType(e.target.value)} style={pixelSelect} className="w-full mb-6">
                  <option value="none">KHÔNG CHUẨN HÓA</option>
                  <option value="standard">STANDARD</option>
                  <option value="minmax">MINMAX</option>
                </select>
                <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.3)', padding: '15px', border: '2px solid #000', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                  {columnsInfo.filter(c => c.type === 'SỐ').map(c => (
                    <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', padding: '5px', background: selectedScaleCols.includes(c.name) ? 'rgba(248, 216, 36, 0.2)' : 'transparent' }}>
                      <input type="checkbox" checked={selectedScaleCols.includes(c.name)} onChange={() => setSelectedScaleCols(p => p.includes(c.name) ? p.filter(x => x !== c.name) : [...p, c.name])} style={{ width: '18px', height: '18px', accentColor: MARIO.yellow, cursor: 'pointer' }} />
                      <span style={{ color: selectedScaleCols.includes(c.name) ? MARIO.yellow : '#fff' }}>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={runProcessData} className="w-full mt-10" style={pixelBtn(MARIO.red)}>5. BẮT ĐẦU XỬ LÝ PIPELINE</button>
          </div>
        )}

        {/* 6 & 7. BI DASHBOARD - BẢN NÂNG CẤP GOM NHÓM DỮ LIỆU */}
{stepProcessed && (
  <div style={brickBox}>
    {/* Header & Export Buttons */}
    <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
      <h2 style={{ color: MARIO.white, fontSize: '24px' }}>⭐ 6 & 7. BI DASHBOARD</h2>
      <div className="flex gap-4 no-print">
        <button onClick={() => { playEffect('dowload.mp3'); window.print(); }} style={pixelBtn(MARIO.white)}>
          <span style={{color:'#000'}}>📷 XUẤT ẢNH</span>
        </button>
        <button onClick={exportPDF} style={pixelBtn(MARIO.red)}>📄 XUẤT PDF</button>
      </div>
    </div>

    {/* SINGLE CONTROL BAR - Thanh điều khiển duy nhất */}
    <div className="bg-black/40 p-6 border-4 border-black mb-6 no-print">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Nhóm 1: Hình thức biểu đồ */}
        <div className="space-y-2">
          <label style={{color: MARIO.yellow, fontSize: '14px', display: 'block'}}>LOẠI BIỂU ĐỒ & TRỤC X</label>
          <div className="flex gap-2">
            <select value={chartType} onChange={e => setChartType(e.target.value)} style={{...pixelSelect, width: '50%'}}>
              <option value="Bar">CỘT</option>
              <option value="Line">ĐƯỜNG</option>
              <option value="Pie">TRÒN</option>
              <option value="Scatter">PHÂN TÁN</option>
            </select>
            <select value={xAxis} onChange={e => setXAxis(e.target.value)} style={{...pixelSelect, width: '50%'}}>
              <option value="">-- TRỤC X --</option>
              {columnsInfo.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Nhóm 2: Dữ liệu tính toán (Trục Y) */}
        <div className="space-y-2">
          <label style={{color: MARIO.yellow, fontSize: '14px', display: 'block'}}>GIÁ TRỊ (TRỤC Y) & HÀM TÍNH</label>
          <div className="flex gap-2">
            <select value={yAxis} onChange={e => setYAxis(e.target.value)} style={{...pixelSelect, width: '50%'}}>
              <option value="">-- TRỤC Y --</option>
              {columnsInfo.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select value={aggFunc} onChange={e => setAggFunc(e.target.value)} style={{...pixelSelect, width: '50%'}}>
              <option value="none">GỐC</option>
              <option value="count">ĐẾM</option>
              <option value="sum">TỔNG</option>
              <option value="mean">T.BÌNH</option>
            </select>
          </div>
        </div>

        {/* Nhóm 3: Gom nhóm & Thực thi */}
        <div className="space-y-2">
          <label style={{color: MARIO.yellow, fontSize: '14px', display: 'block'}}>GOM NHÓM (GROUP BY)</label>
          <div className="flex gap-2">
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{...pixelSelect, width: '60%'}}>
              <option value="">KHÔNG NHÓM</option>
              {columnsInfo.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <button onClick={runProcessData} style={{...pixelBtn(MARIO.red), padding: '10px', width: '40%', fontSize: '14px'}}>
              CẬP NHẬT
            </button>
          </div>
        </div>

      </div>
    </div>

    {/* CHART AREA - Khu vực hiển thị biểu đồ */}
    <div style={{ background: '#fff', padding: '30px', border: '4px solid #000', height: '550px', position: 'relative', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)' }}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'Bar' ? (
          <BarChart data={biData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={xAxis} stroke="#000" fontSize={12} tick={{dy: 10}} />
            <YAxis stroke="#000" fontSize={12} />
            <Tooltip cursor={{fill: '#f0f0f0'}} contentStyle={{border: '3px solid #000', fontFamily: "'VT323'"}} />
            <Legend verticalAlign="top" align="right" height={40}/>
            <Bar dataKey={yAxis} name={aggFunc !== 'none' ? `${aggFunc.toUpperCase()} of ${yAxis}` : yAxis} fill={MARIO.sky} border="2px solid #000" />
          </BarChart>
        ) : chartType === 'Line' ? (
          <LineChart data={biData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} stroke="#000" fontSize={12} />
            <YAxis stroke="#000" fontSize={12} />
            <Tooltip contentStyle={{border: '3px solid #000'}} />
            <Legend verticalAlign="top" align="right" height={40}/>
            <Line type="monotone" dataKey={yAxis} stroke={MARIO.red} strokeWidth={4} dot={{ r: 4, fill: MARIO.red, stroke: '#000' }} />
          </LineChart>
        ) : chartType === 'Pie' ? (
          <PieChart>
            <Pie data={biData?.slice(0, 10)} dataKey={yAxis} nameKey={xAxis} cx="50%" cy="50%" outerRadius={160} label={{fontFamily: "'VT323'"}}>
              {biData?.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#000" strokeWidth={2} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} type="number" name={xAxis} stroke="#000" />
            <YAxis dataKey={yAxis} type="number" name={yAxis} stroke="#000" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Data Points" data={biData} fill={MARIO.green} />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
    
    <p style={{ color: MARIO.white, fontSize: '12px', marginTop: '15px', textAlign: 'center', opacity: 0.8 }}>
      * Mẹo: Để xem thu nhập theo nghề nghiệp, chọn Trục X & Nhóm là 'Profession', Trục Y là 'Annual Income', Hàm tính là 'MEAN'.
    </p>
  </div>
)}

       {/* 8 & 9. K-MEANS */}
{/* 8 & 9. K-MEANS */}
{stepProcessed && (
  <div style={questionBox}>
    <div className="flex justify-between items-start mb-10 flex-wrap gap-4">
      <div>
        <h2 className="m-0 mb-4">🍄 8 & 9. PHÂN CỤM K-MEANS</h2>
        
        {/* KHAY CHỌN BIẾN ĐỘC LẬP CHO K-MEANS */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', border: '2px solid #000', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <span style={{color: MARIO.yellow, fontWeight: 'bold'}}>CHỌN BIẾN (X):</span>
          {columnsInfo.filter(c => c.type === 'SỐ').map(c => (
            <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={kmeansCols.includes(c.name)} 
                onChange={() => setKmeansCols(p => p.includes(c.name) ? p.filter(x => x !== c.name) : [...p, c.name])} 
                style={{ accentColor: MARIO.green, width: '16px', height: '16px', cursor: 'pointer' }} 
              />
              <span style={{ color: '#fff', fontSize: '14px' }}>{c.name}</span>
            </label>
          ))}
        </div>

      </div>
      <div className="flex gap-4 items-center mt-2">
        <label style={{color: '#fff', fontWeight: 'bold'}}>SỐ CỤM (K):</label>
        <input type="number" min="2" max="10" value={kClusters} onChange={e => setKClusters(e.target.value)} style={{...pixelSelect, width:'80px'}} />
        <button onClick={runKMeans} style={pixelBtn(MARIO.green)}>CHẠY PHÂN CỤM</button>
      </div>
    </div>
    
    {kmeansData && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* BÊN TRÁI: BIỂU ĐỒ SCATTER (THAY CHO RADAR) */}
        <div style={{ background: '#FFF', border: '6px solid #000', padding: '20px', display: 'flex', flexDirection: 'column', height: '450px', boxShadow: '8px 8px 0px rgba(0,0,0,0.2)' }}>
          <h4 style={{textAlign: 'center', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold', color: '#000'}}>PHÂN TÍCH KHÔNG GIAN CỤM (PCA)</h4>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" name="Trục X" stroke="#000" />
              <YAxis dataKey="y" type="number" name="Trục Y" stroke="#000" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '0px', border: '3px solid #000', fontFamily: "'VT323'" }} />
              <Legend verticalAlign="bottom" height={36} />
              
              {/* Tự động vẽ từng cụm với màu sắc khác nhau */}
              {Array.from({ length: kClusters }, (_, i) => {
                const clusterName = `Cụm ${i + 1}`;
                const clusterData = kmeansData.scatter?.filter(d => d.cluster === clusterName) || [];
                return (
                  <Scatter 
                    key={i} 
                    name={clusterName} 
                    data={clusterData} 
                    fill={COLORS[i % COLORS.length]} 
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* BÊN PHẢI: BẢNG GIÁ TRỊ TRUNG TÂM CỤM (GIỮ NGUYÊN) */}
        <div className="bg-white border-4 border-black p-4 overflow-x-auto" style={{ height: '450px' }}>
          <table style={pixelTableStyle}>
            <thead style={{ background: '#000', color: '#fff' }}>
              <tr>
                <th style={pixelTdThStyle}>CỤM</th>
                {kmeansData.features.map(f => <th key={f} style={pixelTdThStyle}>{f}</th>)}
              </tr>
            </thead>
            <tbody>
              {kmeansData.centers.map((c, i) => (
                <tr key={i}>
                  <td style={{...pixelTdThStyle, fontWeight:'bold', background:'#f9f9f9'}}>#{i+1}</td>
                  {c.map((v, j) => <td key={j} style={pixelTdThStyle}>{isFinite(v) ? v.toFixed(3) : '0.00'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
      </div>
    )}
  </div>
)}
        {/* 11. AI PREDICTION */}
{stepClustered && (
  <div style={{...brickBox, background: '#4A2B00'}}>
    <h2 className="mb-10 text-center uppercase" style={{ color: '#fff', fontSize: '28px' }}>🔮 AI DỰ BÁO TÙY BIẾN</h2>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      
       {/* CỘT TRÁI: BẢNG ĐIỀU KHIỂN AI */}
       <div className="bg-white/10 p-6 border-4 border-black space-y-6">
          <div>
            <label className="text-[14px] block mb-2 font-bold" style={{color: MARIO.yellow}}>1. THUẬT TOÁN</label>
            <select value={modelType} onChange={e => setModelType(e.target.value)} style={pixelSelect} className="w-full">
              <option value="rf">RANDOM FOREST 🌲</option>
              <option value="linear">LINEAR REGRESSION</option>
            </select>
          </div>
          
          <div>
            <label className="text-[14px] block mb-2 font-bold" style={{color: MARIO.yellow}}>2. MỤC TIÊU (TRỤC Y CẦN DỰ BÁO)</label>
            <select value={targetCol} onChange={e => setTargetCol(e.target.value)} style={pixelSelect} className="w-full">
              <option value="">-- CHỌN Y --</option>
              {/* Chỉ hiện cột SỐ làm Y */}
              {columnsInfo.filter(c => c.type === 'SỐ').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* ĐÂY RỒI! BẢNG TÍCH CHỌN X MÀ TX ĐANG TÌM */}
          <div>
            <label className="text-[14px] block mb-2 font-bold" style={{color: MARIO.yellow}}>3. BIẾN ĐẦU VÀO (TRỤC X)</label>
            <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.4)', padding: '15px', border: '2px solid #000', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Lọc các cột SỐ, và KHÔNG hiển thị cột đang được chọn làm Y (tránh dự báo chính nó) */}
              {columnsInfo.filter(c => c.type === 'SỐ' && c.name !== targetCol).map(c => (
                <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '5px', background: featureCols.includes(c.name) ? 'rgba(248, 216, 36, 0.3)' : 'transparent' }}>
                  <input 
                    type="checkbox" 
                    checked={featureCols.includes(c.name)} 
                    onChange={() => setFeatureCols(p => p.includes(c.name) ? p.filter(x => x !== c.name) : [...p, c.name])} 
                    style={{ width: '18px', height: '18px', accentColor: MARIO.yellow, cursor: 'pointer' }} 
                  />
                  <span style={{ color: featureCols.includes(c.name) ? MARIO.yellow : '#fff', fontSize: '16px', fontFamily: "'VT323'" }}>{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button onClick={runTrainModel} style={{...pixelBtn(MARIO.red), width:'100%', marginTop: '20px'}}>🚀 HUẤN LUYỆN AI</button>
       </div>
       
       {/* CỘT PHẢI: BẢNG RANKING SCORE (GIỮ NGUYÊN) */}
       <div className="bg-white p-6 border-4 border-black flex flex-col justify-center text-black text-center" style={{ boxShadow: 'inset -6px -6px 0px rgba(0,0,0,0.1)' }}>
          <h4 className="mb-6 uppercase" style={{ fontSize: '24px', color: '#000', fontWeight: '900', borderBottom: '4px solid #000', paddingBottom: '10px' }}>🏆 CHAMPION SCORE</h4>
          {modelMetrics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#000', border: '4px solid #333', padding: '15px', boxShadow: '4px 4px 0px #000' }}>
                <div style={{ fontSize: '16px', color: MARIO.yellow, marginBottom: '10px', textAlign: 'left' }}>⭐ ĐỘ KHỚP (R²):</div>
                <div style={{ fontSize: '40px', color: MARIO.green, fontWeight: '900', textAlign: 'right', textShadow: '2px 2px 0px #000' }}>{(modelMetrics.r2 * 100).toFixed(2)}%</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#222', color: '#fff', padding: '20px', border: '5px solid #000' }}>
                  <div style={{ fontSize: '18px', color: MARIO.sky, marginBottom: '10px' }}>LỖI MAE</div>
                  <div style={{ fontSize: '48px', color: '#fff', textShadow: '3px 3px 0px #000' }}>{modelMetrics.mae}</div>
                </div>
                <div style={{ background: '#222', color: '#fff', padding: '20px', border: '5px solid #000' }}>
                  <div style={{ fontSize: '18px', color: MARIO.red, marginBottom: '10px' }}>LỖI MSE</div>
                  <div style={{ fontSize: '48px', color: '#fff', textShadow: '3px 3px 0px #000' }}>{modelMetrics.mse}</div>
                </div>
              </div>
            </div>
          ) : <p style={{ fontSize: '20px', color: '#888' }}>💤 ĐANG CHỜ LỆNH...</p>}
       </div>
       
    </div>
  </div>
)}

        {/* ARIMA */}
        {stepClustered && (
          <div style={{...brickBox, background: MARIO.sky, borderColor: '#000'}}>
             <h2 className="mb-10 text-center uppercase">📈 DỰ BÁO CHUỖI THỜI GIAN (ARIMA)</h2>
             <div className="bg-white p-6 border-4 border-black text-black grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 no-print">
                <div><label className="text-[14px] mb-2 block font-bold">CỘT DATE</label><select value={arimaDateCol} onChange={e => setArimaDateCol(e.target.value)} style={pixelSelect} className="w-full">{columnsInfo.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
                <div><label className="text-[14px] mb-2 block font-bold">CỘT GIÁ TRỊ (Y)</label><select value={arimaTargetCol} onChange={e => setArimaTargetCol(e.target.value)} style={pixelSelect} className="w-full">{columnsInfo.filter(c => c.type === 'SỐ').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
                <button onClick={runARIMA} style={{...pixelBtn(MARIO.red), alignSelf:'end'}}>CHẠY ARIMA</button>
             </div>
             {arimaData && (
              <div style={{ background: '#FFF', border: '6px solid #000', padding: '30px', marginTop: '40px', position: 'relative', boxShadow: '10px 10px 0px rgba(0,0,0,0.2)' }}>
                <h2 style={{ color: '#000', textAlign: 'center', fontSize: '28px', marginBottom: '30px', textTransform: 'uppercase', borderBottom: '4px solid #5C94FC', paddingBottom: '10px' }}>📈 KẾT QUẢ DỰ BÁO TƯƠNG LAI</h2>
                <div style={{ width: '100%', height: '450px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={arimaData} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ddd" vertical={true} />
                      <XAxis dataKey="date" stroke="#000" fontSize={14} tick={{ fontFamily: "'VT323'" }} label={{ value: 'THỜI GIAN', position: 'insideBottomRight', offset: -10, fontSize: 12 }} />
                      <YAxis stroke="#000" fontSize={14} tick={{ fontFamily: "'VT323'" }} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={true} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '3px solid #F8D824', color: '#fff', fontFamily: "'VT323'", fontSize: '16px' }} />
                      <Legend verticalAlign="top" height={40} iconType="square" />
                      <Line type="monotone" dataKey="actual" name="DỮ LIỆU GỐC" stroke={MARIO.sky} strokeWidth={5} dot={{ r: 6, fill: MARIO.sky, stroke: '#000', strokeWidth: 2 }} activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="forecast" name="DỰ BÁO AI" stroke={MARIO.red} strokeWidth={5} strokeDasharray="10 10" dot={{ r: 7, fill: '#fff', stroke: MARIO.red, strokeWidth: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ marginTop: '25px', background: '#eee', padding: '15px', borderLeft: '8px solid #E4000F', fontFamily: "'VT323'", fontSize: '16px', color: '#333' }}>
                  <span style={{ fontWeight: 'bold', color: MARIO.red }}>[SYSTEM LOG]:</span> AI đã phân tích chuỗi thời gian và vẽ ra đường nét đứt màu đỏ. Đó chính là vận mệnh tương lai của dữ liệu!
                </div>
              </div>
             )}
          </div>
        )}

        <div className="text-center pt-20 pb-10 opacity-50">
           <p style={{ fontSize: '16px', color: '#fff' }}>© 2026 HUB DATA SCIENCE • TRUC XINH DATA PROJECT</p>
        </div>
      </div>
    </div>
  );
}