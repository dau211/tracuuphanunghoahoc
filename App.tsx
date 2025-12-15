import React, { useState, useCallback, useEffect } from 'react';
import { getReactionInfo, generatePracticeQuestion } from './services/geminiService';
import { ReactionData } from './types';
import Loader from './components/Loader';
import { BeakerIcon, VideoIcon, SearchIcon, ClipboardCheckIcon, BrainIcon, PlusIcon, ImageIcon } from './components/icons';
import ChemicalEquation from './components/ChemicalEquation';
import FormattedText from './components/FormattedText';

type Tab = 'lookup' | 'check' | 'practice';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('lookup');
  
  // Common State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReactionData | null>(null);
  const [lastReactants, setLastReactants] = useState<string>('');

  // Input State
  const [reactants, setReactants] = useState<string>('Fe + CuSO4');
  const [userProducts, setUserProducts] = useState<string>('FeSO4 + Cu');
  
  // Practice Mode State
  const [practiceReactants, setPracticeReactants] = useState<string | null>(null);
  const [parsedReactants, setParsedReactants] = useState<string[]>([]);
  const [reactantCoeffs, setReactantCoeffs] = useState<string[]>([]);
  const [practiceAnswer, setPracticeAnswer] = useState<string>('');

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setError(null);
    setResult(null);
    // Reset inputs based on tab defaults
    if (tab === 'lookup' || tab === 'check') {
        setReactants('Fe + CuSO4');
        setUserProducts('FeSO4 + Cu');
    }
  };

  const handleLookup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactants.trim()) {
      setError('Vui lòng nhập các chất tham gia phản ứng.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setLastReactants(reactants);

    try {
      // lookup: userProducts is empty string
      const data = await getReactionInfo(reactants, '');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }, [reactants]);

  const handleCheck = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactants.trim()) {
        setError('Vui lòng nhập các chất tham gia phản ứng.');
        return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setLastReactants(reactants);

    try {
      const data = await getReactionInfo(reactants, userProducts);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }, [reactants, userProducts]);

  const handleNewQuestion = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPracticeReactants(null);
    setPracticeAnswer('');
    setParsedReactants([]);
    setReactantCoeffs([]);
    
    try {
        const newReactants = await generatePracticeQuestion();
        setPracticeReactants(newReactants);
        
        // Split reactants by '+' to create individual inputs
        const parts = newReactants.split('+').map(part => part.trim());
        setParsedReactants(parts);
        setReactantCoeffs(new Array(parts.length).fill('')); // Init empty coeffs

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tạo câu hỏi.');
    } finally {
        setLoading(false);
    }
  };

  const handleCoeffChange = (index: number, value: string) => {
      const newCoeffs = [...reactantCoeffs];
      newCoeffs[index] = value;
      setReactantCoeffs(newCoeffs);
  };

  const handlePracticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceReactants) return;
    if (!practiceAnswer.trim()) {
        setError('Vui lòng nhập sản phẩm phản ứng.');
        return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // Reconstruct the user's full equation:
    // (Coeff1)Reactant1 + (Coeff2)Reactant2 -> ProductAnswer
    const leftSide = parsedReactants.map((reactant, index) => {
        const coeff = reactantCoeffs[index].trim();
        return `${coeff}${reactant}`; // e.g., "2Fe" or "Fe" if empty
    }).join(' + ');

    const fullEquationAttempt = `${leftSide} -> ${practiceAnswer}`;
    setLastReactants(practiceReactants); // Keep original context for display if needed

    try {
        // Send the original reactants as context, and the user's full constructed equation
        const data = await getReactionInfo(practiceReactants, fullEquationAttempt);
        setResult(data);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.');
    } finally {
        setLoading(false);
    }
  };
  
  // Nâng cấp bộ render để hỗ trợ cả chỉ số trên (^) và chỉ số dưới (số thường)
  const renderFormattedFormula = (text: string) => {
    if (!text) return null;
    
    // Tách chuỗi dựa trên dấu ^ để xử lý chỉ số trên
    // VD: "Fe^3+" -> ["Fe", "^3+"]
    const parts = text.split(/(\^[A-Za-z0-9+\-]+)/g);
    
    return parts.map((part, index) => {
        // Xử lý Superscript (Chỉ số trên) bắt đầu bằng ^
        if (part.startsWith('^')) {
            return <sup key={index} className="text-xs text-yellow-200">{part.substring(1)}</sup>;
        }
        
        // Xử lý Subscript (Chỉ số dưới) cho phần văn bản thường
        // Tìm các chữ số đi liền sau chữ cái hoặc dấu đóng ngoặc
        const subRegex = /([a-zA-Z)\]])(\d+)/g;
        const subParts: React.ReactNode[] = [];
        let lastIdx = 0;
        let match;
        
        while ((match = subRegex.exec(part)) !== null) {
            if (match.index > lastIdx) {
                subParts.push(part.substring(lastIdx, match.index));
            }
            subParts.push(match[1]); // Chữ cái
            subParts.push(<sub key={`${index}-${match.index}`} className="text-xs">{match[2]}</sub>); // Số
            lastIdx = subRegex.lastIndex;
        }
        if (lastIdx < part.length) {
            subParts.push(part.substring(lastIdx));
        }
        
        return <React.Fragment key={index}>{subParts}</React.Fragment>;
    });
  };

  // Component hiển thị bản xem trước
  const InputPreview: React.FC<{ text: string, placeholder?: string }> = ({ text, placeholder }) => {
    if (!text) return <div className="h-6"></div>;
    return (
        <div className="flex items-center justify-center gap-2 mt-2 text-cyan-400 font-mono text-lg min-h-[1.5rem] animate-fade-in bg-slate-800/50 py-1 px-3 rounded border border-slate-700/50 inline-block">
             <span className="text-xs text-slate-500 uppercase mr-2 font-sans tracking-wide">Hiển thị:</span>
             <span className="font-bold">{renderFormattedFormula(text)}</span>
        </div>
    );
  };
  
  const ResultDisplay: React.FC<{ result: ReactionData }> = ({ result }) => {
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [result]);

    return (
        <div className="mt-8 space-y-6 animate-fade-in w-full">
            {result.feedback && (
                <div
                    className={`p-4 rounded-xl border ${
                    result.isUserCorrect
                        ? 'bg-green-500/10 text-green-300 border-green-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                >
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    {result.isUserCorrect ? (
                        <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Chính xác!
                        </>
                    ) : (
                        <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Xem lại nhé!
                        </>
                    )}
                    </h3>
                    <div className="ml-8 text-sm sm:text-base"><FormattedText text={result.feedback} /></div>
                </div>
            )}

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h2 className="text-2xl font-bold text-cyan-400 mb-2">Kết quả phân tích</h2>
                <div className="text-slate-300 mb-4 font-mono bg-slate-700/50 px-3 py-1.5 rounded-md inline-block text-lg">
                     {renderFormattedFormula(lastReactants)}
                </div>
                <div
                    className={`text-lg font-semibold mb-4 p-3 rounded-md ${
                        result.reactionOccurs
                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                >
                    {result.reactionOccurs
                        ? `Có phản ứng xảy ra.`
                        : `Không có phản ứng xảy ra.`}
                </div>

                {result.reactionOccurs && result.equation && (
                    <div className="my-6">
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">Phương trình phản ứng:</h3>
                        <ChemicalEquation equation={result.equation} />
                    </div>
                )}
                
                <h3 className="text-lg font-semibold text-slate-300 mb-2 mt-4">Giải thích (Theo CT 2018):</h3>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                    <FormattedText text={result.explanation} />
                </div>

                {result.imageData && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <ImageIcon className="w-6 h-6 text-purple-400" />
                            <h3 className="text-lg font-semibold text-slate-200">Hình ảnh minh họa</h3>
                        </div>
                        
                        {!imageError ? (
                            <img 
                                src={result.imageData.url} 
                                alt={result.imageData.alt}
                                className="rounded-lg border border-slate-700 w-full max-w-md mx-auto bg-white"
                                onError={() => setImageError(true)} 
                            />
                        ) : (
                            <div className="text-center p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                                <a 
                                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(result.imageData.alt)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-semibold"
                                >
                                    <SearchIcon className="w-4 h-4" />
                                    Thử tìm trên Google
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {result.videos && result.videos.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <VideoIcon className="w-6 h-6 text-red-500" />
                            <h3 className="text-lg font-semibold text-slate-200">Video tham khảo</h3>
                        </div>
                        
                        <ul className="space-y-3">
                            {result.videos.map((video, index) => {
                                const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`;

                                return (
                                    <li key={index}>
                                        <a 
                                            href={videoUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="group flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-red-500/50 hover:bg-slate-900 transition-all duration-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </div>
                                                <span className="text-slate-300 font-medium group-hover:text-red-400 transition-colors">
                                                    {video.title}
                                                </span>
                                            </div>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500 group-hover:text-red-400 transform group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                <polyline points="15 3 21 3 21 9"></polyline>
                                                <line x1="10" y1="14" x2="21" y2="3"></line>
                                            </svg>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center my-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <BeakerIcon className="w-12 h-12 text-cyan-400" />
            <h1 className="text-3xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Tra Cứu Phản Ứng Hóa Học
            </h1>
          </div>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Hệ thống tra cứu và luyện tập Hóa học theo chuẩn <strong>Chương trình GDPT 2018</strong>.
            <br/>
            <span className="text-xs text-slate-500 italic">(Tên chất hiển thị theo danh pháp IUPAC/Tiếng Anh. Giải thích Tiếng Việt)</span>
          </p>
        </header>

        <main>
          {/* Tabs Navigation */}
          <div className="flex justify-center mb-8 border-b border-slate-700">
            <button
                onClick={() => handleTabChange('lookup')}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-lg transition-all border-b-2 ${
                    activeTab === 'lookup'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
                }`}
            >
                <SearchIcon className="w-5 h-5" />
                Tra cứu
            </button>
            <button
                onClick={() => handleTabChange('check')}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-lg transition-all border-b-2 ${
                    activeTab === 'check'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
                }`}
            >
                <ClipboardCheckIcon className="w-5 h-5" />
                Kiểm tra
            </button>
            <button
                onClick={() => handleTabChange('practice')}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-lg transition-all border-b-2 ${
                    activeTab === 'practice'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
                }`}
            >
                <BrainIcon className="w-5 h-5" />
                Luyện tập
            </button>
          </div>

          {/* Tab Content */}
          <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-700 transition-all">
            
            {/* --- TAB 1: LOOKUP --- */}
            {activeTab === 'lookup' && (
                <form onSubmit={handleLookup} className="space-y-6 animate-fade-in">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Tra cứu phản ứng</h2>
                        <p className="text-sm text-slate-400">
                            Nhập chất (VD: Iron, HNO3...). Nếu phản ứng phụ thuộc điều kiện, hãy ghi rõ.
                        </p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <input
                            type="text"
                            value={reactants}
                            onChange={(e) => setReactants(e.target.value)}
                            placeholder="VD: Fe + HCl"
                            className="w-full bg-slate-900 border-2 border-slate-600 rounded-lg py-3 px-4 text-lg text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors duration-300 text-center"
                        />
                         {/* Live Preview */}
                         <InputPreview text={reactants} />
                         <p className="text-xs text-slate-500 italic">Mẹo: Nhập số thường để có chỉ số dưới (H2O), dùng dấu ^ cho chỉ số trên (Fe^3+).</p>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
                    >
                        {loading ? 'Đang phân tích...' : <> <SearchIcon className="w-5 h-5" /> Tra cứu ngay </>}
                    </button>
                </form>
            )}

            {/* --- TAB 2: CHECK --- */}
            {activeTab === 'check' && (
                <form onSubmit={handleCheck} className="space-y-6 animate-fade-in">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Kiểm tra kết quả</h2>
                        <p className="text-sm text-slate-400">Nhập cả chất tham gia và sản phẩm để xem bạn có đúng không.</p>
                        <p className="text-xs text-slate-500 italic mt-1">Hỗ trợ: Dùng dấu ^ cho ion (VD: Fe^3+).</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start justify-center gap-4">
                        <div className="w-full flex flex-col">
                            <label className="block text-xs text-slate-400 mb-1 ml-1">Chất tham gia</label>
                            <input
                                type="text"
                                value={reactants}
                                onChange={(e) => setReactants(e.target.value)}
                                placeholder="VD: Fe + CuSO4"
                                className="w-full bg-slate-900 border-2 border-slate-600 rounded-lg py-3 px-4 text-lg text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors duration-300 text-center"
                            />
                            <div className="w-full flex justify-center"><InputPreview text={reactants} /></div>
                        </div>
                        <div className="text-3xl font-bold text-slate-400 transform sm:rotate-0 rotate-90 mt-8 hidden sm:block">→</div>
                        <div className="w-full flex flex-col">
                            <label className="block text-xs text-slate-400 mb-1 ml-1">Sản phẩm dự đoán</label>
                            <input
                                type="text"
                                value={userProducts}
                                onChange={(e) => setUserProducts(e.target.value)}
                                placeholder="VD: FeSO4 + Cu"
                                className="w-full bg-slate-900 border-2 border-slate-600 rounded-lg py-3 px-4 text-lg text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors duration-300 text-center"
                            />
                            <div className="w-full flex justify-center"><InputPreview text={userProducts} /></div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg flex items-center justify-center gap-2"
                    >
                        {loading ? 'Đang chấm bài...' : <> <ClipboardCheckIcon className="w-5 h-5" /> Kiểm tra phản ứng </>}
                    </button>
                </form>
            )}

            {/* --- TAB 3: PRACTICE --- */}
            {activeTab === 'practice' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Luyện tập ngẫu nhiên</h2>
                        <p className="text-sm text-slate-400">Hoàn thành phương trình: <strong>Điền hệ số cân bằng</strong> vào ô nhỏ và <strong>viết sản phẩm</strong> vào ô lớn.</p>
                    </div>
                    
                    {!practiceReactants ? (
                         <div className="flex flex-col items-center py-8">
                            <BrainIcon className="w-20 h-20 text-slate-600 mb-4" />
                            <p className="text-slate-400 mb-6">Nhấn nút bên dưới để nhận đề bài mới.</p>
                            <button
                                onClick={handleNewQuestion}
                                disabled={loading}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 disabled:opacity-50"
                            >
                                {loading ? 'Đang tạo đề...' : 'Tạo câu hỏi mới'}
                            </button>
                         </div>
                    ) : (
                        <form onSubmit={handlePracticeSubmit} className="space-y-6">
                            <div className="flex flex-col items-center gap-6 bg-slate-900/50 p-4 sm:p-6 rounded-xl border border-slate-700/50">
                                
                                <div className="w-full text-center">
                                    <label className="block text-sm text-cyan-400 mb-4 font-bold uppercase tracking-wider">Cân bằng & Hoàn thành</label>
                                    
                                    {/* Interactive Equation Builder */}
                                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 p-4 bg-slate-800 rounded-lg border border-slate-600">
                                         
                                         {/* Reactants Loop */}
                                         {parsedReactants.map((reactant, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                {/* Coefficient Input */}
                                                <input
                                                    type="text"
                                                    value={reactantCoeffs[idx] || ''}
                                                    onChange={(e) => handleCoeffChange(idx, e.target.value)}
                                                    className="w-12 h-10 text-center bg-slate-700 border border-slate-500 rounded text-white font-mono focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                                                    placeholder="1"
                                                />
                                                {/* Chemical Formula */}
                                                <span className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                                                    {renderFormattedFormula(reactant)}
                                                </span>
                                                {/* Plus sign if not last element */}
                                                {idx < parsedReactants.length - 1 && (
                                                    <span className="text-slate-400 text-xl font-bold">+</span>
                                                )}
                                            </div>
                                         ))}

                                         {/* Arrow */}
                                         <span className="text-slate-400 text-2xl font-bold mx-2">→</span>

                                         {/* Products Input */}
                                         <div className="flex-grow min-w-[150px] flex flex-col">
                                            <input
                                                type="text"
                                                value={practiceAnswer}
                                                onChange={(e) => setPracticeAnswer(e.target.value)}
                                                placeholder="Sản phẩm..."
                                                className="w-full h-12 bg-slate-700 border border-slate-500 rounded px-3 text-lg text-white font-mono focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none placeholder-slate-500"
                                            />
                                            <div className="w-full flex justify-center"><InputPreview text={practiceAnswer} /></div>
                                         </div>
                                    </div>
                                    
                                    <p className="text-xs text-slate-500 mt-2 italic">
                                        Mẹo: Để trống ô hệ số được hiểu là 1. Dùng ^ cho ion/chỉ số trên.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleNewQuestion}
                                    disabled={loading}
                                    className="flex-1 bg-slate-700 text-slate-200 font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors"
                                >
                                    Đổi câu khác
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                                >
                                    {loading ? 'Đang chấm...' : 'Nộp bài'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

          </div>

          {/* Results Section */}
          <div className="mt-8 min-h-[100px] flex items-center justify-center">
            {loading && <Loader />}
            {error && <p className="text-red-400 bg-red-500/10 p-4 rounded-md border border-red-500/30 w-full text-center">{error}</p>}
            {!loading && result && <ResultDisplay result={result}/>}
          </div>
        </main>

        <footer className="text-center text-slate-500 mt-12 py-4 border-t border-slate-800">
            <p>Phát triển bởi nhóm học sinh THPT Đào Duy Từ</p>
         </footer>
      </div>
    </div>
  );
};

export default App;
