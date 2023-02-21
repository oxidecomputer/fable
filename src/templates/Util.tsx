import { marked } from 'marked'

export const Markdown = ({ content }: { content: string }) => (
  <div dangerouslySetInnerHTML={{ __html: marked.parse(content) }} />
)
