import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Detect block-level elements we should not nest inside <p>
const BLOCK_TAGS = new Set(['pre','code','table','ul','ol','blockquote']);
const isBlockLike = (child) => React.isValidElement(child) && typeof child.type === 'string' && BLOCK_TAGS.has(child.type);

const MarkdownRenderer = ({ content = '', className = '' }) => {
  return (
    <div className={`prose max-w-none prose-headings:font-semibold prose-p:leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({node, children, ...props}) {
            const arr = React.Children.toArray(children);
            // If any block-like element present, unwrap entirely to avoid invalid nesting
            if (arr.some(isBlockLike)) return <>{arr}</>;
            return <p className="leading-relaxed my-3" {...props}>{children}</p>;
          },
          li({node, children, ...props}) {
            // Some markdown parsers may put code blocks directly under li -> ensure we don't wrap them incorrectly
            const arr = React.Children.toArray(children);
            const hasBlock = arr.some(isBlockLike);
            return (
              <li className="leading-relaxed" {...props}>
                {hasBlock ? arr.map((c,i) => <React.Fragment key={i}>{c}</React.Fragment>) : children}
              </li>
            );
          },
          code({inline, className, children, ...props}) {
            if (inline) return <code className="bg-gray-100 rounded px-1 py-0.5 text-[13px]" {...props}>{children}</code>;
            // Render block code as a standalone code tag styled like a block to avoid pre nesting warnings
            return (
              <code
                className={`block w-full whitespace-pre overflow-x-auto bg-gray-900 text-gray-100 rounded-lg p-4 text-sm my-4 not-prose ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          ul: ({node, ...props}) => <ul className="list-disc pl-6 my-3 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-3 space-y-1" {...props} />,
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-300 text-sm" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
          th: ({node, ...props}) => <th className="border border-gray-300 px-3 py-2 text-left font-medium" {...props} />,
          td: ({node, ...props}) => <td className="border border-gray-200 px-3 py-2 align-top" {...props} />,
          a: ({node, ...props}) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
        }}
      >{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
