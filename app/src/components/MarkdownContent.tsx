import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  streaming?: boolean;
}

export const MarkdownContent = memo(function MarkdownContent({ content, streaming }: Props) {
  return (
    <div className="markdown-body text-sm leading-relaxed overflow-hidden" style={{ color: "var(--foreground)" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
          h1: ({ children }) => <h1 className="text-lg font-bold mt-5 mb-2" style={{ color: "var(--foreground)" }}>{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2" style={{ color: "var(--foreground)" }}>{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5" style={{ color: "var(--foreground)" }}>{children}</h3>,
          code: ({ children, className }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              const lang = className?.replace("language-", "") ?? "";
              return (
                <div className="rounded-xl overflow-hidden my-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {lang && (
                    <div className="flex items-center px-3 py-1.5 text-[10px] font-mono" style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      {lang}
                    </div>
                  )}
                  <pre className="p-3 overflow-x-auto text-[12px] leading-relaxed font-mono max-w-full" style={{ color: "var(--secondary-foreground)" }}>
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded-md text-[12px] font-mono" style={{ background: "var(--surface-elevated)", color: "#5a9eff", border: "1px solid var(--border)" }}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm" style={{ color: "var(--secondary-foreground)" }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 my-3 italic" style={{ borderColor: "rgba(56,132,255,0.4)", color: "#808590" }}>
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "#5a9eff" }}>{children}</a>
          ),
          hr: () => <hr className="my-4" style={{ borderColor: "var(--border)" }} />,
          strong: ({ children }) => <strong className="font-semibold" style={{ color: "var(--foreground)" }}>{children}</strong>,
          em: ({ children }) => <em className="italic" style={{ color: "var(--muted-foreground)" }}>{children}</em>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-xs border-collapse" style={{ borderColor: "var(--border)" }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold border" style={{ borderColor: "var(--border)", background: "var(--surface-elevated)", color: "var(--foreground)" }}>{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="cursor-blink" />}
    </div>
  );
});
