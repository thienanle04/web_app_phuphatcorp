import { useState } from 'react';
import { FileText, ZoomIn, Copy } from 'lucide-react';
import type { DocumentFile } from '../../api/invoiceTrackingApi';
import { DocumentViewerModal } from './DocumentViewerModal';

interface DocumentPreviewProps {
  documents: DocumentFile[];
}

export function DocumentPreview({ documents }: DocumentPreviewProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);

  if (documents.length === 0) {
    return <p className="text-xs sm:text-sm text-neutral-500 italic py-2">Chưa có chứng từ đính kèm</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {documents.map((doc, idx) => {
          const isImage = doc.mime_type?.startsWith('image/');
          const fileName = doc.original_filename || doc.file_name || `Chứng từ #${idx + 1}`;
          const imgSrc = doc.filename
            ? `/api/invoice-tracking/files/${doc.filename}`
            : doc.file_data
              ? `data:${doc.mime_type};base64,${doc.file_data}`
              : null;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDoc(doc)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100/70 transition hover:border-neutral-900 dark:hover:border-neutral-200 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-left"
            >
              {isImage && imgSrc ? (
                <>
                  <img
                    src={imgSrc}
                    alt={fileName}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                </>
              ) : isImage ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center bg-sky-50/50 dark:bg-sky-950/20">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <ZoomIn className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="line-clamp-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    {fileName}
                  </span>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center bg-rose-50/50 dark:bg-rose-950/20">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <FileText className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="line-clamp-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    {fileName}
                  </span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">PDF</span>
                </div>
              )}

              {/* Source Badge if copied */}
              {doc.source_plate_number && (
                <div className="absolute top-1.5 left-1.5 z-10">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-900/80 text-white text-[10px] font-medium backdrop-blur-xs shadow-xs">
                    <Copy className="w-2.5 h-2.5 text-sky-400" />
                    <span>{doc.source_plate_number}</span>
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <DocumentViewerModal
        document={selectedDoc}
        documents={documents}
        onClose={() => setSelectedDoc(null)}
        onNavigate={(newDoc) => setSelectedDoc(newDoc)}
      />
    </>
  );
}
