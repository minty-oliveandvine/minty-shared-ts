// The document reader - reading an attached receipt or invoice with the model and filling the
// form's empty fields as suggestions (owner, 2026-11-04). The rules (`core`), the read (`useDocumentReader`)
// and the classic-look pieces; each app keeps its own fields and words.

export * from "./core";
export * from "./pieces";
export { useDocumentReader, type DocumentReaderOptions } from "./useDocumentReader";
