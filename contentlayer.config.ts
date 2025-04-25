import { defineDocumentType, makeSource } from 'contentlayer/source-files'
import type { DocumentTypes } from 'contentlayer/generated'

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `posts/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'string', required: true },
    description: { type: 'string', required: true },
    published: { type: 'boolean', default: true },
    tags: { type: 'list', of: { type: 'string' }, required: false },
    image: { type: 'string', required: false },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post: DocumentTypes['Post']) => `/posts/${post._raw.flattenedPath}`,
    },
  },
}))

export default makeSource({
  contentDirPath: 'content',
  documentTypes: [Post],
})
