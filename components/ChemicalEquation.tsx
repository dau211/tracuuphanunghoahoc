import React from 'react';

const ChemicalEquation: React.FC<{ equation: string }> = ({ equation }) => {
  const renderPartWithSubscripts = (part: string) => {
    // FIX: Replaced `(string | JSX.Element)[]` with `React.ReactNode[]` to resolve the "Cannot find namespace 'JSX'" error.
    const renderedElements: React.ReactNode[] = [];
    let buffer = '';

    for (let i = 0; i < part.length; i++) {
      const char = part[i];
      const prevChar = i > 0 ? part[i - 1] : null;

      // Một chữ số là chỉ số dưới nếu nó được đặt trước bởi một chữ cái hoặc dấu ngoặc đơn đóng.
      if (/\d/.test(char) && prevChar && /[a-zA-Z)]/.test(prevChar)) {
        if (buffer) {
          renderedElements.push(buffer);
          buffer = '';
        }
        renderedElements.push(<sub key={i}>{char}</sub>);
      } else {
        buffer += char;
      }
    }

    if (buffer) {
      renderedElements.push(buffer);
    }
    
    // Sử dụng Fragment với key để xử lý mảng hỗn hợp chuỗi và element
    return (
        <>
            {renderedElements.map((el, idx) => (
                <React.Fragment key={idx}>{el}</React.Fragment>
            ))}
        </>
    );
  };

  return (
    <div 
        className="text-xl font-mono bg-slate-900 p-4 rounded-md text-center text-yellow-300 border border-slate-700 tracking-wider" 
        aria-label={`Phương trình hóa học: ${equation}`}
    >
      {equation.split(' ').map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && ' '}
          {renderPartWithSubscripts(part)}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ChemicalEquation;
