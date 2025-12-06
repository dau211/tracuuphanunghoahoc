import React from 'react';

interface FormattedTextProps {
  text: string;
}

const FormattedText: React.FC<FormattedTextProps> = ({ text }) => {
  // Hàm xử lý hiển thị chỉ số dưới cho công thức hóa học
  const parseChemicalText = (input: string): React.ReactNode => {
    // Regex logic: Tìm các nhóm (Ký tự chữ hoặc đóng ngoặc) đi liền với (Số)
    const regex = /([a-zA-Z)])(\d+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        parts.push(input.substring(lastIndex, match.index));
      }
      parts.push(match[1]);
      parts.push(<sub key={match.index} className="text-xs">{match[2]}</sub>);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
      parts.push(input.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  // Hàm xử lý in đậm (markdown **text**) và sau đó xử lý hóa học bên trong
  const parseRichText = (input: string): React.ReactNode => {
    // Tách chuỗi dựa trên dấu ** (bold)
    // Ví dụ: "Chất **H2SO4** đặc" -> ["Chất ", "H2SO4", " đặc"]
    const parts = input.split(/\*\*(.*?)\*\*/g);
    
    return (
        <>
            {parts.map((part, index) => {
                // Các phần tử ở vị trí lẻ (1, 3, 5...) là nội dung nằm trong dấu **
                if (index % 2 === 1) {
                    return <strong key={index} className="text-cyan-200 font-bold">{parseChemicalText(part)}</strong>;
                }
                // Các phần tử chẵn là văn bản thường
                return <React.Fragment key={index}>{parseChemicalText(part)}</React.Fragment>;
            })}
        </>
    );
  };

  const lines = text.split('\n');
  const renderedContent: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
        if (currentList.length > 0) {
            renderedContent.push(
                <ul key={`ul-${index}`} className="list-disc pl-5 mb-3 space-y-1 text-slate-300 marker:text-cyan-500">
                    {currentList}
                </ul>
            );
            currentList = [];
        }
        renderedContent.push(<div key={`br-${index}`} className="h-2"></div>);
        return;
    }

    // Xử lý list item (bắt đầu bằng - hoặc *)
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const content = trimmedLine.substring(2);
      currentList.push(
        <li key={`li-${index}`} className="pl-1">
            {parseRichText(content)}
        </li>
      );
    } else {
      if (currentList.length > 0) {
        renderedContent.push(
          <ul key={`ul-${index}`} className="list-disc pl-5 mb-3 space-y-1 text-slate-300 marker:text-cyan-500">
            {currentList}
          </ul>
        );
        currentList = [];
      }
      
      const isHeader = trimmedLine.endsWith(':');
      renderedContent.push(
        <p key={`p-${index}`} className={`mb-1 text-slate-300 leading-relaxed ${isHeader ? 'font-semibold text-cyan-400 mt-3 text-lg' : ''}`}>
          {parseRichText(trimmedLine)}
        </p>
      );
    }
  });

  if (currentList.length > 0) {
    renderedContent.push(
      <ul key="ul-last" className="list-disc pl-5 mb-3 space-y-1 text-slate-300 marker:text-cyan-500">
        {currentList}
      </ul>
    );
  }

  return <div>{renderedContent}</div>;
};

export default FormattedText;