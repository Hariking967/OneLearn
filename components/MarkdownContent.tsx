'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface Props {
  content: string
  className?: string
}

const components: Components = {
  // Headings
  h1: ({ children }) => <h1 className="text-base font-bold text-gray-100 mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-gray-100 mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-200 mt-2 mb-1">{children}</h3>,

  // Paragraphs
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

  // Bold / italic
  strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,

  // Lists
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-0.5 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-2">{children}</ol>,
  li: ({ children }) => <li className="text-gray-200 leading-relaxed">{children}</li>,

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-violet-600 pl-3 text-gray-400 italic my-2">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="border-gray-700 my-3" />,

  // Inline code
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      const lang = className?.replace('language-', '') ?? ''
      return (
        <div className="my-2 rounded-xl overflow-hidden border border-gray-700">
          {lang && (
            <div className="px-3 py-1 bg-gray-800 border-b border-gray-700 text-xs text-violet-400 font-mono">
              {lang}
            </div>
          )}
          <pre className="bg-gray-900 p-3 overflow-x-auto">
            <code className="text-xs text-gray-300 font-mono leading-relaxed">{children}</code>
          </pre>
        </div>
      )
    }
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-gray-700 text-violet-300 text-xs font-mono" {...props}>
        {children}
      </code>
    )
  },

  // Pre (wraps code blocks)
  pre: ({ children }) => <>{children}</>,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
    >
      {children}
    </a>
  ),

  // Tables
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-gray-700">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-t border-gray-700">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left text-gray-300 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-gray-400">{children}</td>,
}

export function MarkdownContent({ content, className }: Props) {
  return (
    <div className={`text-sm text-gray-200 leading-relaxed ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
